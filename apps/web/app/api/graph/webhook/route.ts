import { audit } from "@repo/audit/audit";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const validationToken = new URL(req.url).searchParams.get("validationToken");
  if (validationToken) {
    return new Response(validationToken, {
      status: 200,
      headers: { "Content-Type": "text/plain" }
    });
  }

  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  const validationToken = new URL(req.url).searchParams.get("validationToken");
  if (validationToken) {
    return new Response(validationToken, {
      status: 200,
      headers: { "Content-Type": "text/plain" }
    });
  }

  const payload = await req.json();
  const expectedClientState = process.env.GRAPH_WEBHOOK_CLIENT_STATE;

  for (const notification of payload.value ?? []) {
    if (expectedClientState && notification.clientState !== expectedClientState) {
      return NextResponse.json({ error: "Invalid Graph clientState." }, { status: 401 });
    }

    await audit({
      type: "graph.notification_received",
      sourceId: null,
      proposedTaskId: null,
      actorEmail: null,
      message: "Notificare Graph primita.",
      metadata: {
        subscriptionId: notification.subscriptionId,
        resource: notification.resource,
        changeType: notification.changeType
      }
    });
  }

  return NextResponse.json({ ok: true });
}

