import type { SourceType } from "./types";

export type ParsedEmailPaste = {
  type: SourceType;
  subject: string;
  fromEmail: string | null;
  participants: string[];
  rawText: string;
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
  return withoutSoftBreaks.replace(/=([0-9A-F]{2})/gi, (_, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16))
  );
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
    rawText
  };
}

