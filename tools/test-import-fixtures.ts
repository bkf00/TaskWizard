import assert from "node:assert/strict";
import test from "node:test";
import { extractDocumentText } from "@repo/domain/document-extract";
import { parseEmailPasteWithAttachments } from "@repo/domain/email-format";
import { fixtureDocx, fixtureEmlWithDocxAttachment, fixturePdf, fixtureXlsx } from "./test-fixtures";

test("extracts generated docx text", async () => {
  const result = await extractDocumentText({
    filename: "minuta.docx",
    buffer: await fixtureDocx("Sika transmite oferta finala maine.")
  });

  assert.equal(result.supported, true);
  assert.match(result.text, /Sika transmite oferta finala/);
});

test("extracts generated xlsx text", async () => {
  const result = await extractDocumentText({
    filename: "taskuri.xlsx",
    buffer: await fixtureXlsx([["Responsabil", "Task"], ["AVT", "Transmite detalii depozit materiale"]])
  });

  assert.equal(result.supported, true);
  assert.match(result.text, /AVT/);
  assert.match(result.text, /depozit materiale/);
});

test("extracts generated pdf text", async () => {
  const result = await extractDocumentText({
    filename: "minuta.pdf",
    buffer: fixturePdf("TaskWizard PDF transmite raport")
  });

  assert.equal(result.supported, true);
  assert.match(result.text, /TaskWizard PDF transmite raport/);
});

test("extracts csv and txt text", async () => {
  const csv = await extractDocumentText({ filename: "taskuri.csv", buffer: Buffer.from("AVT,Transmite puncte completare", "utf8") });
  const txt = await extractDocumentText({ filename: "minuta.txt", buffer: Buffer.from("Bogdan verifica lista PV-uri.", "utf8") });

  assert.equal(csv.supported, true);
  assert.match(csv.text, /Transmite puncte/);
  assert.equal(txt.supported, true);
  assert.match(txt.text, /verifica lista/);
});

test("parses eml with generated docx attachment", async () => {
  const eml = await fixtureEmlWithDocxAttachment("Soprema si Bouder transmite solutie maine.");

  const parsed = await parseEmailPasteWithAttachments({ rawEmail: eml, fallbackActorEmail: "bogdan@example.com" });
  assert.equal(parsed.subject, "Minuta cu atasament");
  assert.equal(parsed.attachments.length, 1);
  assert.match(parsed.rawText, /Soprema si Bouder transmite solutie/);
});
