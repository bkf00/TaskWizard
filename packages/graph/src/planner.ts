import { getGraphAppToken } from "./auth";

export function isPlannerConfigured(): boolean {
  return Boolean(
    process.env.PLANNER_PLAN_ID &&
      process.env.PLANNER_BUCKET_ID &&
      process.env.GRAPH_TENANT_ID &&
      process.env.GRAPH_CLIENT_ID &&
      process.env.GRAPH_CLIENT_SECRET
  );
}

export async function createPlannerTask(input: {
  title: string;
  description?: string | null;
  assigneeAadId?: string | null;
  dueDate?: string | null;
}): Promise<{ id: string }> {
  const planId = process.env.PLANNER_PLAN_ID;
  const bucketId = process.env.PLANNER_BUCKET_ID;

  if (!isPlannerConfigured() || !planId || !bucketId) {
    throw new Error("Planner plan/bucket are not configured.");
  }

  const accessToken = await getGraphAppToken();
  const assignments = input.assigneeAadId
    ? {
        [input.assigneeAadId]: {
          "@odata.type": "#microsoft.graph.plannerAssignment",
          orderHint: " !"
        }
      }
    : {};

  const response = await fetch("https://graph.microsoft.com/v1.0/planner/tasks", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      planId,
      bucketId,
      title: input.title,
      dueDateTime: input.dueDate,
      assignments
    })
  });

  if (!response.ok) {
    throw new Error(`Planner task creation failed: ${response.status} ${await response.text()}`);
  }

  const task = await response.json();

  if (input.description) {
    await fetch(`https://graph.microsoft.com/v1.0/planner/tasks/${task.id}/details`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "If-Match": "*"
      },
      body: JSON.stringify({
        description: input.description
      })
    });
  }

  return { id: task.id };
}
