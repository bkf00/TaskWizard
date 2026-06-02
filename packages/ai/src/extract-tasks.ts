import { z } from "zod";
import type { ProposedTask, SourceItem } from "@repo/domain/types";
import { newId } from "@repo/domain/ids";

const ExtractedTaskSchema = z.object({
  title: z.string().min(3),
  description: z.string().nullable().default(null),
  assigneeEmail: z.string().email().nullable().default(null),
  assigneeName: z.string().nullable().default(null),
  dueDate: z.string().nullable().default(null),
  projectHint: z.string().nullable().default(null),
  confidence: z.enum(["high", "medium", "low"]),
  evidence: z.string().min(3)
});

const ExtractionResultSchema = z.object({
  tasks: z.array(ExtractedTaskSchema)
});

type ExtractedTask = z.infer<typeof ExtractedTaskSchema>;

function buildPrompt(source: SourceItem): string {
  return JSON.stringify({
    instruction:
      "Extrage doar actiuni explicite din text. Titlul trebuie sa fie foarte scurt, in jur de 5 cuvinte. Descrierea pastreaza actiunea completa. Identifica termene explicite sau relative precum azi, maine, poimaine, pana marti, miercuri raportat la data curenta. Nu inventa deadline-uri, responsabili sau proiecte. Daca lipseste responsabilul, foloseste null. Daca lipseste termenul, foloseste null.",
    outputSchema: {
      tasks: [
        {
          title: "string scurt, aproximativ 5 cuvinte",
          description: "actiunea completa, string | null",
          assigneeEmail: "email | null",
          assigneeName: "nume persoana, echipa sau firma responsabila | null",
          dueDate: "YYYY-MM-DD | null, inclusiv din date relative",
          projectHint: "string | null",
          confidence: "high | medium | low",
          evidence: "fragment scurt din text care justifica taskul"
        }
      ]
    },
    source: {
      type: source.type,
      subject: source.subject,
      fromEmail: source.fromEmail,
      participants: source.participants,
      text: source.rawText
    }
  });
}

