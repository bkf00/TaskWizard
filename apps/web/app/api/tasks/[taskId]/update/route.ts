import { updateProposedTask } from "@repo/domain/approval";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request, context: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await context.params;
  const form = await req.formData();
  const actorEmail = String(form.get("actorEmail") ?? "approver@firma.ro");

  await updateProposedTask({
    taskId,
    actorEmail,
    patch: {
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? ""),
      assigneeEmail: String(form.get("assigneeEmail") ?? ""),
      assigneeName: String(form.get("assigneeName") ?? ""),
      dueDate: String(form.get("dueDate") ?? ""),
      projectHint: String(form.get("projectHint") ?? "")
    }
  });

  return NextResponse.redirect(new URL("/", req.url), { status: 303 });
}
