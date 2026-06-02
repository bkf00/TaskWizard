export type ExtractedDocumentText = {
  filename: string;
  text: string;
  supported: boolean;
  warning?: string;
};

const supportedExtensions = new Set([
  ".doc",
  ".docx",
  ".pdf",
  ".csv",
  ".txt",
  ".xlsx",
  ".xlsm"
]);

function extensionOf(filename: string): string {
  const match = filename.toLowerCase().match(/\.[a-z0-9]+$/);
  return match?.[0] ?? "";
}

function normalizeExtractedText(value: string): string {
  return value
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeXmlText(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
}

function stripXml(value: string): string {
  return decodeXmlText(value.replace(/<[^>]+>/g, ""));
}

function decodeTextBuffer(buffer: Buffer): string {
  const utf8 = buffer.toString("utf8");
  if (utf8.includes("\u0000")) {
    return buffer.toString("utf16le").replace(/\u0000/g, "");
  }
  return utf8;
}

function extractLegacyDocText(buffer: Buffer): ExtractedDocumentText["text"] {
  const utf16Words = buffer
    .toString("utf16le")
    .replace(/[^\p{L}\p{N}\s.,;:!?()[\]/\-–—@+%]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const latinWords = buffer
    .toString("latin1")
    .replace(/[^\p{L}\p{N}\s.,;:!?()[\]/\-–—@+%]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  return utf16Words.length >= latinWords.length ? utf16Words : latinWords;
}

async function extractDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function extractPdf(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  await parser.destroy();
  return result.text;
}

async function extractSpreadsheet(buffer: Buffer): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);
  const sharedStringsXml = await zip.file("xl/sharedStrings.xml")?.async("text");
  const sharedStrings = sharedStringsXml
    ? [...sharedStringsXml.matchAll(/<si[\s\S]*?<\/si>/g)].map((match) => stripXml(match[0]).trim())
    : [];
  const sheetFiles = Object.keys(zip.files)
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const sheets = await Promise.all(sheetFiles.map(async (filename, index) => {
    const xml = await zip.file(filename)?.async("text");
    if (!xml) return "";
    const rows = [...xml.matchAll(/<row[\s\S]*?<\/row>/g)].map((rowMatch) => {
      return [...rowMatch[0].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)].map((cellMatch) => {
        const attributes = cellMatch[1];
        const cellXml = cellMatch[2];
        const value = cellXml.match(/<v[^>]*>([\s\S]*?)<\/v>/)?.[1] ?? cellXml.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? "";
        if (!value) return "";
        if (/\bt="s"/.test(attributes)) return sharedStrings[Number(value)] ?? "";
        return decodeXmlText(value);
      }).filter(Boolean).join(", ");
    }).filter(Boolean);
    return [`# Sheet ${index + 1}`, ...rows].join("\n");
  }));

  return sheets.filter(Boolean).join("\n\n");
}

export function isSupportedDocument(filename: string): boolean {
  return supportedExtensions.has(extensionOf(filename));
}

export async function extractDocumentText(input: {
  filename: string;
  buffer: Buffer;
}): Promise<ExtractedDocumentText> {
  const extension = extensionOf(input.filename);
  if (!supportedExtensions.has(extension)) {
    return {
      filename: input.filename,
      text: "",
      supported: false,
      warning: `Tip fisier nesuportat: ${extension || "necunoscut"}.`
    };
  }

  try {
    if (extension === ".docx") {
      return { filename: input.filename, text: normalizeExtractedText(await extractDocx(input.buffer)), supported: true };
    }
    if (extension === ".pdf") {
      return { filename: input.filename, text: normalizeExtractedText(await extractPdf(input.buffer)), supported: true };
    }
    if ([".xlsx", ".xlsm"].includes(extension)) {
      return { filename: input.filename, text: normalizeExtractedText(await extractSpreadsheet(input.buffer)), supported: true };
    }
    if (extension === ".csv" || extension === ".txt") {
      return { filename: input.filename, text: normalizeExtractedText(decodeTextBuffer(input.buffer)), supported: true };
    }
    if (extension === ".doc") {
      return {
        filename: input.filename,
        text: normalizeExtractedText(extractLegacyDocText(input.buffer)),
        supported: true,
        warning: "Extractie best-effort pentru .doc vechi; documentele .docx sunt mult mai sigure."
      };
    }
  } catch (error) {
    return {
      filename: input.filename,
      text: "",
      supported: false,
      warning: error instanceof Error ? error.message : "Extractia documentului a esuat."
    };
  }

  return {
    filename: input.filename,
    text: "",
    supported: false,
    warning: `Tip fisier nesuportat: ${extension}.`
  };
}

export function formatExtractedDocuments(documents: ExtractedDocumentText[]): string {
  return documents
    .filter((document) => document.text)
    .map((document) => [`[Atasament: ${document.filename}]`, document.text].join("\n"))
    .join("\n\n");
}
