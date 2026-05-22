import { ingestManualSource } from "@repo/domain/ingestion";
import { parseEmailPaste } from "@repo/domain/email-format";
import type { SourceType } from "@repo/domain/types";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
const allowedSourceTypes = new Set(["email", "teams_transcript", "manual_upload"]);

export async function POST(req: Request) {
  const form = await req.formData();
  const actorEmail = String(form.get("actorEmail") ?? "").trim() || null;
  const rawEmail = String(form.get("rawEmail") ?? "").trim();
  const parsed = rawEmail
    ? parseEmailPaste({ rawEmail, fallbackActorEmail: actorEmail })
    : {
        subject: String(form.get("subject") ?? "").trim(),
        rawText: String(form.get("rawText") ?? "").trim(),
        type: String(form.get("type") ?? "manual_upload") as SourceType,
        fromEmail: String(form.get("fromEmail") ?? "").trim() || null,
        participants: String(form.get("participants") ?? "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      };

  if (!parsed.subject || !parsed.rawText) {
    return NextResponse.json({ error: "Subiectul si textul sunt obligatorii." }, { status: 400 });
  }
  if (!allowedSourceTypes.has(parsed.type)) {
    return NextResponse.json({ error: "Tipul sursei este invalid." }, { status: 400 });
  }

  await ingestManualSource({
    type: parsed.type,
    subject: parsed.subject,
    rawText: parsed.rawText,
    fromEmail: parsed.fromEmail,
    participants: parsed.participants,
    actorEmail
  });

  return NextResponse.redirect(new URL("/", req.url), { status: 303 });
}
