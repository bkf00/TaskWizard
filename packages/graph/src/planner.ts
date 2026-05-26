import { graphRequest } from "./client";
import { getGraphCredentialConfig, getPlannerConfig } from "./config";

export function isPlannerConfigured(): boolean {
  return Boolean(getPlannerConfig() && getGraphCredentialConfig());
}

export async function createPlannerTask(input: {
  title: string;
  description?: string | null;
  assigneeAadId?: string | null;
  dueDate?: string | null;
}): Promise<{ id: string }> {
  const plannerConfig = getPlannerConfig();
  const planId = plannerConfig?.plannerPlanId;
  const bucketId = plannerConfig?.plannerBucketId;

  if (!isPlannerConfigured() || !planId || !bucketId) {
    throw new Error("Planner plan/bucket are not configured.");
  }

  const assignments = input.assigneeAadId
    ? {
        [input.assigneeAadId]: {
          "@odata.type": "#microsoft.graph.plannerAssignment",
          orderHint: " !"
        }
      }
    : {};

  const taskBody = {
    planId,
    bucketId,
    title: input.title,
    ...(input.dueDate ? { dueDateTime: `${input.dueDate}T17:00:00Z` } : {}),
    assignments
  };

  const task = await graphRequest<{ id: string }>("/planner/tasks", {
    method: "POST",
    body: taskBody
  });

  if (input.description) {
    await graphRequest(`/planner/tasks/${task.id}/details`, {
      method: "PATCH",
      headers: {
        "If-Match": "*"
      },
      body: {
        description: input.description
      }
    });
  }

  return { id: task.id };
}
