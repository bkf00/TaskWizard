import { createHash, randomUUID } from "node:crypto";

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

export function hashSource(input: {
  type: string;
  externalId?: string | null;
  subject: string;
  rawText: string;
}): string {
  return createHash("sha256")
    .update(input.type)
    .update("|")
    .update(input.externalId ?? "")
    .update("|")
    .update(input.subject.trim().toLowerCase())
    .update("|")
    .update(input.rawText.trim())
    .digest("hex");
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

