import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { ProposedTask } from "./types";

type PrivateSourceRule = {
  sourceEmails: string[];
  visibleToEmails: string[];
};

type PrivacyRules = {
  blockedSourceEmails: string[];
  privateSourceEmailOwners: PrivateSourceRule[];
};

const emptyRules: PrivacyRules = {
  blockedSourceEmails: [],
  privateSourceEmailOwners: []
};

function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function privacyRulesPath(): string {
  return path.resolve(process.env.TASKWIZARD_PRIVACY_RULES_FILE ?? "config/privacy-rules.local.json");
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => normalizeEmail(String(item))).filter(Boolean);
}

export function loadPrivacyRules(): PrivacyRules {
  const filePath = privacyRulesPath();
  if (!existsSync(filePath)) return emptyRules;

  const parsed = JSON.parse(readFileSync(filePath, "utf8")) as Partial<PrivacyRules>;
  return {
    blockedSourceEmails: parseStringArray(parsed.blockedSourceEmails),
    privateSourceEmailOwners: Array.isArray(parsed.privateSourceEmailOwners)
      ? parsed.privateSourceEmailOwners.map((rule) => ({
          sourceEmails: parseStringArray(rule?.sourceEmails),
          visibleToEmails: parseStringArray(rule?.visibleToEmails)
        })).filter((rule) => rule.sourceEmails.length > 0 && rule.visibleToEmails.length > 0)
      : []
  };
}

export function classifySourcePrivacy(input: {
  fromEmail?: string | null;
  participants?: string[];
}): { action: "block" } | { action: "private"; visibleToEmails: string[] } | { action: "team" } {
  const rules = loadPrivacyRules();
  const fromEmail = normalizeEmail(input.fromEmail);
  const allSourceEmails = new Set([fromEmail, ...(input.participants ?? []).map(normalizeEmail)].filter(Boolean));

  if (fromEmail && rules.blockedSourceEmails.includes(fromEmail)) {
    return { action: "block" };
  }

  const privateRule = rules.privateSourceEmailOwners.find((rule) =>
    rule.sourceEmails.some((email) => allSourceEmails.has(email))
  );

  if (privateRule) {
    return { action: "private", visibleToEmails: privateRule.visibleToEmails };
  }

  return { action: "team" };
}

export function applyTaskVisibility<T extends ProposedTask>(
  tasks: T[],
  privacy: { action: "private"; visibleToEmails: string[] } | { action: "team" }
): T[] {
  if (privacy.action === "team") {
    return tasks.map((task) => ({ ...task, visibility: "team", visibleToEmails: [] }));
  }

  return tasks.map((task) => ({
    ...task,
    visibility: "private",
    visibleToEmails: privacy.visibleToEmails
  }));
}

export function canViewTask(task: Pick<ProposedTask, "visibility" | "visibleToEmails">, actorEmail: string | null | undefined): boolean {
  if (task.visibility !== "private") return true;
  const normalizedActor = normalizeEmail(actorEmail);
  return Boolean(normalizedActor && task.visibleToEmails.map(normalizeEmail).includes(normalizedActor));
}

export function filterVisibleTasks<T extends Pick<ProposedTask, "visibility" | "visibleToEmails">>(tasks: T[], actorEmail: string | null | undefined): T[] {
  return tasks.filter((task) => canViewTask(task, actorEmail));
}
