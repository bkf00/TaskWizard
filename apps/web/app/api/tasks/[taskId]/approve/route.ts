import { approveTask } from "@repo/domain/approval";
import { NextResponse } from "next/server";
import { getCurrentActorEmail } from "../../../../../auth-actor";

export const runtime = "nodejs";

export async function POST(req: Request, context: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await context.params;
  const form = await req.formData();
  const actorEmail = await getCurrentActorEmail(String(form.get("actorEmail") ?? ""));
  const priority = form.get("priority") === "high" ? "high" : undefined;

  await approveTask({ taskId, actorEmail, patch: priority ? { priority } : undefined });

  return NextResponse.redirect(new URL("/", req.url), { status: 303 });
}
