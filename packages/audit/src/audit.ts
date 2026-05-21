import type { AuditEvent, AuditEventType } from "@repo/domain/types";
import { newId } from "@repo/domain/ids";
import { store } from "@repo/storage/local-store";

export async function audit(input: {
  type: AuditEventType;
  actorEmail?: string | null;
  sourceId?: string | null;
  proposedTaskId?: string | null;
  message: string;
  metadata?: Record<string, unknown>;
}): Promise<AuditEvent> {
  const event: AuditEvent = {
    id: newId("audit"),
    type: input.type,
    actorEmail: input.actorEmail ?? null,
    sourceId: input.sourceId ?? null,
    proposedTaskId: input.proposedTaskId ?? null,
    message: input.message,
    metadata: input.metadata ?? {},
    createdAt: new Date().toISOString()
  };

  await store.addAuditEvent(event);
  return event;
}

