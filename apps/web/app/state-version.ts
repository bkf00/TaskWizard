import { store } from "@repo/storage/local-store";
import { filterVisibleTasks } from "@repo/domain/privacy";

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

export async function getDashboardStateVersion(actorEmail?: string | null): Promise<DashboardStateVersion> {
  const [sources, tasks, errors, auditEvents] = await Promise.all([
    store.listSources(),
    store.listProposedTasks(),
    store.listProcessingErrors(),
    store.listAuditEvents()
  ]);
  const visibleTasks = filterVisibleTasks(tasks, actorEmail);

  const latestChangedAt = latest([
    ...visibleTasks.map((task) => task.updatedAt),
    ...auditEvents.map((event) => event.createdAt),
    ...errors.map((error) => error.createdAt),
    ...sources.map((source) => source.receivedAt)
  ]);

  return {
    version: [
      latestChangedAt ?? "empty",
      `tasks:${visibleTasks.length}`,
      `audit:${auditEvents.length}`,
      `errors:${errors.length}`,
      `sources:${sources.length}`
    ].join("|"),
    tasks: visibleTasks.length,
    auditEvents: auditEvents.length,
    errors: errors.length,
    sources: sources.length,
    latestChangedAt
  };
}
