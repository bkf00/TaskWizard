import assert from "node:assert/strict";
import test from "node:test";
import { cleanAssigneeName } from "@repo/domain/assignee";
import { filterVisibleTasks } from "@repo/domain/privacy";
import { removeDuplicateTaskIdentities } from "@repo/domain/task-identity";
import { effectiveTaskPriority, isTaskOverdue } from "@repo/domain/task-urgency";
import type { ProposedTask } from "@repo/domain/types";

function task(overrides: Partial<ProposedTask> = {}): ProposedTask {
  return {
    id: "ptask_test",
    sourceId: "src_test",
    title: "Verifica documentatie",
    description: "Descriere",
    assigneeEmail: null,
    assigneeName: "Bogdan",
    dueDate: "2026-06-10",
    projectHint: null,
    confidence: "high",
    priority: "normal",
    evidence: "Bogdan verifica documentatia pana maine.",
    status: "proposed",
    approvedBy: null,
    approvedAt: null,
    plannerTaskId: null,
    visibility: "team",
    visibleToEmails: [],
    createdAt: "2026-06-09T08:00:00.000Z",
    updatedAt: "2026-06-09T08:00:00.000Z",
    ...overrides
  };
}

test("assignee sanitizer removes false Romanian pronouns", () => {
  assert.equal(cleanAssigneeName("Ne"), null);
  assert.equal(cleanAssigneeName("Se"), null);
  assert.equal(cleanAssigneeName("De"), null);
  assert.equal(cleanAssigneeName("AVT –"), "AVT");
});

test("overdue tasks become urgent without mutating saved priority", () => {
  const now = new Date("2026-06-09T10:00:00.000Z");
  const overdue = task({ dueDate: "2026-06-08", priority: "normal" });
  const future = task({ dueDate: "2026-06-10", priority: "high" });

  assert.equal(isTaskOverdue(overdue, now), true);
  assert.equal(effectiveTaskPriority(overdue, now), "urgent");
  assert.equal(effectiveTaskPriority(future, now), "high");
});

test("duplicate identity requires title, date and assignee", () => {
  const existing = [task({ title: "Trimite oferta", dueDate: "2026-06-10", assigneeName: "Sika" })];
  const candidates = [
    task({ id: "same", title: "trimite oferta", dueDate: "2026-06-10", assigneeName: "SIKA" }),
    task({ id: "different-date", title: "Trimite oferta", dueDate: "2026-06-11", assigneeName: "Sika" }),
    task({ id: "no-assignee", title: "Trimite oferta", dueDate: "2026-06-10", assigneeName: null })
  ];

  const result = removeDuplicateTaskIdentities(candidates, existing);
  assert.equal(result.duplicateCount, 1);
  assert.deepEqual(result.uniqueTasks.map((item) => item.id), ["different-date", "no-assignee"]);
});

test("privacy filter hides private tasks from other actors", () => {
  const tasks = [
    task({ id: "team", visibility: "team", visibleToEmails: [] }),
    task({ id: "private", visibility: "private", visibleToEmails: ["tudor@example.com"] })
  ];

  assert.deepEqual(filterVisibleTasks(tasks, "tudor@example.com").map((item) => item.id), ["team", "private"]);
  assert.deepEqual(filterVisibleTasks(tasks, "bogdan@example.com").map((item) => item.id), ["team"]);
});
