import { extendTaskDueDate } from "@repo/domain/approval";
import { NextResponse } from "next/server";
import { getCurrentActorEmail } from "../../../../../auth-actor";

export const runtime = "nodejs";

export async function POST(req: Request, context: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await context.params;
  const form = await req.formData();
  const actorEmail = await getCurrentActorEmail(String(form.get("actorEmail") ?? ""));
  const dueDate = String(form.get("dueDate") ?? "");
  const redirectTo = String(form.get("redirectTo") ?? "/tasks");

  await extendTaskDueDate({ taskId, actorEmail, dueDate });

  return NextResponse.redirect(new URL(redirectTo, req.url), { status: 303 });
}
