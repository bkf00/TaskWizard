import type { ProposedTask } from "./types";

function todayIsoDate(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isTaskOverdue(task: Pick<ProposedTask, "dueDate">, now = new Date()): boolean {
  return Boolean(task.dueDate && task.dueDate < todayIsoDate(now));
}

export function effectiveTaskPriority(task: Pick<ProposedTask, "dueDate" | "priority">, now = new Date()): "urgent" | "high" | "normal" {
  if (isTaskOverdue(task, now)) return "urgent";
  return task.priority === "high" ? "high" : "normal";
}
