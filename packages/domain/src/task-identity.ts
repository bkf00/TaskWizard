import type { ProposedTask } from "./types";

function normalizeIdentityPart(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function taskIdentityKey(task: Pick<ProposedTask, "title" | "dueDate" | "assigneeEmail" | "assigneeName">): string | null {
  const title = normalizeIdentityPart(task.title);
  const dueDate = normalizeIdentityPart(task.dueDate);
  const assignee = normalizeIdentityPart(task.assigneeEmail) || normalizeIdentityPart(task.assigneeName);

  if (!title || !dueDate || !assignee) return null;

  return [title, dueDate, assignee].join("|");
}

export function removeDuplicateTaskIdentities<T extends Pick<ProposedTask, "title" | "dueDate" | "assigneeEmail" | "assigneeName">>(
  candidates: T[],
  existingTasks: Array<Pick<ProposedTask, "title" | "dueDate" | "assigneeEmail" | "assigneeName">>
): { uniqueTasks: T[]; duplicateCount: number } {
  const seen = new Set(existingTasks.map(taskIdentityKey).filter((key): key is string => Boolean(key)));
  const uniqueTasks: T[] = [];
  let duplicateCount = 0;

  for (const candidate of candidates) {
    const key = taskIdentityKey(candidate);
    if (!key) {
      uniqueTasks.push(candidate);
      continue;
    }
    if (seen.has(key)) {
      duplicateCount += 1;
      continue;
    }

    seen.add(key);
    uniqueTasks.push(candidate);
  }

  return { uniqueTasks, duplicateCount };
}
