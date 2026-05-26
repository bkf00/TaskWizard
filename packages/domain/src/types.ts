export type SourceType = "email" | "teams_transcript" | "manual_upload";

export type SourceStatus =
  | "received"
  | "processing"
  | "processed"
  | "failed"
  | "ignored_duplicate";

export type TaskConfidence = "high" | "medium" | "low";

export type ProposedTaskStatus =
  | "proposed"
  | "approved"
  | "rejected"
  | "created_in_planner"
  | "planner_sync_failed"
  | "completed_in_planner"
  | "deleted_in_planner";

export type AuditEventType =
  | "source.received"
  | "source.duplicate_ignored"
  | "source.extraction_started"
  | "source.extraction_completed"
  | "source.extraction_failed"
  | "task.updated"
  | "task.approved"
  | "task.rejected"
  | "task.completed"
  | "task.deleted"
  | "task.planner_created"
  | "task.planner_failed"
  | "graph.notification_received"
  | "graph.lifecycle_received"
  | "graph.subscription_created"
  | "outlook.sync_started"
  | "outlook.sync_completed"
  | "outlook.sync_failed";

export type SourceItem = {
  id: string;
  type: SourceType;
  externalId: string | null;
  sourceHash: string;
  subject: string;
  fromEmail: string | null;
  participants: string[];
  rawText: string;
  receivedAt: string;
  retentionUntil: string;
  status: SourceStatus;
  errorMessage: string | null;
};

export type ProposedTask = {
  id: string;
  sourceId: string;
  title: string;
  description: string | null;
  assigneeEmail: string | null;
  assigneeName: string | null;
  dueDate: string | null;
  projectHint: string | null;
  confidence: TaskConfidence;
  evidence: string;
  status: ProposedTaskStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  plannerTaskId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AuditEvent = {
  id: string;
  type: AuditEventType;
  actorEmail: string | null;
  sourceId: string | null;
  proposedTaskId: string | null;
  message: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type ProcessingError = {
  id: string;
  sourceId: string | null;
  proposedTaskId: string | null;
  stage: "graph" | "ingestion" | "ai_extraction" | "approval" | "planner_sync";
  message: string;
  retryable: boolean;
  createdAt: string;
};
