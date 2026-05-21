import type { SourceItem, SourceType } from "./types";
import { addDays, hashSource, newId } from "./ids";
import { audit } from "@repo/audit/audit";
import { extractProposedTasks } from "@repo/ai/extract-tasks";
import { store } from "@repo/storage/local-store";

export async function ingestManualSource(input: {
  type: SourceType;
  subject: string;
  rawText: string;
  fromEmail?: string | null;
  participants?: string[];
  externalId?: string | null;
  actorEmail?: string | null;
}): Promise<{ source: SourceItem; createdTaskCount: number; duplicate: boolean }> {
  const sourceHash = hashSource({
    type: input.type,
    externalId: input.externalId,
    subject: input.subject,
    rawText: input.rawText
  });

  const existing = await store.findSourceByHash(sourceHash);
  if (existing) {
    await audit({
      type: "source.duplicate_ignored",
      actorEmail: input.actorEmail,
      sourceId: existing.id,
      message: "Sursa a fost ignorata pentru ca exista deja.",
      metadata: { sourceHash }
    });
    return { source: existing, createdTaskCount: 0, duplicate: true };
  }

  const now = new Date();
  const source: SourceItem = {
    id: newId("src"),
    type: input.type,
    externalId: input.externalId ?? null,
    sourceHash,
    subject: input.subject,
    fromEmail: input.fromEmail ?? null,
    participants: input.participants ?? [],
    rawText: input.rawText,
    receivedAt: now.toISOString(),
    retentionUntil: addDays(now, 60).toISOString(),
    status: "processing",
    errorMessage: null
  };

  await store.saveSource(source);
  await audit({
    type: "source.received",
    actorEmail: input.actorEmail,
    sourceId: source.id,
    message: "Sursa a fost primita pentru procesare.",
    metadata: { type: source.type, subject: source.subject }
  });

  try {
    await audit({
      type: "source.extraction_started",
      actorEmail: input.actorEmail,
      sourceId: source.id,
      message: "Extractia AI a inceput."
    });

    const proposedTasks = await extractProposedTasks(source);
    await store.saveProposedTasks(proposedTasks);

    source.status = "processed";
    await store.saveSource(source);

    await audit({
      type: "source.extraction_completed",
      actorEmail: input.actorEmail,
      sourceId: source.id,
      message: "Extractia AI s-a finalizat.",
      metadata: { proposedTaskCount: proposedTasks.length }
    });

    return { source, createdTaskCount: proposedTasks.length, duplicate: false };
  } catch (error) {
    source.status = "failed";
    source.errorMessage = error instanceof Error ? error.message : "Unknown extraction error";
    await store.saveSource(source);
    await store.addProcessingError({
      id: newId("perr"),
      sourceId: source.id,
      proposedTaskId: null,
      stage: "ai_extraction",
      message: source.errorMessage,
      retryable: true,
      createdAt: new Date().toISOString()
    });
    await audit({
      type: "source.extraction_failed",
      actorEmail: input.actorEmail,
      sourceId: source.id,
      message: "Extractia AI a esuat.",
      metadata: { error: source.errorMessage }
    });
    throw error;
  }
}

