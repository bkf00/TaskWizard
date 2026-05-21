import { ingestManualSource } from "@repo/domain/ingestion";
import type { SourceType } from "@repo/domain/types";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
const allowedSourceTypes = new Set(["email", "teams_transcript", "manual_upload"]);

export async function POST(req: Request) {
  const form = await req.formData();
  const subject = String(form.get("subject") ?? "").trim();
  const rawText = String(form.get("rawText") ?? "").trim();
  const type = String(form.get("type") ?? "manual_upload") as SourceType;
  const fromEmail = String(form.get("fromEmail") ?? "").trim() || null;
  const actorEmail = String(form.get("actorEmail") ?? "").trim() || null;
  const participants = String(form.get("participants") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!subject || !rawText) {
    return NextResponse.json({ error: "Subiectul si textul sunt obligatorii." }, { status: 400 });
  }
  if (!allowedSourceTypes.has(type)) {
    return NextResponse.json({ error: "Tipul sursei este invalid." }, { status: 400 });
  }

  await ingestManualSource({
    type,
    subject,
    rawText,
    fromEmail,
    participants,
    actorEmail
  });

  return NextResponse.redirect(new URL("/", req.url), { status: 303 });
}
