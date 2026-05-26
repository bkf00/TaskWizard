import { provisionOutlookSubscription } from "@repo/domain/m365";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const actorEmail = req.headers.get("x-taskwizard-actor") ?? process.env.LOCAL_ACTOR_EMAIL ?? null;
  const subscription = await provisionOutlookSubscription({ actorEmail });
  return NextResponse.json({ ok: true, subscription });
}
