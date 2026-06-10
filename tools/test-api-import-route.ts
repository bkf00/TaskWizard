import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { fixtureDocx, fixtureEmlWithDocxAttachment, fixturePdf, fixtureXlsx } from "./test-fixtures";

process.env.LOCAL_DATA_DIR = await mkdtemp(path.join(os.tmpdir(), "taskwizard-api-imports-"));
process.env.LOCAL_ACTOR_EMAIL = "api-imports@example.com";
process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? "test-secret-for-api-import-route";

const { POST } = await import("../apps/web/app/api/sources/manual/route");
const { store } = await import("@repo/storage/local-store");

after(async () => {
  await rm(process.env.LOCAL_DATA_DIR ?? "", { recursive: true, force: true });
});

function requestWithForm(form: FormData): Request {
  return new Request("http://localhost:3000/api/sources/manual", {
    method: "POST",
    body: form
  });
}

function appendCommonFields(form: FormData, subject: string): void {
  form.set("actorEmail", "api-imports@example.com");
  form.set("subject", subject);
  form.set("type", "manual_upload");
}

async function postUploadedFile(filename: string, buffer: Buffer, subject: string, type: string): Promise<Response> {
  const form = new FormData();
  appendCommonFields(form, subject);
  form.set("sourceFile", new File([buffer], filename, { type }));
  return POST(requestWithForm(form));
}

test("manual source API imports generated document files into isolated storage", async () => {
  const responses = await Promise.all([
    postUploadedFile(
      "minuta-docx.docx",
      await fixtureDocx("Bogdan verifica lista de PV-uri pana maine."),
      "Minuta DOCX",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ),
    postUploadedFile(
      "minuta-pdf.pdf",
      fixturePdf("AVT transmite raport maine"),
      "Minuta PDF",
      "application/pdf"
    ),
    postUploadedFile(
      "taskuri-xlsx.xlsx",
      await fixtureXlsx([["Responsabil", "Task"], ["Sika", "Transmite oferta finala maine"]]),
      "Minuta XLSX",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
  ]);

  assert.deepEqual(responses.map((response) => response.status), [303, 303, 303]);

  const tasks = await store.listProposedTasks();
  const sources = await store.listSources();
  assert.equal(sources.length, 3);
  assert.ok(tasks.some((task) => task.evidence.includes("Bogdan verifica lista")));
  assert.ok(tasks.some((task) => task.evidence.includes("AVT transmite raport")));
  assert.ok(tasks.some((task) => task.evidence.includes("Sika")));
});

test("manual source API imports eml attachments into isolated storage", async () => {
  const eml = await fixtureEmlWithDocxAttachment("Soprema si Bouder transmite solutie maine.");
  const form = new FormData();
  appendCommonFields(form, "EML cu atasament");
  form.set("sourceFile", new File([Buffer.from(eml, "utf8")], "minuta.eml", { type: "message/rfc822" }));

  const response = await POST(requestWithForm(form));
  assert.equal(response.status, 303);

  const tasks = await store.listProposedTasks();
  assert.ok(tasks.some((task) => task.evidence.includes("Soprema si Bouder transmite solutie")));
});
