import { newId } from "./ids";
import type { ProposedTask } from "./types";
import { audit } from "@repo/audit/audit";
import { createPlannerTask } from "@repo/graph/planner";
import { store } from "@repo/storage/local-store";

export async function approveTask(input: {
  taskId: string;
  actorEmail: string;
  patch?: Partial<Pick<ProposedTask, "title" | "description" | "assigneeEmail" | "dueDate" | "projectHint">>;
}): Promise<ProposedTask> {
  const task = await store.getProposedTask(input.taskId);
  if (!task) {
    throw new Error("Taskul propus nu exista.");
  }
  if (task.status !== "proposed" && task.status !== "planner_sync_failed") {
    throw new Error(`Taskul nu poate fi aprobat din statusul ${task.status}.`);
  }

  const now = new Date().toISOString();
  const approved: ProposedTask = {
    ...task,
    ...input.patch,
    status: "approved",
    approvedBy: input.actorEmail,
    approvedAt: now,
    updatedAt: now
  };
  await store.saveProposedTask(approved);
  await audit({
    type: "task.approved",
    actorEmail: input.actorEmail,
    sourceId: approved.sourceId,
    proposedTaskId: approved.id,
    message: "Taskul a fost aprobat."
  });

  try {
    const plannerTask = await createPlannerTask({
      title: approved.title,
      description: approved.description,
      dueDate: approved.dueDate
    });

    const synced: ProposedTask = {
      ...approved,
      status: "created_in_planner",
      plannerTaskId: plannerTask.id,
      updatedAt: new Date().toISOString()
    };
    await store.saveProposedTask(synced);
    await audit({
      type: "task.planner_created",
      actorEmail: input.actorEmail,
      sourceId: synced.sourceId,
      proposedTaskId: synced.id,
      message: "Taskul a fost creat in Planner.",
      metadata: { plannerTaskId: plannerTask.id }
    });
    return synced;
  } catch (error) {
    const failed: ProposedTask = {
      ...approved,
      status: "planner_sync_failed",
      updatedAt: new Date().toISOString()
    };
    await store.saveProposedTask(failed);
    await store.addProcessingError({
      id: newId("perr"),
      sourceId: failed.sourceId,
      proposedTaskId: failed.id,
      stage: "planner_sync",
      message: error instanceof Error ? error.message : "Unknown Planner sync error",
      retryable: true,
      createdAt: new Date().toISOString()
    });
    await audit({
      type: "task.planner_failed",
      actorEmail: input.actorEmail,
      sourceId: failed.sourceId,
      proposedTaskId: failed.id,
      message: "Crearea taskului in Planner a esuat.",
      metadata: { error: error instanceof Error ? error.message : "Unknown error" }
    });
    return failed;
  }
}

export async function updateProposedTask(input: {
  taskId: string;
  actorEmail: string;
  patch: Partial<Pick<ProposedTask, "title" | "description" | "assigneeEmail" | "assigneeName" | "dueDate" | "projectHint">>;
}): Promise<ProposedTask> {
  const task = await store.getProposedTask(input.taskId);
  if (!task) {
    throw new Error("Taskul propus nu exista.");
  }
  if (task.status !== "proposed" && task.status !== "planner_sync_failed") {
    throw new Error(`Taskul nu poate fi editat din statusul ${task.status}.`);
  }

  const title = input.patch.title?.trim();
  if (title !== undefined && title.length < 3) {
    throw new Error("Titlul taskului trebuie sa aiba cel putin 3 caractere.");
  }

  const updated: ProposedTask = {
    ...task,
    ...input.patch,
    title: title ?? task.title,
    description: input.patch.description?.trim() || null,
    assigneeEmail: input.patch.assigneeEmail?.trim() || null,
    assigneeName: input.patch.assigneeName?.trim() || null,
    dueDate: input.patch.dueDate?.trim() || null,
    projectHint: input.patch.projectHint?.trim() || null,
    updatedAt: new Date().toISOString()
  };

  await store.saveProposedTask(updated);
  await audit({
    type: "task.updated",
    actorEmail: input.actorEmail,
    sourceId: updated.sourceId,
    proposedTaskId: updated.id,
    message: "Taskul propus a fost editat.",
    metadata: { fields: Object.keys(input.patch) }
  });

  return updated;
}

export async function rejectTask(input: {
  taskId: string;
  actorEmail: string;
}): Promise<ProposedTask> {
  const task = await store.getProposedTask(input.taskId);
  if (!task) {
    throw new Error("Taskul propus nu exista.");
  }
  if (task.status !== "proposed") {
    throw new Error(`Taskul nu poate fi respins din statusul ${task.status}.`);
  }

  const rejected: ProposedTask = {
    ...task,
    status: "rejected",
    updatedAt: new Date().toISOString()
  };

  await store.saveProposedTask(rejected);
  await audit({
    type: "task.rejected",
    actorEmail: input.actorEmail,
    sourceId: rejected.sourceId,
    proposedTaskId: rejected.id,
    message: "Taskul a fost respins."
  });

  return rejected;
}

const plannerTerminalSourceStatuses = new Set<ProposedTask["status"]>([
  "approved",
  "created_in_planner",
  "planner_sync_failed"
]);

export async function markTaskCompleted(input: {
  taskId: string;
  actorEmail: string;
}): Promise<ProposedTask> {
  const task = await store.getProposedTask(input.taskId);
  if (!task) {
    throw new Error("Taskul propus nu exista.");
  }
  if (!plannerTerminalSourceStatuses.has(task.status)) {
    throw new Error(`Taskul nu poate fi marcat terminat din statusul ${task.status}.`);
  }

  const completed: ProposedTask = {
    ...task,
    status: "completed_in_planner",
    updatedAt: new Date().toISOString()
  };

  await store.saveProposedTask(completed);
  await audit({
    type: "task.completed",
    actorEmail: input.actorEmail,
    sourceId: completed.sourceId,
    proposedTaskId: completed.id,
    message: "Taskul a fost marcat ca terminat.",
    metadata: { previousStatus: task.status, plannerTaskId: task.plannerTaskId }
  });

  return completed;
}

export async function markTaskDeleted(input: {
  taskId: string;
  actorEmail: string;
}): Promise<ProposedTask> {
  const task = await store.getProposedTask(input.taskId);
  if (!task) {
    throw new Error("Taskul propus nu exista.");
  }
  if (!plannerTerminalSourceStatuses.has(task.status)) {
    throw new Error(`Taskul nu poate fi marcat sters din statusul ${task.status}.`);
  }

  const deleted: ProposedTask = {
    ...task,
    status: "deleted_in_planner",
    updatedAt: new Date().toISOString()
  };

  await store.saveProposedTask(deleted);
  await audit({
    type: "task.deleted",
    actorEmail: input.actorEmail,
    sourceId: deleted.sourceId,
    proposedTaskId: deleted.id,
    message: "Taskul a fost marcat ca sters din Planner.",
    metadata: { previousStatus: task.status, plannerTaskId: task.plannerTaskId }
  });

  return deleted;
}
