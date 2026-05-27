import { approveTask } from "@repo/domain/approval";
import { NextResponse } from "next/server";
import { getCurrentActorEmail } from "../../../../../auth-actor";

export const runtime = "nodejs";

export async function POST(req: Request, context: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await context.params;
  const form = await req.formData();
  const actorEmail = await getCurrentActorEmail(String(form.get("actorEmail") ?? ""));

  await approveTask({ taskId, actorEmail });

  return NextResponse.redirect(new URL("/", req.url), { status: 303 });
}
