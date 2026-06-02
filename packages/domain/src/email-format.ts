import type { SourceType } from "./types";
import { extractDocumentText, formatExtractedDocuments, isSupportedDocument, type ExtractedDocumentText } from "./document-extract";

export type ParsedEmailPaste = {
  type: SourceType;
  subject: string;
  fromEmail: string | null;
  participants: string[];
  rawText: string;
  attachments: ExtractedDocumentText[];
};

function unfoldHeaders(raw: string): string {
  return raw.replace(/\r?\n[ \t]+/g, " ");
}

function headerValue(raw: string, name: string): string | null {
  const unfolded = unfoldHeaders(raw);
  const match = unfolded.match(new RegExp(`^${name}:\\s*(.+)$`, "im"));
  return match?.[1]?.trim() ?? null;
}

function emailAddresses(value: string | null): string[] {
  if (!value) return [];
  const matches = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
  return [...new Set(matches ?? [])];
}

function decodeQuotedPrintable(value: string): string {
  const withoutSoftBreaks = value.replace(/=\r?\n/g, "");
  const encoded = withoutSoftBreaks.replace(/=([0-9A-F]{2})/gi, (_, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16))
  );
  return Buffer.from(encoded, "binary").toString("utf8");
}

function stripMimeNoise(value: string): string {
  return value
    .split(/\r?\n/)
    .filter((line) => !line.startsWith("--_"))
    .filter((line) => !/^Content-(Type|Transfer-Encoding|ID|Disposition):/i.test(line))
    .filter((line) => !/^MIME-Version:/i.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractTextPlainBody(raw: string): string {
  const textPlainMatch = raw.match(/Content-Type:\s*text\/plain[\s\S]*?\r?\n\r?\n([\s\S]*?)(?=\r?\n--[^\r\n]+|$)/i);
  if (textPlainMatch?.[1]) {
    return stripMimeNoise(decodeQuotedPrintable(textPlainMatch[1]));
  }

  const firstBody = raw.split(/\r?\n\r?\n/).slice(1).join("\n\n");
  return stripMimeNoise(decodeQuotedPrintable(firstBody || raw));
}

function decodeMimeFilename(value: string): string {
  const trimmed = value.trim().replace(/^["']|["']$/g, "");
  const encodedWord = trimmed.match(/^=\?([^?]+)\?([BQ])\?(.+)\?=$/i);
  if (!encodedWord) return trimmed;

  const [, charset, encoding, content] = encodedWord;
  const bytes = encoding.toUpperCase() === "B"
    ? Buffer.from(content, "base64")
    : Buffer.from(content.replace(/_/g, " ").replace(/=([0-9A-F]{2})/gi, (_, hex: string) =>
        String.fromCharCode(Number.parseInt(hex, 16))
      ), "binary");
  return bytes.toString(charset.toLowerCase().includes("utf") ? "utf8" : "latin1");
}

function attachmentParts(rawEmail: string): Array<{ filename: string; buffer: Buffer }> {
  const parts: Array<{ filename: string; buffer: Buffer }> = [];
  const matches = rawEmail.matchAll(/Content-Type:[\s\S]*?(?=\r?\n--[^\r\n]+|$)/gi);

  for (const match of matches) {
    const part = match[0];
    if (!/Content-Disposition:\s*attachment/i.test(part) && !/filename\s*=|name\s*=/i.test(part)) continue;

    const filenameMatch = part.match(/(?:filename|name)\*?=(?:"([^"]+)"|([^\r\n;]+))/i);
    const filename = filenameMatch ? decodeMimeFilename(filenameMatch[1] ?? filenameMatch[2]) : "attachment";
    if (!isSupportedDocument(filename)) continue;

    const bodyMatch = part.match(/Content-Transfer-Encoding:\s*base64[\s\S]*?\r?\n\r?\n([\s\S]*)$/i);
    if (!bodyMatch?.[1]) continue;

    const base64 = bodyMatch[1]
      .replace(/\r?\n--[\s\S]*$/g, "")
      .replace(/\s/g, "");
    if (!base64) continue;

    try {
      parts.push({ filename, buffer: Buffer.from(base64, "base64") });
    } catch {
      // Ignore malformed attachment payloads; body extraction still works.
    }
  }

  return parts;
}

export async function extractEmailAttachments(rawEmail: string): Promise<ExtractedDocumentText[]> {
  const parts = attachmentParts(rawEmail);
  return Promise.all(parts.map((part) => extractDocumentText(part)));
}

export function parseEmailPaste(input: {
  rawEmail: string;
  fallbackActorEmail?: string | null;
}): ParsedEmailPaste {
  const rawEmail = input.rawEmail.trim();
  const subject = headerValue(rawEmail, "Subject") ?? "Email fara subiect";
  const fromEmail = emailAddresses(headerValue(rawEmail, "From"))[0] ?? null;
  const participants = [
    ...emailAddresses(headerValue(rawEmail, "To")),
    ...emailAddresses(headerValue(rawEmail, "CC")),
    ...(input.fallbackActorEmail ? [input.fallbackActorEmail] : [])
  ].filter(Boolean);

  const rawText = extractTextPlainBody(rawEmail);

  return {
    type: "email",
    subject,
    fromEmail,
    participants: [...new Set(participants)],
    rawText,
    attachments: []
  };
}

export async function parseEmailPasteWithAttachments(input: {
  rawEmail: string;
  fallbackActorEmail?: string | null;
}): Promise<ParsedEmailPaste> {
  const parsed = parseEmailPaste(input);
  const attachments = await extractEmailAttachments(input.rawEmail);
  const attachmentText = formatExtractedDocuments(attachments);

  return {
    ...parsed,
    attachments,
    rawText: [parsed.rawText, attachmentText].filter(Boolean).join("\n\n")
  };
}
