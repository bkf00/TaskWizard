import { audit } from "@repo/audit/audit";
import { syncOutlookFolderToSources } from "@repo/domain/m365";
import { getDefaultSubscriptionExpiration, renewGraphSubscription } from "@repo/graph/subscriptions";
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
  let shouldSyncOutlook = false;

  for (const notification of payload.value ?? []) {
    if (expectedClientState && notification.clientState !== expectedClientState) {
      return NextResponse.json({ error: "Invalid Graph clientState." }, { status: 401 });
    }

    const lifecycleEvent = notification.lifecycleEvent as string | undefined;

    await audit({
      type: lifecycleEvent ? "graph.lifecycle_received" : "graph.notification_received",
      sourceId: null,
      proposedTaskId: null,
      actorEmail: null,
      message: lifecycleEvent ? "Notificare lifecycle Graph primita." : "Notificare Graph primita.",
      metadata: {
        subscriptionId: notification.subscriptionId,
        resource: notification.resource,
        changeType: notification.changeType,
        lifecycleEvent
      }
    });

    console.info("[m365] graph notification received", {
      subscriptionId: notification.subscriptionId,
      resource: notification.resource,
      changeType: notification.changeType,
      lifecycleEvent
    });

    if (lifecycleEvent === "reauthorizationRequired" && notification.subscriptionId) {
      await renewGraphSubscription({
        subscriptionId: notification.subscriptionId,
        expirationDateTime: getDefaultSubscriptionExpiration()
      });
    }

    if (!lifecycleEvent && String(notification.resource ?? "").toLowerCase().includes("/messages")) {
      shouldSyncOutlook = true;
    }
  }

  if (shouldSyncOutlook) {
    await syncOutlookFolderToSources({ actorEmail: null, top: 10, maxPages: 2 });
  }

  return NextResponse.json({ ok: true });
}
