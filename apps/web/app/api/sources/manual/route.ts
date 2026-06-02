import { ingestManualSource } from "@repo/domain/ingestion";
import { parseEmailPasteWithAttachments } from "@repo/domain/email-format";
import { extractDocumentText, formatExtractedDocuments } from "@repo/domain/document-extract";
import type { SourceType } from "@repo/domain/types";
import { NextResponse } from "next/server";
import { getCurrentActorEmail } from "../../../../auth-actor";

export const runtime = "nodejs";
const allowedSourceTypes = new Set(["email", "teams_transcript", "manual_upload"]);

export async function POST(req: Request) {
  const form = await req.formData();
  const actorEmail = await getCurrentActorEmail(String(form.get("actorEmail") ?? ""));
  const sourceFile = form.get("sourceFile");
  const rawEmail = String(form.get("rawEmail") ?? "").trim();
  const uploadedFile = sourceFile instanceof File && sourceFile.size > 0 ? sourceFile : null;
  const parsed = uploadedFile
    ? await parseUploadedFile({ file: uploadedFile, form, actorEmail })
    : rawEmail
      ? await parseEmailPasteWithAttachments({ rawEmail, fallbackActorEmail: actorEmail })
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

async function parseUploadedFile(input: {
  file: File;
  form: FormData;
  actorEmail: string;
}) {
  const filename = input.file.name || "fisier";
  const buffer = Buffer.from(await input.file.arrayBuffer());
  if (/\.eml$/i.test(filename) || input.file.type === "message/rfc822") {
    return parseEmailPasteWithAttachments({
      rawEmail: buffer.toString("utf8"),
      fallbackActorEmail: input.actorEmail
    });
  }

  const document = await extractDocumentText({ filename, buffer });
  return {
    subject: String(input.form.get("subject") ?? "").trim() || filename,
    rawText: formatExtractedDocuments([document]),
    type: String(input.form.get("type") ?? "manual_upload") as SourceType,
    fromEmail: String(input.form.get("fromEmail") ?? "").trim() || null,
    participants: String(input.form.get("participants") ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  };
}
