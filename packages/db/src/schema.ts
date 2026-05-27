import { boolean, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const sourceType = pgEnum("source_type", ["email", "teams_transcript", "manual_upload"]);
export const sourceStatus = pgEnum("source_status", [
  "received",
  "processing",
  "processed",
  "failed",
  "ignored_duplicate"
]);
export const taskConfidence = pgEnum("task_confidence", ["high", "medium", "low"]);
export const taskPriority = pgEnum("task_priority", ["normal", "high"]);
export const proposedTaskStatus = pgEnum("proposed_task_status", [
  "proposed",
  "approved",
  "rejected",
  "created_in_planner",
  "planner_sync_failed",
  "completed_in_planner",
  "deleted_in_planner"
]);

export const sourceItems = pgTable(
  "source_items",
  {
    id: text("id").primaryKey(),
    type: sourceType("type").notNull(),
    externalId: text("external_id"),
    sourceHash: text("source_hash").notNull(),
    subject: text("subject").notNull(),
    fromEmail: text("from_email"),
    participants: jsonb("participants").$type<string[]>().notNull().default([]),
    rawTextEncrypted: text("raw_text_encrypted").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    retentionUntil: timestamp("retention_until", { withTimezone: true }).notNull(),
    status: sourceStatus("status").notNull(),
    errorMessage: text("error_message")
  },
  (table) => ({
    sourceHashUnique: uniqueIndex("source_items_source_hash_unique").on(table.sourceHash)
  })
);

export const proposedTasks = pgTable("proposed_tasks", {
  id: text("id").primaryKey(),
  sourceId: text("source_id")
    .notNull()
    .references(() => sourceItems.id),
  title: text("title").notNull(),
  description: text("description"),
  assigneeEmail: text("assignee_email"),
  assigneeName: text("assignee_name"),
  dueDate: text("due_date"),
  projectHint: text("project_hint"),
  confidence: taskConfidence("confidence").notNull(),
  priority: taskPriority("priority").notNull().default("normal"),
  evidence: text("evidence").notNull(),
  status: proposedTaskStatus("status").notNull(),
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  plannerTaskId: text("planner_task_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
});

export const auditEvents = pgTable("audit_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  actorEmail: text("actor_email"),
  sourceId: text("source_id"),
  proposedTaskId: text("proposed_task_id"),
  message: text("message").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull()
});

export const graphSubscriptions = pgTable("graph_subscriptions", {
  id: text("id").primaryKey(),
  subscriptionId: text("subscription_id").notNull(),
  resource: text("resource").notNull(),
  changeType: text("change_type").notNull(),
  clientState: text("client_state").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  active: boolean("active").notNull().default(true)
});

export const processingErrors = pgTable("processing_errors", {
  id: text("id").primaryKey(),
  sourceId: text("source_id"),
  proposedTaskId: text("proposed_task_id"),
  stage: text("stage").notNull(),
  message: text("message").notNull(),
  retryable: boolean("retryable").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull()
});
