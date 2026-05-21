type QueueEventName =
  | "source.received"
  | "task.approved"
  | "graph.notification.received";

type QueueHandler<TPayload> = (payload: TPayload) => Promise<void>;

const handlers = new Map<string, QueueHandler<unknown>[]>();

export function onQueueEvent<TPayload>(name: QueueEventName, handler: QueueHandler<TPayload>): void {
  const current = handlers.get(name) ?? [];
  current.push(handler as QueueHandler<unknown>);
  handlers.set(name, current);
}

export async function enqueue<TPayload>(name: QueueEventName, payload: TPayload): Promise<void> {
  const current = handlers.get(name) ?? [];
  for (const handler of current) {
    await handler(payload);
  }
}

