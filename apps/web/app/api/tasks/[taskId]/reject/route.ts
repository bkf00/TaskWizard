import { rejectTask } from "@repo/domain/approval";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request, context: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await context.params;
  const form = await req.formData();
  const actorEmail = String(form.get("actorEmail") ?? "approver@example.com");

  await rejectTask({ taskId, actorEmail });

  return NextResponse.redirect(new URL("/", req.url), { status: 303 });
}
