import { store } from "@repo/storage/local-store";

export type DashboardStateVersion = {
  version: string;
  tasks: number;
  auditEvents: number;
  errors: number;
  sources: number;
  latestChangedAt: string | null;
};

function latest(values: Array<string | null | undefined>): string | null {
  let latestValue: string | null = null;
  for (const value of values) {
    if (value && (!latestValue || value > latestValue)) latestValue = value;
  }
  return latestValue;
}

export async function getDashboardStateVersion(): Promise<DashboardStateVersion> {
  const [sources, tasks, errors, auditEvents] = await Promise.all([
    store.listSources(),
    store.listProposedTasks(),
    store.listProcessingErrors(),
    store.listAuditEvents()
  ]);

  const latestChangedAt = latest([
    ...tasks.map((task) => task.updatedAt),
    ...auditEvents.map((event) => event.createdAt),
    ...errors.map((error) => error.createdAt),
    ...sources.map((source) => source.receivedAt)
  ]);

  return {
    version: [
      latestChangedAt ?? "empty",
      `tasks:${tasks.length}`,
      `audit:${auditEvents.length}`,
      `errors:${errors.length}`,
      `sources:${sources.length}`
    ].join("|"),
    tasks: tasks.length,
    auditEvents: auditEvents.length,
    errors: errors.length,
    sources: sources.length,
    latestChangedAt
  };
}
