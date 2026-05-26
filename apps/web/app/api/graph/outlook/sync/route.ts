import { syncOutlookFolderToSources } from "@repo/domain/m365";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const result = await syncOutlookFolderToSources({
    actorEmail: body.actorEmail ?? process.env.LOCAL_ACTOR_EMAIL ?? null,
    top: body.top,
    maxPages: body.maxPages,
    sinceDateTime: body.sinceDateTime ?? null
  });
  return NextResponse.json({ ok: true, result });
}