async function callAzureOpenAI(source: SourceItem): Promise<ExtractedTask[]> {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION ?? "2024-10-21";

  if (!endpoint || !apiKey || !deployment) {
    return fallbackExtractTasks(source);
  }

  const url = `${endpoint.replace(/\/$/, "")}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey
    },
    body: JSON.stringify({
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Esti un extractor de taskuri operationale. Returnezi JSON valid. Nu creezi taskuri finale, doar propuneri."
        },
        {
          role: "user",
          content: buildPrompt(source)
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Azure OpenAI extraction failed: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  const parsed = ExtractionResultSchema.parse(JSON.parse(content));
  return parsed.tasks;
}

function fallbackExtractTasks(source: SourceItem): ExtractedTask[] {
  const normalizeLine = (line: string) => line.replace(/\s+/g, " ").replace(/^[*\u2022-]\s*/, "").trim();
  const normalizeSearchText = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const isoDate = (date: Date) => date.toISOString().slice(0, 10);
  const addDays = (date: Date, days: number) => {
    const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    next.setUTCDate(next.getUTCDate() + days);
    return next;
  };
  const referenceDate = () => {
    const configured = process.env.LOCAL_TODAY;
    if (configured && /^\d{4}-\d{2}-\d{2}$/.test(configured)) return new Date(`${configured}T00:00:00.000Z`);
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  };
  const extractDueDate = (text: string, baseDate = referenceDate()) => {
    const normalized = normalizeSearchText(normalizeLine(text)).toLowerCase();
    const explicit = normalized.match(/\b(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?\b/);
    if (explicit) {
      const day = Number(explicit[1]);
      const month = Number(explicit[2]);
      let year = explicit[3] ? Number(explicit[3]) : baseDate.getUTCFullYear();
      if (year < 100) year += 2000;
      if (year < 2020 || year > 2035) return null;
      const candidate = new Date(Date.UTC(year, month - 1, day));
      if (candidate.getUTCFullYear() === year && candidate.getUTCMonth() === month - 1 && candidate.getUTCDate() === day) {
        return isoDate(candidate);
      }
    }

    if (/\bazi\b/.test(normalized)) return isoDate(baseDate);
    if (/\bpoimaine\b/.test(normalized)) return isoDate(addDays(baseDate, 2));
    if (/\bmaine\b/.test(normalized)) return isoDate(addDays(baseDate, 1));

    const weekdays = [["duminica"], ["luni"], ["marti"], ["miercuri"], ["joi"], ["vineri"], ["sambata"]];
    const today = baseDate.getUTCDay();
    for (let target = 0; target < weekdays.length; target += 1) {
      if (weekdays[target].some((day) => new RegExp(`\\b${day}\\b`, "i").test(normalized))) {
        const diff = (target - today + 7) % 7 || 7;
        return isoDate(addDays(baseDate, diff));
      }
    }

    return null;
  };
  const compactTaskTitle = (actionText: string) => {
    const normalized = normalizeSearchText(normalizeLine(actionText));
    const knownPatterns = [
      { pattern: /\bpoze\w*\b.*\bsondaj/i, title: "Transmite poze sondaj" },
      { pattern: /\bdraft\w*\b.*\braspuns\b.*\bautorizatie/i, title: "Pregateste raspuns autorizatie" },
      { pattern: /\bdisponibilitatea\b.*\bmembranei\b/i, title: "Confirma disponibilitate membrana" },
      { pattern: /\braspuns\b.*\bsondaj/i, title: "Transmite raspuns sondaj" },
      { pattern: /\blista\s+material\w*/i, title: "Trimite lista materiale" },
      { pattern: /\bmaterialele\b.*\bsondaj/i, title: "Transmite disponibilitate materiale" },
      { pattern: /\bdetali\w*\s+(?:de|pentru)\s+prinderi/i, title: "Pregateste detaliu prinderi" },
      { pattern: /\bclarific\w*\b.*\bacord\w*\s+tripartit/i, title: "Clarifica acord tripartit" },
      { pattern: /\bacord\w*\s+tripartit/i, title: "Transmite acord tripartit" },
      { pattern: /\bdraft\s+de\s+procedura/i, title: "Transmite draft procedura" },
      { pattern: /\barhiva\b.*\bverifica/i, title: "Verifica arhiva proiect" },
      { pattern: /\bcentralizator\w*\s+IMSAT/i, title: "Actualizeaza centralizator IMSAT" },
      { pattern: /\bvarianta\s+curata\b.*\btabel/i, title: "Transmite tabel curat client" },
      { pattern: /\bpersoana\b.*\bsemneaza/i, title: "Confirma semnatar minute" },
      { pattern: /\btransmit\w*\b.*\bsolutie/i, title: "Transmite solutie" },
      { pattern: /\bordinul?\s+de\s+incepere\b/i, title: "Transmite ordin incepere" },
      { pattern: /\boferta\s+finala\b/i, title: "Revine oferta finala" },
      { pattern: /\bmaterialele\b.*\bFM\b/i, title: "Verifica materiale FM" },
      { pattern: /\bavizele\b.*\bDSS\b.*\bscanat/i, title: "Scaneaza avize DSS" },
      { pattern: /\banex\w*\b.*\bcontract/i, title: "Transmite anexe contract" },
      { pattern: /\bstudiu\b.*\bsolutii\b.*\balternative/i, title: "Transmite studiu solutii" },
      { pattern: /\bprocedura\s+management\b/i, title: "Finalizeaza procedura management" },
      { pattern: /\bcerere\s+detalii\s+pentru\s+pereti/i, title: "Clarifica detalii pereti" },
      { pattern: /\banunt\s+ITM\b/i, title: "Pregateste anunt ITM" },
      { pattern: /\bdepozit\b.*\bmateriale\b/i, title: "Transmite detalii depozit materiale" },
      { pattern: /\bpuncte\s+complet/i, title: "Transmite puncte completare" }
    ];
    const known = knownPatterns.find((item) => item.pattern.test(normalized));
    if (known) return known.title;

    const fillerWords = new Set([
      "a", "ale", "al", "astazi", "catre", "cu", "de", "dimineata", "din", "in", "la", "maine", "marti", "miercuri", "pe", "pentru", "poimaine", "privind", "pt", "pana", "respectiv", "sa", "sau", "se", "si", "termenul", "un", "unei", "unui", "va", "vor"
    ]);
    const cleaned = normalized
      .replace(/^(te rog|va rog|ramane sa|de facut|trebuie sa|trebuie)\s+/i, "")
      .replace(/[.,;:]+$/g, "");
    const words = cleaned
      .split(/\s+/)
      .map((word) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}-]+$/gu, ""))
      .filter(Boolean)
      .filter((word, index) => index === 0 || !fillerWords.has(word.toLowerCase()))
      .slice(0, 5);
    const title = words.join(" ") || cleaned;
    return title.charAt(0).toUpperCase() + title.slice(1);
  };
  const structuredActionFromLine = (line: string) => {
    const normalized = normalizeLine(line);
    const terminalActorAction = normalized.match(/[\u2010-\u2015-]\s*([A-Z0-9]{2,}|[A-Z][\p{L}0-9&.\s]{1,30}?)\s+(transmite|transmit|trimite|clarifica|confirma)\b(.*)$/iu);
    if (terminalActorAction) {
      const assigneeName = terminalActorAction[1].trim().replace(/[\s\u2010-\u2015-]+$/g, "");
      const cleanAssigneeName = /^(de|se|ne|noi|acestia|acestea)$/i.test(assigneeName) ? null : assigneeName;
      const title = compactTaskTitle(`${terminalActorAction[2].trim()} ${terminalActorAction[3].trim()} ${normalized}`.trim());
      return {
        title,
        description: normalized,
        assigneeName: cleanAssigneeName && cleanAssigneeName.length <= 60 ? cleanAssigneeName : null,
        dueDate: extractDueDate(normalized)
      };
    }

    const structured = normalized.match(/^(?:(?:\d{1,2}\.\d{1,2}\.\d{4}|\d{4})\s*=\s*)?(.+?)\s+(trebuie|pregateste|pregatesc|transmite|transmit|trimite|verifica|verificat|actualizeaza|creeaza|preia|preluat|stabileste|confirma|clarifica|revine)\b(.*)$/i);
    if (!structured) return null;

    const rawAssigneeName = structured[1]
      .trim()
      .replace(/\s+(?:a|te rog|va rog)$/i, "")
      .replace(/[\s\u2010-\u2015-]+$/g, "")
      .trim();
    const passiveSubject = rawAssigneeName.match(/^(.+?)\s+se$/i)?.[1]?.trim() ?? null;
    const pronounSubject = /^(de|se|ne|noi|acestia|acestea)$/i.test(rawAssigneeName);
    const assigneeName = passiveSubject || pronounSubject ? null : rawAssigneeName;
    if (assigneeName && /^(te rog|ramane sa|de facut)$/i.test(assigneeName)) return null;

    const titleSubject = passiveSubject ? `${passiveSubject} ${structured[3].trim()}` : structured[3].trim();
    const title = compactTaskTitle(`${structured[2].trim()} ${titleSubject}`.trim());
    return {
      title,
      description: normalized,
      assigneeName: assigneeName && assigneeName.length <= 60 ? assigneeName : null,
      dueDate: extractDueDate(normalized)
    };
  };
  const assessConfidence = (input: {
    structured: boolean;
    assigneeName: string | null;
    dueDate: string | null;
    title: string;
  }): "high" | "medium" | "low" => {
    let score = 1;
    if (input.structured) score += 2;
    if (input.assigneeName) score += 2;
    if (input.dueDate) score += 1;
    if (input.title.split(/\s+/).filter(Boolean).length <= 5) score += 1;

    if (score >= 5) return "high";
    if (score >= 3) return "medium";
    return "low";
  };

  const lines = source.rawText
    .split(/\r?\n/)
    .flatMap((line) => (line.includes("=") ? [line] : line.split(/(?<=[.;])\s+/)))
    .map(normalizeLine)
    .filter(Boolean);

  const candidates = lines
    .filter((line) => !/^daca sunt elemente pe care le-am omis/i.test(line))
    .filter((line) => !/^ce este deja existent ramane/i.test(normalizeSearchText(line)))
    .filter((line) => !/^(taskuri|actiuni|de facut)\b/i.test(normalizeSearchText(line)))
    .filter((line) => !/:\s*$/.test(line))
    .filter((line) =>
      /\b(trebuie|de facut|rog|te rog|ramane|verifica|trimite|transmite|pregateste|pregatesc|actualizeaza|creeaza|preia|preluat|stabileste|confirma|clarifica)\b/i.test(normalizeSearchText(line))
      || /\b(verificat|revine|procedura\s+management|anex\w*\s+aferente|studiu\s+de\s+solutii|anunt\s+ITM)\b/i.test(normalizeSearchText(line))
    );

  return candidates.slice(0, 20).map((line) => {
    const structured = structuredActionFromLine(line);
    const title = structured?.title ?? compactTaskTitle(line);
    const dueDate = structured?.dueDate ?? extractDueDate(line);
    const assigneeName = structured?.assigneeName ?? null;
    return {
      title,
      description: structured?.description ?? line,
      assigneeEmail: null,
      assigneeName,
      dueDate,
      projectHint: null,
      confidence: assessConfidence({ structured: Boolean(structured), assigneeName, dueDate, title }),
      evidence: line
    };
  });
}

export async function extractProposedTasks(source: SourceItem): Promise<ProposedTask[]> {
  const now = new Date().toISOString();
  const extracted = await callAzureOpenAI(source);

  return extracted.map((task) => ({
    id: newId("ptask"),
    sourceId: source.id,
    title: task.title,
    description: task.description,
    assigneeEmail: task.assigneeEmail,
    assigneeName: task.assigneeName,
    dueDate: task.dueDate,
    projectHint: task.projectHint,
    confidence: task.confidence,
    priority: "normal",
    evidence: task.evidence,
    status: "proposed",
    approvedBy: null,
    approvedAt: null,
    plannerTaskId: null,
    visibility: "team",
    visibleToEmails: [],
    createdAt: now,
    updatedAt: now
  }));
}
