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
  const normalizeLine = (line: string) => line.replace(/\s+/g, " ").replace(/^[*•-]\s*/, "").trim();
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
    const normalized = normalizeLine(text).toLowerCase();
    const explicit = normalized.match(/\b(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?\b/);
    if (explicit) {
      const day = Number(explicit[1]);
      const month = Number(explicit[2]);
      let year = explicit[3] ? Number(explicit[3]) : baseDate.getUTCFullYear();
      if (year < 100) year += 2000;
      const candidate = new Date(Date.UTC(year, month - 1, day));
      if (candidate.getUTCFullYear() === year && candidate.getUTCMonth() === month - 1 && candidate.getUTCDate() === day) {
        return isoDate(candidate);
      }
    }

    if (/\bazi\b/.test(normalized)) return isoDate(baseDate);
    if (/\bpoimaine\b/.test(normalized)) return isoDate(addDays(baseDate, 2));
    if (/\bmaine\b/.test(normalized)) return isoDate(addDays(baseDate, 1));

    const weekdays = [
      ["duminica", "duminică"],
      ["luni"],
      ["marti", "marți"],
      ["miercuri"],
      ["joi"],
      ["vineri"],
      ["sambata", "sâmbătă"]
    ];
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
    const normalized = normalizeLine(actionText);
    const knownPatterns = [
      { pattern: /\braspuns\b.*\bsondaj/i, title: "Transmite raspuns sondaj" },
      { pattern: /\bmaterialele\b.*\bsondaj/i, title: "Transmite disponibilitate materiale" },
      { pattern: /\bdetali\w*\s+(?:de|pentru)\s+prinderi/i, title: "Pregateste detaliu prinderi" },
      { pattern: /\bacord\s+tripartit/i, title: "Transmite acord tripartit" },
      { pattern: /\bdraft\s+de\s+procedura/i, title: "Transmite draft procedura" },
      { pattern: /\barhiva\b.*\bverifica/i, title: "Verifica arhiva proiect" }
    ];
    const known = knownPatterns.find((item) => item.pattern.test(normalized));
    if (known) return known.title;

    const fillerWords = new Set([
      "a",
      "ale",
      "al",
      "catre",
      "cu",
      "de",
      "din",
      "in",
      "la",
      "pe",
      "pentru",
      "privind",
      "pt",
      "respectiv",
      "sa",
      "se",
      "si",
      "un",
      "unei",
      "unui",
      "va",
      "vor"
    ]);
    const cleaned = normalized
      .replace(/^(te rog|va rog|ramane sa|de facut)\s+/i, "")
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
    const structured = normalized.match(/^(?:(?:\d{1,2}\.\d{1,2}\.\d{4}|\d{4})\s*=\s*)?(.+?)\s+(trebuie|pregateste|pregatesc|transmite|transmit|trimite|verifica|actualizeaza|creeaza|preia|preluat|stabileste|confirma|clarifica)\b(.*)$/i);
    if (!structured) return null;

    const assigneeName = structured[1].trim().replace(/\s+a$/i, "");
    if (/^(te rog|ramane sa|de facut)$/i.test(assigneeName)) return null;

    const title = compactTaskTitle(`${structured[2].trim()} ${structured[3].trim()}`.trim());
    return {
      title,
      description: normalized,
      assigneeName: assigneeName.length <= 60 ? assigneeName : null,
      dueDate: extractDueDate(normalized)
    };
  };

  const lines = source.rawText
    .split(/\r?\n/)
    .flatMap((line) => (line.includes("=") ? [line] : line.split(/(?<=[.;])\s+/)))
    .map(normalizeLine)
    .filter(Boolean);

  const candidates = lines
    .filter((line) => !/^daca sunt elemente pe care le-am omis/i.test(line))
    .filter((line) =>
      /\b(trebuie|de facut|rog|te rog|ramane|verifica|trimite|transmite|pregateste|pregatesc|actualizeaza|creeaza|preia|preluat|stabileste|confirma|clarifica)\b/i.test(line)
    );

  return candidates.slice(0, 5).map((line) => {
    const structured = structuredActionFromLine(line);
    return {
      title: structured?.title ?? compactTaskTitle(line),
      description: structured?.description ?? line,
      assigneeEmail: null,
      assigneeName: structured?.assigneeName ?? null,
      dueDate: structured?.dueDate ?? extractDueDate(line),
      projectHint: null,
      confidence: structured ? "medium" : "low",
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
    evidence: task.evidence,
    status: "proposed",
    approvedBy: null,
    approvedAt: null,
    plannerTaskId: null,
    createdAt: now,
    updatedAt: now
  }));
}
