const invalidAssigneeLabels = new Set([
  "acestea",
  "acestia",
  "de",
  "el",
  "ea",
  "ei",
  "ele",
  "ne",
  "noi",
  "se"
]);

export function cleanAssigneeName(value: string | null | undefined): string | null {
  const cleaned = value?.replace(/[\s\u2010-\u2015-]+$/g, "").trim() ?? "";
  if (!cleaned) return null;
  return invalidAssigneeLabels.has(cleaned.toLowerCase()) ? null : cleaned;
}
