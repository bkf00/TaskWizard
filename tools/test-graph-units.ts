import assert from "node:assert/strict";
import test from "node:test";
import { encodeGraphPathSegment } from "@repo/graph/client";
import { buildOutlookFolderSubscriptionResource, mapOutlookMessageToSourceInput } from "@repo/graph/outlook";
import { buildOutlookSubscriptionRequest, getDefaultSubscriptionExpiration } from "@repo/graph/subscriptions";

function withEnv<T>(values: Record<string, string | undefined>, callback: () => T): T {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return callback();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("Graph path segments escape apostrophes and spaces", () => {
  assert.equal(encodeGraphPathSegment("O'Hara Folder"), "O%27Hara%20Folder");
});

test("Outlook subscription resource uses configured mailbox and folder", () => {
  const resource = buildOutlookFolderSubscriptionResource({
    userId: "bogdan.cojocaru@rst-services.ro",
    folderId: "Folder With Space"
  });

  assert.equal(resource, "/users/bogdan.cojocaru%40rst-services.ro/mailFolders('Folder%20With%20Space')/messages");
});

test("Outlook messages map to local source input", () => {
  const mapped = mapOutlookMessageToSourceInput({
    id: "graph-message-id",
    internetMessageId: "<internet-message-id>",
    subject: " Minuta DSSPG ",
    from: { emailAddress: { address: "manager@example.com", name: "Manager" } },
    toRecipients: [{ emailAddress: { address: "bogdan@example.com" } }],
    ccRecipients: [{ emailAddress: { address: "tudor@example.com" } }],
    bodyPreview: "Bogdan verifica lista.",
    body: { contentType: "text", content: "Bogdan verifica lista completa." }
  });

  assert.equal(mapped.externalId, "<internet-message-id>");
  assert.equal(mapped.subject, "Minuta DSSPG");
  assert.equal(mapped.fromEmail, "manager@example.com");
  assert.deepEqual(mapped.participants, ["bogdan@example.com", "tudor@example.com"]);
  assert.match(mapped.rawText, /lista completa/);
});

test("subscription request is built from env without contacting Graph", () => {
  const request = withEnv(
    {
      OUTLOOK_USER_ID: "mailbox@example.com",
      OUTLOOK_FOLDER_ID: "AAMk Folder",
      GRAPH_WEBHOOK_NOTIFICATION_URL: "https://example.com/api/graph/webhook",
      GRAPH_WEBHOOK_CLIENT_STATE: "test-client-state",
      GRAPH_LIFECYCLE_NOTIFICATION_URL: "https://example.com/api/graph/webhook"
    },
    () =>
      buildOutlookSubscriptionRequest({
        expirationDateTime: "2026-06-10T10:00:00.000Z"
      })
  );

  assert.equal(request.changeType, "created,updated");
  assert.equal(request.clientState, "test-client-state");
  assert.equal(request.notificationUrl, "https://example.com/api/graph/webhook");
  assert.equal(request.lifecycleNotificationUrl, "https://example.com/api/graph/webhook");
  assert.match(request.resource, /mailFolders\('AAMk%20Folder'\)\/messages$/);
});

test("default subscription expiration is in the future", () => {
  const before = Date.now();
  const expires = new Date(getDefaultSubscriptionExpiration(1)).getTime();
  const after = Date.now();

  assert.ok(expires >= before + 60 * 60 * 1000 - 1000);
  assert.ok(expires <= after + 60 * 60 * 1000 + 1000);
});
