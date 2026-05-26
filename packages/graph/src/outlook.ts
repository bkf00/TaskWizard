import { encodeGraphPathSegment, graphRequest } from "./client";
import { getOutlookFolderConfig } from "./config";

export type OutlookMessage = {
  id: string;
  internetMessageId?: string | null;
  subject?: string | null;
  from?: { emailAddress?: { address?: string | null; name?: string | null } | null } | null;
  toRecipients?: Array<{ emailAddress?: { address?: string | null; name?: string | null } | null }>;
  ccRecipients?: Array<{ emailAddress?: { address?: string | null; name?: string | null } | null }>;
  receivedDateTime?: string | null;
  bodyPreview?: string | null;
  body?: { contentType?: string | null; content?: string | null } | null;
  webLink?: string | null;
};

type OutlookMessageCollection = {
  value?: OutlookMessage[];
  "@odata.nextLink"?: string;
};

export type ListOutlookFolderMessagesInput = {
  userId?: string;
  folderId?: string;
  top?: number;
  maxPages?: number;
  sinceDateTime?: string | null;
};

function configuredMailbox() {
  const config = getOutlookFolderConfig();
  if (!config) throw new Error("Outlook folder integration is not configured.");
  return { userId: config.outlookUserId, folderId: config.outlookFolderId };
}

function collectAddresses(
  recipients: Array<{ emailAddress?: { address?: string | null } | null }> | undefined
): string[] {
  return (recipients ?? [])
    .map((recipient) => recipient.emailAddress?.address?.trim())
    .filter((address): address is string => Boolean(address));
}

export function mapOutlookMessageToSourceInput(message: OutlookMessage) {
  const fromEmail = message.from?.emailAddress?.address?.trim() || null;
  const participants = [...collectAddresses(message.toRecipients), ...collectAddresses(message.ccRecipients)];
  const bodyText = message.body?.content?.trim() || message.bodyPreview?.trim() || "";

  return {
    type: "email" as const,
    externalId: message.internetMessageId ?? message.id,
    subject: message.subject?.trim() || "(fara subiect)",
    fromEmail,
    participants,
    rawText: bodyText,
    actorEmail: fromEmail
  };
}

export async function listOutlookFolderMessages(input: ListOutlookFolderMessagesInput = {}): Promise<OutlookMessage[]> {
  const configured = input.userId && input.folderId ? input : configuredMailbox();
  const userId = configured.userId;
  const folderId = configured.folderId;
  if (!userId || !folderId) throw new Error("Outlook user/folder are not configured.");

  const query = new URLSearchParams({
    "$top": String(input.top ?? 25),
    "$orderby": "receivedDateTime desc",
    "$select": "id,internetMessageId,subject,from,toRecipients,ccRecipients,receivedDateTime,bodyPreview,body,webLink"
  });
  if (input.sinceDateTime) {
    query.set("$filter", `receivedDateTime ge ${input.sinceDateTime}`);
  }

  let nextUrl:
    | string
    | undefined = `/users/${encodeGraphPathSegment(userId)}/mailFolders/${encodeGraphPathSegment(folderId)}/messages?${query.toString()}`;
  const messages: OutlookMessage[] = [];
  let page = 0;
  const maxPages = input.maxPages ?? 10;

  while (nextUrl && page < maxPages) {
    page += 1;
    const response: OutlookMessageCollection = await graphRequest<OutlookMessageCollection>(nextUrl);
    messages.push(...(response.value ?? []));
    nextUrl = response["@odata.nextLink"];
  }

  return messages;
}

export function buildOutlookFolderSubscriptionResource(input?: { userId?: string; folderId?: string }): string {
  const configured = input?.userId && input?.folderId ? input : configuredMailbox();
  if (!configured.userId || !configured.folderId) throw new Error("Outlook user/folder are not configured.");
  return `/users/${encodeGraphPathSegment(configured.userId)}/mailFolders('${encodeGraphPathSegment(
    configured.folderId
  )}')/messages`;
}
