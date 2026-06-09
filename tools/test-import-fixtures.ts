import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import { extractDocumentText } from "@repo/domain/document-extract";
import { parseEmailPasteWithAttachments } from "@repo/domain/email-format";

async function fixtureDocx(text: string): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body>
</w:document>`);
  return Buffer.from(await zip.generateAsync({ type: "uint8array" }));
}

async function fixtureXlsx(rows: string[][]): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`);
  zip.file("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/></sheets></workbook>`);
  zip.file("xl/worksheets/sheet1.xml", `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    ${rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, colIndex) => `<c r="${String.fromCharCode(65 + colIndex)}${rowIndex + 1}" t="inlineStr"><is><t>${value}</t></is></c>`).join("")}</row>`).join("")}
  </sheetData>
</worksheet>`);
  return Buffer.from(await zip.generateAsync({ type: "uint8array" }));
}

function fixturePdf(text: string): Buffer {
  const stream = `BT /F1 18 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(pdf, "ascii"));
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "ascii");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Root 1 0 R /Size ${objects.length + 1} >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "ascii");
}

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
  const docx = await fixtureDocx("Soprema si Bouder transmite solutie maine.");
  const boundary = "taskwizard-boundary";
  const eml = [
    "From: Manager <manager@example.com>",
    "To: Bogdan <bogdan@example.com>",
    "Subject: Minuta cu atasament",
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    "Salut, vezi atasamentul.",
    `--${boundary}`,
    "Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document; name=\"minuta.docx\"",
    "Content-Disposition: attachment; filename=\"minuta.docx\"",
    "Content-Transfer-Encoding: base64",
    "",
    docx.toString("base64"),
    `--${boundary}--`
  ].join("\r\n");

  const parsed = await parseEmailPasteWithAttachments({ rawEmail: eml, fallbackActorEmail: "bogdan@example.com" });
  assert.equal(parsed.subject, "Minuta cu atasament");
  assert.equal(parsed.attachments.length, 1);
  assert.match(parsed.rawText, /Soprema si Bouder transmite solutie/);
});
