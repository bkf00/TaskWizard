import { z } from "zod";
import type { ProposedTask, SourceItem } from "@repo/domain/types";
import { newId } from "@repo/domain/ids";

const ExtractedTaskSchema = z.object({
  title: z.string().min(3),
  description: z.string().nullable().default(null),
  assigneeEmail: z.string().email().nullable().default(null),
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
  const lines = source.rawText
    .split(/\r?\n|[.;]/)
    .map((line) => line.trim())
    .filter(Boolean);

  const candidates = lines.filter((line) =>
    /\b(trebuie|de facut|rog|te rog|ramane|verifica|trimite|pregateste|actualizeaza|creeaza)\b/i.test(line)
  );

  return candidates.slice(0, 5).map((line) => ({
    title: line.length > 90 ? `${line.slice(0, 87)}...` : line,
    description: line,
    assigneeEmail: null,
    dueDate: null,
    projectHint: null,
    confidence: "low",
    evidence: line
  }));
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

