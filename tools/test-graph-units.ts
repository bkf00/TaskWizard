import assert from "node:assert/strict";
import test from "node:test";
import { encodeGraphPathSegment, graphRequest } from "@repo/graph/client";
import { buildOutlookFolderSubscriptionResource, listOutlookFolderMessages, mapOutlookMessageToSourceInput } from "@repo/graph/outlook";
import { createPlannerTask } from "@repo/graph/planner";
import { buildOutlookSubscriptionRequest, getDefaultSubscriptionExpiration } from "@repo/graph/subscriptions";
import { lookupEntraUserByEmail } from "@repo/graph/users";

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

async function withEnvAsync<T>(values: Record<string, string | undefined>, callback: () => Promise<T>): Promise<T> {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await callback();
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

async function withMockFetch<T>(
  handler: (input: RequestInfo | URL, init?: RequestInit) => Response | Promise<Response>,
  callback: () => Promise<T>
): Promise<T> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = handler as typeof fetch;
  try {
    return await callback();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {})
    }
  });
}

function tokenResponse(token = "graph-test-token"): Response {
  return jsonResponse({ access_token: token, expires_in: 3600, token_type: "Bearer" });
}

const graphCredentials = {
  GRAPH_TENANT_ID: "tenant-id",
  GRAPH_CLIENT_ID: "client-id",
  GRAPH_CLIENT_SECRET: "client-secret"
};

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

test("graphRequest retries retryable Graph responses", async () => {
  await withEnvAsync(graphCredentials, async () => {
    const calls: string[] = [];
    const result = await withMockFetch(
      async (input) => {
        calls.push(String(input));
        if (calls.length === 1) return tokenResponse();
        if (calls.length === 2) {
          return new Response("slow down", {
            status: 429,
            headers: { "retry-after": "0" }
          });
        }
        return jsonResponse({ ok: true });
      },
      () => graphRequest<{ ok: boolean }>("/me", { retry: { attempts: 2, baseDelayMs: 0 } })
    );

    assert.deepEqual(result, { ok: true });
    assert.equal(calls.length, 3);
    assert.match(calls[0], /login\.microsoftonline\.com\/tenant-id/);
    assert.equal(calls[1], "https://graph.microsoft.com/v1.0/me");
    assert.equal(calls[2], "https://graph.microsoft.com/v1.0/me");
  });
});

test("Outlook folder listing follows Graph pagination", async () => {
  await withEnvAsync(graphCredentials, async () => {
    const graphUrls: string[] = [];
    const messages = await withMockFetch(
      async (input) => {
        const url = String(input);
        if (url.includes("login.microsoftonline.com")) return tokenResponse();
        graphUrls.push(url);
        if (graphUrls.length === 1) {
          return jsonResponse({
            value: [{ id: "message-1", subject: "Prima minuta" }],
            "@odata.nextLink": "https://graph.microsoft.com/v1.0/users/mailbox/mailFolders/folder/messages?$skip=25"
          });
        }
        return jsonResponse({ value: [{ id: "message-2", subject: "A doua minuta" }] });
      },
      () =>
        listOutlookFolderMessages({
          userId: "mailbox@example.com",
          folderId: "folder id",
          top: 1,
          maxPages: 5
        })
    );

    assert.deepEqual(messages.map((message) => message.id), ["message-1", "message-2"]);
    assert.equal(graphUrls.length, 2);
    assert.match(graphUrls[0], /mailFolders\/folder%20id\/messages/);
    assert.match(graphUrls[1], /\$skip=25/);
  });
});

test("Entra user lookup handles found, missing and ambiguous users", async () => {
  await withEnvAsync(graphCredentials, async () => {
    let graphCall = 0;
    const results = await withMockFetch(
      async (input) => {
        const url = String(input);
        if (url.includes("login.microsoftonline.com")) return tokenResponse();
        graphCall += 1;
        if (graphCall === 1) {
          return jsonResponse({
            value: [{ id: "user-1", displayName: "Bogdan", mail: "bogdan@example.com", userPrincipalName: "b@example.com" }]
          });
        }
        if (graphCall === 2) {
          return jsonResponse({ value: [] });
        }
        return jsonResponse({
          value: [
            { id: "user-2", displayName: "Tudor", mail: "tudor@example.com", userPrincipalName: "tudor@example.com" },
            { id: "user-3", displayName: "Tudor Alt", mail: null, userPrincipalName: "tudor@example.com" }
          ]
        });
      },
      async () => [
        await lookupEntraUserByEmail("Bogdan@Example.com"),
        await lookupEntraUserByEmail("missing@example.com"),
        await lookupEntraUserByEmail("tudor@example.com")
      ]
    );

    assert.equal(results[0].status, "found");
    assert.equal(results[1].status, "not_found");
    assert.equal(results[2].status, "ambiguous");
  });
});

test("Planner task creation sends configured plan, bucket, assignment and details", async () => {
  await withEnvAsync(
    {
      ...graphCredentials,
      PLANNER_PLAN_ID: "plan-id",
      PLANNER_BUCKET_ID: "bucket-id"
    },
    async () => {
      const graphRequests: Array<{ url: string; init?: RequestInit }> = [];
      const task = await withMockFetch(
        async (input, init) => {
          const url = String(input);
          if (url.includes("login.microsoftonline.com")) return tokenResponse();
          graphRequests.push({ url, init });
          if (url.endsWith("/planner/tasks")) return jsonResponse({ id: "planner-task-id" });
          return new Response(null, { status: 204 });
        },
        () =>
          createPlannerTask({
            title: "Trimite raport",
            description: "Descriere completa",
            assigneeAadId: "aad-user-id",
            dueDate: "2026-06-12"
          })
      );

      assert.deepEqual(task, { id: "planner-task-id" });
      assert.equal(graphRequests.length, 2);
      assert.equal(graphRequests[0].url, "https://graph.microsoft.com/v1.0/planner/tasks");
      assert.deepEqual(JSON.parse(String(graphRequests[0].init?.body)), {
        planId: "plan-id",
        bucketId: "bucket-id",
        title: "Trimite raport",
        dueDateTime: "2026-06-12T17:00:00Z",
        assignments: {
          "aad-user-id": {
            "@odata.type": "#microsoft.graph.plannerAssignment",
            orderHint: " !"
          }
        }
      });
      assert.equal(graphRequests[1].url, "https://graph.microsoft.com/v1.0/planner/tasks/planner-task-id/details");
      assert.equal((graphRequests[1].init?.headers as Record<string, string>)["If-Match"], "*");
    }
  );
});

test("Graph webhook validates validationToken and rejects invalid clientState", async () => {
  await withEnvAsync({ GRAPH_WEBHOOK_CLIENT_STATE: "expected-state" }, async () => {
    const route = await import("../apps/web/app/api/graph/webhook/route");
    const validation = await route.GET(new Request("http://localhost:3000/api/graph/webhook?validationToken=hello-token"));
    assert.equal(validation.status, 200);
    assert.equal(await validation.text(), "hello-token");

    const invalid = await route.POST(
      new Request("http://localhost:3000/api/graph/webhook", {
        method: "POST",
        body: JSON.stringify({
          value: [{ clientState: "wrong-state", resource: "/users/mailbox/messages", subscriptionId: "sub-id" }]
        }),
        headers: { "Content-Type": "application/json" }
      })
    );
    assert.equal(invalid.status, 401);
  });
});
