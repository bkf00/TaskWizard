export type GraphIntegrationConfig = {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  outlookUserId: string;
  outlookFolderId: string;
  webhookNotificationUrl: string;
  webhookClientState: string;
  lifecycleNotificationUrl: string | null;
  plannerPlanId: string;
  plannerBucketId: string;
};

export type OutlookFolderConfig = Pick<GraphIntegrationConfig, "outlookUserId" | "outlookFolderId">;
export type GraphSubscriptionConfig = Pick<
  GraphIntegrationConfig,
  "outlookUserId" | "outlookFolderId" | "webhookNotificationUrl" | "webhookClientState" | "lifecycleNotificationUrl"
>;
export type PlannerConfig = Pick<GraphIntegrationConfig, "plannerPlanId" | "plannerBucketId">;

function firstEnv(...names: string[]): string | null {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return null;
}

export function getGraphCredentialConfig(): Pick<GraphIntegrationConfig, "tenantId" | "clientId" | "clientSecret"> | null {
  const tenantId = firstEnv("GRAPH_TENANT_ID", "ENTRA_ID_TENANT_ID", "MICROSOFT_TENANT_ID");
  const clientId = firstEnv("GRAPH_CLIENT_ID", "ENTRA_ID_CLIENT_ID", "MICROSOFT_CLIENT_ID");
  const clientSecret = firstEnv("GRAPH_CLIENT_SECRET", "ENTRA_ID_CLIENT_SECRET", "MICROSOFT_CLIENT_SECRET");

  if (!tenantId || !clientId || !clientSecret) return null;
  return { tenantId, clientId, clientSecret };
}

export function getGraphIntegrationConfig(): GraphIntegrationConfig | null {
  const credentials = getGraphCredentialConfig();
  const outlook = getOutlookFolderConfig();
  const subscription = getGraphSubscriptionConfig();
  const planner = getPlannerConfig();

  if (!credentials || !outlook || !subscription || !planner) return null;

  return {
    ...credentials,
    ...outlook,
    ...subscription,
    ...planner
  };
}

export function getOutlookFolderConfig(): OutlookFolderConfig | null {
  const outlookUserId = firstEnv("OUTLOOK_USER_ID", "GRAPH_OUTLOOK_USER_ID");
  const outlookFolderId = firstEnv("OUTLOOK_FOLDER_ID", "GRAPH_OUTLOOK_FOLDER_ID");

  if (!outlookUserId || !outlookFolderId) return null;
  return { outlookUserId, outlookFolderId };
}

export function getGraphSubscriptionConfig(): GraphSubscriptionConfig | null {
  const outlook = getOutlookFolderConfig();
  const webhookNotificationUrl = firstEnv("GRAPH_WEBHOOK_NOTIFICATION_URL", "NEXT_PUBLIC_GRAPH_WEBHOOK_URL");
  const webhookClientState = firstEnv("GRAPH_WEBHOOK_CLIENT_STATE");

  if (!outlook || !webhookNotificationUrl || !webhookClientState) return null;

  return {
    ...outlook,
    webhookNotificationUrl,
    webhookClientState,
    lifecycleNotificationUrl: firstEnv("GRAPH_LIFECYCLE_NOTIFICATION_URL")
  };
}

export function getPlannerConfig(): PlannerConfig | null {
  const plannerPlanId = firstEnv("PLANNER_PLAN_ID", "GRAPH_PLANNER_PLAN_ID");
  const plannerBucketId = firstEnv("PLANNER_BUCKET_ID", "GRAPH_PLANNER_BUCKET_ID");

  if (!plannerPlanId || !plannerBucketId) return null;
  return { plannerPlanId, plannerBucketId };
}

export function isGraphConfigured(): boolean {
  return Boolean(getGraphCredentialConfig());
}

export function isMicrosoft365IntegrationConfigured(): boolean {
  return Boolean(getGraphIntegrationConfig());
}
