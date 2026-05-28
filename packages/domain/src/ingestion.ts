import type { SourceItem, SourceType } from "./types";
import { addDays, hashSource, newId } from "./ids";
import { audit } from "@repo/audit/audit";
import { extractProposedTasks } from "@repo/ai/extract-tasks";
import { store } from "@repo/storage/local-store";
import { removeDuplicateTaskIdentities } from "./task-identity";
import { applyTaskVisibility, classifySourcePrivacy } from "./privacy";

export async function ingestManualSource(input: {
  type: SourceType;
  subject: string;
  rawText: string;
  fromEmail?: string | null;
  participants?: string[];
  externalId?: string | null;
  actorEmail?: string | null;
}): Promise<{ source: SourceItem; createdTaskCount: number; duplicate: boolean }> {
  const privacy = classifySourcePrivacy({
    fromEmail: input.fromEmail,
    participants: input.participants
  });
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
  if (privacy.action === "block") {
    const ignoredSource: SourceItem = {
      id: newId("src"),
      type: input.type,
      externalId: input.externalId ?? null,
      sourceHash,
      subject: input.subject,
      fromEmail: input.fromEmail ?? null,
      participants: input.participants ?? [],
      rawText: "",
      receivedAt: now.toISOString(),
      retentionUntil: addDays(now, 60).toISOString(),
      status: "ignored_privacy",
      errorMessage: null
    };

    await store.saveSource(ignoredSource);
    await audit({
      type: "source.privacy_ignored",
      actorEmail: input.actorEmail,
      sourceId: ignoredSource.id,
      message: "Sursa a fost ignorata de regulile locale de privacy.",
      metadata: { reason: "blocked_source_email" }
    });

    return { source: ignoredSource, createdTaskCount: 0, duplicate: false };
  }

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

    const proposedTasks = applyTaskVisibility(await extractProposedTasks(source), privacy);
    const existingTasks = await store.listProposedTasks();
    const { uniqueTasks, duplicateCount } = removeDuplicateTaskIdentities(proposedTasks, existingTasks);
    await store.saveProposedTasks(uniqueTasks);

    source.status = "processed";
    await store.saveSource(source);

    if (duplicateCount > 0) {
      await audit({
        type: "task.duplicate_ignored",
        actorEmail: input.actorEmail,
        sourceId: source.id,
        message: `${duplicateCount} taskuri identice au fost ignorate.`,
        metadata: { duplicateTaskCount: duplicateCount }
      });
    }

    await audit({
      type: "source.extraction_completed",
      actorEmail: input.actorEmail,
      sourceId: source.id,
      message: "Extractia AI s-a finalizat.",
      metadata: { proposedTaskCount: uniqueTasks.length, duplicateTaskCount: duplicateCount }
    });

    return { source, createdTaskCount: uniqueTasks.length, duplicate: false };
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
