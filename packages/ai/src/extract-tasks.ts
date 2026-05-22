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
      "Extrage doar actiuni explicite din text. Nu inventa deadline-uri, responsabili sau proiecte. Daca lipseste responsabilul, foloseste null. Daca lipseste termenul, foloseste null.",
    outputSchema: {
      tasks: [
        {
          title: "string",
          description: "string | null",
          assigneeEmail: "email | null",
          assigneeName: "nume persoana, echipa sau firma responsabila | null",
          dueDate: "YYYY-MM-DD | null",
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
  const structuredActionFromLine = (line: string) => {
    const normalized = normalizeLine(line);
    const structured = normalized.match(/^(?:(?:\d{1,2}\.\d{1,2}\.\d{4}|\d{4})\s*=\s*)?(.+?)\s+(trebuie|pregateste|pregatesc|transmite|transmit|trimite|verifica|actualizeaza|creeaza|preia|preluat|stabileste|confirma|clarifica)\b(.*)$/i);
    if (!structured) return null;

    const assigneeName = structured[1].trim().replace(/\s+a$/i, "");
    if (/^(te rog|ramane sa|de facut)$/i.test(assigneeName)) return null;

    const title = `${structured[2].trim()} ${structured[3].trim()}`.trim();
    return {
      title: title.length > 110 ? `${title.slice(0, 107)}...` : title,
      description: normalized,
      assigneeName: assigneeName.length <= 60 ? assigneeName : null
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
      title: structured?.title ?? (line.length > 90 ? `${line.slice(0, 87)}...` : line),
      description: structured?.description ?? line,
      assigneeEmail: null,
      assigneeName: structured?.assigneeName ?? null,
      dueDate: null,
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
