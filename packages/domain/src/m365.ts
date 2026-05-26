import { audit } from "@repo/audit/audit";
import { listOutlookFolderMessages, mapOutlookMessageToSourceInput } from "@repo/graph/outlook";
import { createOutlookFolderSubscription } from "@repo/graph/subscriptions";
import { store } from "@repo/storage/local-store";
import { newId } from "./ids";
import { ingestManualSource } from "./ingestion";

export async function syncOutlookFolderToSources(input: {
  actorEmail?: string | null;
  maxPages?: number;
  top?: number;
  sinceDateTime?: string | null;
} = {}): Promise<{ scanned: number; createdSources: number; createdTasks: number; duplicates: number }> {
  await audit({
    type: "outlook.sync_started",
    actorEmail: input.actorEmail,
    message: "Sincronizarea folderului Outlook a inceput.",
    metadata: { top: input.top, maxPages: input.maxPages, sinceDateTime: input.sinceDateTime }
  });
  console.info("[m365] outlook sync started", { top: input.top, maxPages: input.maxPages });

  try {
    const messages = await listOutlookFolderMessages({
      top: input.top,
      maxPages: input.maxPages,
      sinceDateTime: input.sinceDateTime
    });
    let createdSources = 0;
    let createdTasks = 0;
    let duplicates = 0;

    for (const message of messages) {
      const result = await ingestManualSource(mapOutlookMessageToSourceInput(message));
      if (result.duplicate) {
        duplicates += 1;
      } else {
        createdSources += 1;
        createdTasks += result.createdTaskCount;
      }
    }

    await audit({
      type: "outlook.sync_completed",
      actorEmail: input.actorEmail,
      message: "Sincronizarea folderului Outlook s-a finalizat.",
      metadata: { scanned: messages.length, createdSources, createdTasks, duplicates }
    });
    console.info("[m365] outlook sync completed", { scanned: messages.length, createdSources, createdTasks, duplicates });

    return { scanned: messages.length, createdSources, createdTasks, duplicates };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Outlook sync error";
    await store.addProcessingError({
      id: newId("perr"),
      sourceId: null,
      proposedTaskId: null,
      stage: "graph",
      message,
      retryable: true,
      createdAt: new Date().toISOString()
    });
    await audit({
      type: "outlook.sync_failed",
      actorEmail: input.actorEmail,
      message: "Sincronizarea folderului Outlook a esuat.",
      metadata: { error: message }
    });
    console.error("[m365] outlook sync failed", { error: message });
    throw error;
  }
}

export async function provisionOutlookSubscription(input: { actorEmail?: string | null } = {}) {
  const subscription = await createOutlookFolderSubscription();
  await audit({
    type: "graph.subscription_created",
    actorEmail: input.actorEmail,
    message: "Subscription Graph pentru folderul Outlook a fost creat.",
    metadata: {
      subscriptionId: subscription.id,
      resource: subscription.resource,
      expirationDateTime: subscription.expirationDateTime
    }
  });
  console.info("[m365] graph subscription created", {
    subscriptionId: subscription.id,
    resource: subscription.resource,
    expirationDateTime: subscription.expirationDateTime
  });
  return subscription;
}
