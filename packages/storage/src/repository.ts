import type { AuditEvent, ProcessingError, ProposedTask, SourceItem } from "@repo/domain/types";

export type StoreSnapshot = {
  sources: SourceItem[];
  proposedTasks: ProposedTask[];
  auditEvents: AuditEvent[];
  processingErrors: ProcessingError[];
};

export const emptyStoreSnapshot: StoreSnapshot = {
  sources: [],
  proposedTasks: [],
  auditEvents: [],
  processingErrors: []
};

export type TaskWizardRepository = {
  listSources(): Promise<SourceItem[]>;
  findSourceByHash(sourceHash: string): Promise<SourceItem | null>;
  saveSource(source: SourceItem): Promise<SourceItem>;
  listProposedTasks(): Promise<ProposedTask[]>;
  getProposedTask(id: string): Promise<ProposedTask | null>;
  saveProposedTasks(tasks: ProposedTask[]): Promise<void>;
  saveProposedTask(task: ProposedTask): Promise<ProposedTask>;
  addAuditEvent(event: AuditEvent): Promise<void>;
  listAuditEvents(): Promise<AuditEvent[]>;
  addProcessingError(error: ProcessingError): Promise<void>;
  listProcessingErrors(): Promise<ProcessingError[]>;
};
