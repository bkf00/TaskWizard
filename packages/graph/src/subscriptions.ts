import { graphRequest } from "./client";
import { getGraphSubscriptionConfig } from "./config";
import { buildOutlookFolderSubscriptionResource } from "./outlook";

export type GraphSubscriptionRequest = {
  changeType: "created" | "updated" | "deleted" | "created,updated";
  notificationUrl: string;
  lifecycleNotificationUrl?: string;
  resource: string;
  expirationDateTime: string;
  clientState: string;
};

export type GraphSubscription = GraphSubscriptionRequest & {
  id: string;
};

export function getDefaultSubscriptionExpiration(hours = 48): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

export function buildOutlookSubscriptionRequest(input?: {
  expirationDateTime?: string;
  notificationUrl?: string;
  lifecycleNotificationUrl?: string | null;
}): GraphSubscriptionRequest {
  const config = getGraphSubscriptionConfig();
  if (!config) throw new Error("Graph subscription integration is not configured.");

  return {
    changeType: "created,updated",
    notificationUrl: input?.notificationUrl ?? config.webhookNotificationUrl,
    ...(input?.lifecycleNotificationUrl ?? config.lifecycleNotificationUrl
      ? { lifecycleNotificationUrl: input?.lifecycleNotificationUrl ?? config.lifecycleNotificationUrl ?? undefined }
      : {}),
    resource: buildOutlookFolderSubscriptionResource({
      userId: config.outlookUserId,
      folderId: config.outlookFolderId
    }),
    expirationDateTime: input?.expirationDateTime ?? getDefaultSubscriptionExpiration(),
    clientState: config.webhookClientState
  };
}

export async function createGraphSubscription(input: GraphSubscriptionRequest): Promise<GraphSubscription> {
  return graphRequest<GraphSubscription>("/subscriptions", {
    method: "POST",
    body: input
  });
}

export async function renewGraphSubscription(input: {
  subscriptionId: string;
  expirationDateTime: string;
}): Promise<GraphSubscription> {
  return graphRequest<GraphSubscription>(`/subscriptions/${input.subscriptionId}`, {
    method: "PATCH",
    body: { expirationDateTime: input.expirationDateTime }
  });
}

export async function createOutlookFolderSubscription(): Promise<GraphSubscription> {
  return createGraphSubscription(buildOutlookSubscriptionRequest());
}
