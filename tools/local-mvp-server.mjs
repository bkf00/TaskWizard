import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const port = Number(process.env.PORT ?? 3000);
const dataDir = path.resolve(process.env.LOCAL_DATA_DIR ?? "./data");
const storePath = path.join(dataDir, "store.json");

const emptyStore = {
  sources: [],
  proposedTasks: [],
  auditEvents: [],
  processingErrors: []
};
const allowedSourceTypes = new Set(["email", "teams_transcript", "manual_upload"]);
const defaultActorEmail = process.env.LOCAL_ACTOR_EMAIL ?? "approver@firma.ro";
const statusFilters = [
  "proposed",
  "planner_sync_failed",
  "approved",
  "created_in_planner",
  "completed_in_planner",
  "deleted_in_planner",
  "rejected"
];
const plannerTerminalSourceStatuses = new Set(["approved", "created_in_planner", "planner_sync_failed"]);

async function readStore() {
  try {
    return { ...emptyStore, ...JSON.parse(await readFile(storePath, "utf8")) };
  } catch (error) {
    if (error.code === "ENOENT") return structuredClone(emptyStore);
    throw error;
  }
}

async function writeStore(data) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(storePath, JSON.stringify(data, null, 2), "utf8");
}

function id(prefix) {
  return `${prefix}_${randomUUID()}`;
}

function hashSource({ type, subject, rawText }) {
  return createHash("sha256")
    .update(type)
    .update("|")
    .update(subject.trim().toLowerCase())
    .update("|")
    .update(rawText.trim())
    .digest("hex");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function unfoldHeaders(raw) {
  return raw.replace(/\r?\n[ \t]+/g, " ");
}

function headerValue(raw, name) {
  const match = unfoldHeaders(raw).match(new RegExp(`^${name}:\\s*(.+)$`, "im"));
  return match?.[1]?.trim() ?? null;
}

function emailAddresses(value) {
  if (!value) return [];
  return [...new Set(value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [])];
}

function decodeQuotedPrintable(value) {
  return value
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)));
}

function stripMimeNoise(value) {
  return value
    .split(/\r?\n/)
    .filter((line) => !line.startsWith("--_"))
    .filter((line) => !/^Content-(Type|Transfer-Encoding|ID|Disposition):/i.test(line))
    .filter((line) => !/^MIME-Version:/i.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseEmailPaste(rawEmail, actorEmail) {
  const subject = headerValue(rawEmail, "Subject") ?? "Email fara subiect";
  const fromEmail = emailAddresses(headerValue(rawEmail, "From"))[0] ?? null;
  const participants = [
    ...emailAddresses(headerValue(rawEmail, "To")),
    ...emailAddresses(headerValue(rawEmail, "CC")),
    actorEmail
  ].filter(Boolean);
  const textPlainMatch = rawEmail.match(/Content-Type:\s*text\/plain[\s\S]*?\r?\n\r?\n([\s\S]*?)(?=\r?\n--[^\r\n]+|$)/i);
  const fallbackBody = rawEmail.split(/\r?\n\r?\n/).slice(1).join("\n\n") || rawEmail;
  const body = textPlainMatch?.[1] ?? fallbackBody;

  return {
    type: "email",
    subject,
    fromEmail,
    participants: [...new Set(participants)],
    rawText: stripMimeNoise(decodeQuotedPrintable(body))
  };
}

function normalizeLine(line) {
  return line.replace(/\s+/g, " ").replace(/^[*•-]\s*/, "").trim();
}

function compactTaskTitle(actionText) {
  const normalized = normalizeLine(actionText);
  const knownPatterns = [
    { pattern: /\bpoze\w*\b.*\bsondaj/i, title: "Transmite poze sondaj" },
    { pattern: /\bdraft\w*\b.*\braspuns\b.*\bautorizatie/i, title: "Pregateste raspuns autorizatie" },
    { pattern: /\bdisponibilitatea\b.*\bmembranei\b/i, title: "Confirma disponibilitate membrana" },
    { pattern: /\braspuns\b.*\bsondaj/i, title: "Transmite raspuns sondaj" },
    { pattern: /\blista\s+material\w*/i, title: "Trimite lista materiale" },
    { pattern: /\bmaterialele\b.*\bsondaj/i, title: "Transmite disponibilitate materiale" },
    { pattern: /\bdetali\w*\s+(?:de|pentru)\s+prinderi/i, title: "Pregateste detaliu prinderi" },
    { pattern: /\bclarific\w*\b.*\bacord\w*\s+tripartit/i, title: "Clarifica acord tripartit" },
    { pattern: /\bacord\w*\s+tripartit/i, title: "Transmite acord tripartit" },
    { pattern: /\bdraft\s+de\s+procedura/i, title: "Transmite draft procedura" },
    { pattern: /\barhiva\b.*\bverifica/i, title: "Verifica arhiva proiect" },
    { pattern: /\bcentralizator\w*\s+IMSAT/i, title: "Actualizeaza centralizator IMSAT" },
    { pattern: /\bvarianta\s+curata\b.*\btabel/i, title: "Transmite tabel curat client" },
    { pattern: /\bpersoana\b.*\bsemneaza/i, title: "Confirma semnatar minute" }
  ];
  const known = knownPatterns.find((item) => item.pattern.test(normalized));
  if (known) return known.title;

  const fillerWords = new Set([
    "a",
    "ale",
    "al",
    "catre",
    "cu",
    "de",
    "dimineata",
    "din",
    "in",
    "la",
    "maine",
    "marti",
    "miercuri",
    "pe",
    "pentru",
    "poimaine",
    "privind",
    "pt",
    "pana",
    "respectiv",
    "sa",
    "se",
    "si",
    "termenul",
    "un",
    "unei",
    "unui",
    "va",
    "vor"
  ]);
  const cleaned = normalized
    .replace(/^(te rog|va rog|ramane sa|de facut|trebuie sa|trebuie)\s+/i, "")
    .replace(/[.,;:]+$/g, "");
  const words = cleaned
    .split(/\s+/)
    .map((word) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}-]+$/gu, ""))
    .filter(Boolean)
    .filter((word, index) => index === 0 || !fillerWords.has(word.toLowerCase()))
    .slice(0, 5);
  const title = words.join(" ") || cleaned;
  return title.charAt(0).toUpperCase() + title.slice(1);
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function referenceDate() {
  const configured = process.env.LOCAL_TODAY;
  if (configured && /^\d{4}-\d{2}-\d{2}$/.test(configured)) return new Date(`${configured}T00:00:00.000Z`);
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

function extractDueDate(text, baseDate = referenceDate()) {
  const normalized = normalizeLine(text).toLowerCase();
  const explicit = normalized.match(/\b(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?\b/);
  if (explicit) {
    const day = Number(explicit[1]);
    const month = Number(explicit[2]);
    let year = explicit[3] ? Number(explicit[3]) : baseDate.getUTCFullYear();
    if (year < 100) year += 2000;
    const candidate = new Date(Date.UTC(year, month - 1, day));
    if (candidate.getUTCFullYear() === year && candidate.getUTCMonth() === month - 1 && candidate.getUTCDate() === day) {
      return isoDate(candidate);
    }
  }

  if (/\bazi\b/.test(normalized)) return isoDate(baseDate);
  if (/\bpoimaine\b/.test(normalized)) return isoDate(addDays(baseDate, 2));
  if (/\bmaine\b/.test(normalized)) return isoDate(addDays(baseDate, 1));

  const weekdays = [
    ["duminica", "duminică"],
    ["luni"],
    ["marti", "marți"],
    ["miercuri"],
    ["joi"],
    ["vineri"],
    ["sambata", "sâmbătă"]
  ];
  const today = baseDate.getUTCDay();
  for (let target = 0; target < weekdays.length; target += 1) {
    if (weekdays[target].some((day) => new RegExp(`\\b${day}\\b`, "i").test(normalized))) {
      const diff = (target - today + 7) % 7 || 7;
      return isoDate(addDays(baseDate, diff));
    }
  }

  return null;
}

function structuredActionFromLine(line) {
  const normalized = normalizeLine(line);
  const structured = normalized.match(/^(?:(?:\d{1,2}\.\d{1,2}\.\d{4}|\d{4})\s*=\s*)?(.+?)\s+(trebuie|pregateste|pregatesc|transmite|transmit|trimite|verifica|actualizeaza|creeaza|preia|preluat|stabileste|confirma|clarifica)\b(.*)$/i);
  if (!structured) return null;

  const assigneeName = structured[1].trim().replace(/\s+(?:a|te rog|va rog)$/i, "");
  if (/^(te rog|ramane sa|de facut)$/i.test(assigneeName)) return null;
  const actionVerb = structured[2].trim();
  const actionRest = structured[3].trim();
  const title = compactTaskTitle(`${actionVerb} ${actionRest}`.trim());

  return {
    title,
    description: normalized,
    assigneeName: assigneeName.length <= 60 ? assigneeName : null,
    dueDate: extractDueDate(normalized)
  };
}

function fallbackExtract(source) {
  return source.rawText
    .split(/\r?\n/)
    .flatMap((line) => (line.includes("=") ? [line] : line.split(/(?<=[.;])\s+/)))
    .map(normalizeLine)
    .filter(Boolean)
    .filter((line) => !/^daca sunt elemente pe care le-am omis/i.test(line))
    .filter((line) => !/^(taskuri|actiuni|acțiuni|de facut|de făcut)\b/i.test(line))
    .filter((line) => !/:\s*$/.test(line))
    .filter((line) =>
      /\b(trebuie|de facut|rog|te rog|ramane|verifica|trimite|transmite|pregateste|pregatesc|actualizeaza|creeaza|preia|preluat|stabileste|confirma|clarifica)\b/i.test(line)
    )
    .slice(0, 5)
    .map((line) => {
      const structured = structuredActionFromLine(line);
      return {
        id: id("ptask"),
        sourceId: source.id,
        title: structured?.title ?? compactTaskTitle(line),
        description: structured?.description ?? line,
        assigneeEmail: null,
        assigneeName: structured?.assigneeName ?? null,
        dueDate: structured?.dueDate ?? extractDueDate(line),
        projectHint: null,
        confidence: structured ? "medium" : "low",
        evidence: line,
        status: "proposed",
        approvedBy: null,
        approvedAt: null,
        plannerTaskId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    });
}

function audit(data, event) {
  data.auditEvents.push({
    id: id("audit"),
    actorEmail: event.actorEmail ?? null,
    sourceId: event.sourceId ?? null,
    proposedTaskId: event.proposedTaskId ?? null,
    metadata: {},
    createdAt: new Date().toISOString(),
    ...event
  });
}

function actorFromForm(form) {
  return String(form.actorEmail || defaultActorEmail).trim() || defaultActorEmail;
}

async function parseForm(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  const params = new URLSearchParams(raw);
  return Object.fromEntries(params.entries());
}

function redirect(res) {
  res.writeHead(303, { Location: "/" });
  res.end();
}

async function handleIngest(req, res) {
  const form = await parseForm(req);
  const actorEmail = actorFromForm(form);
  const parsedEmail = String(form.rawEmail || "").trim()
    ? parseEmailPaste(String(form.rawEmail || "").trim(), actorEmail)
    : null;
  const type = parsedEmail?.type ?? form.type ?? "manual_upload";
  const subject = parsedEmail?.subject ?? String(form.subject || "").trim();
  const rawText = parsedEmail?.rawText ?? String(form.rawText || "").trim();
  const sourceHash = hashSource({ type, subject, rawText });
  const data = await readStore();

  if (!subject || !rawText) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Subiectul si textul sunt obligatorii.");
    return;
  }
  if (!allowedSourceTypes.has(type)) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Tipul sursei este invalid.");
    return;
  }

  const existing = data.sources.find((source) => source.sourceHash === sourceHash);
  if (existing) {
    const existingTasks = data.proposedTasks.filter((task) => task.sourceId === existing.id);
    const hasReviewableTasks = existingTasks.some((task) => task.status === "proposed" || task.status === "planner_sync_failed");
    if (!hasReviewableTasks) {
      const tasks = fallbackExtract(existing);
      data.proposedTasks.push(...tasks);
      audit(data, {
        type: "source.reprocessed",
        actorEmail,
        sourceId: existing.id,
        message: `Sursa duplicata a fost reprocesata si au fost propuse ${tasks.length} taskuri.`
      });
      await writeStore(data);
      redirect(res);
      return;
    }
    audit(data, {
      type: "source.duplicate_ignored",
      actorEmail,
      sourceId: existing.id,
      message: "Sursa duplicata a fost ignorata."
    });
    await writeStore(data);
    redirect(res);
    return;
  }

  const now = new Date();
  const source = {
    id: id("src"),
    type,
    externalId: null,
    sourceHash,
    subject,
    fromEmail: parsedEmail?.fromEmail ?? form.fromEmail ?? null,
    participants:
      parsedEmail?.participants ??
      String(form.participants || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    rawText,
    receivedAt: now.toISOString(),
    retentionUntil: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    status: "processed",
    errorMessage: null
  };

  data.sources.push(source);
  audit(data, { type: "source.received", actorEmail, sourceId: source.id, message: "Sursa a fost primita." });
  const tasks = fallbackExtract(source);
  data.proposedTasks.push(...tasks);
  audit(data, {
    type: "source.extraction_completed",
    actorEmail,
    sourceId: source.id,
    message: `Au fost propuse ${tasks.length} taskuri.`
  });
  await writeStore(data);
  redirect(res);
}

async function handleApprove(req, res, taskId) {
  const form = await parseForm(req);
  const actorEmail = actorFromForm(form);
  const data = await readStore();
  const task = data.proposedTasks.find((item) => item.id === taskId);
  if (!task) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Taskul nu exista.");
    return;
  }
  if (task.status !== "proposed" && task.status !== "planner_sync_failed") {
    res.writeHead(409, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(`Taskul nu poate fi aprobat din statusul ${task.status}.`);
    return;
  }
  task.status = process.env.PLANNER_PLAN_ID ? "approved" : "planner_sync_failed";
  task.approvedBy = actorEmail;
  task.approvedAt = new Date().toISOString();
  task.updatedAt = new Date().toISOString();
  audit(data, { type: "task.approved", actorEmail, proposedTaskId: task.id, sourceId: task.sourceId, message: "Task aprobat." });
  if (task.status === "planner_sync_failed") {
    data.processingErrors.push({
      id: id("perr"),
      sourceId: task.sourceId,
      proposedTaskId: task.id,
      stage: "planner_sync",
      message: "Planner nu este configurat in .env. Taskul ramane aprobat local.",
      retryable: true,
      createdAt: new Date().toISOString()
    });
  }
  await writeStore(data);
  redirect(res);
}

async function handleUpdate(req, res, taskId) {
  const form = await parseForm(req);
  const actorEmail = actorFromForm(form);
  const data = await readStore();
  const task = data.proposedTasks.find((item) => item.id === taskId);
  if (!task) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Taskul nu exista.");
    return;
  }
  if (task.status !== "proposed" && task.status !== "planner_sync_failed") {
    res.writeHead(409, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(`Taskul nu poate fi editat din statusul ${task.status}.`);
    return;
  }

  const title = String(form.title || "").trim();
  if (title.length < 3) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Titlul taskului trebuie sa aiba cel putin 3 caractere.");
    return;
  }

  task.title = title;
  task.description = String(form.description || "").trim() || null;
  task.assigneeEmail = String(form.assigneeEmail || "").trim() || null;
  task.assigneeName = String(form.assigneeName || "").trim() || null;
  task.dueDate = String(form.dueDate || "").trim() || null;
  task.projectHint = String(form.projectHint || "").trim() || null;
  task.updatedAt = new Date().toISOString();

  audit(data, { type: "task.updated", actorEmail, proposedTaskId: task.id, sourceId: task.sourceId, message: "Task editat." });
  await writeStore(data);
  redirect(res);
}

async function handleReject(req, res, taskId) {
  const form = await parseForm(req);
  const actorEmail = actorFromForm(form);
  const data = await readStore();
  const task = data.proposedTasks.find((item) => item.id === taskId);
  if (!task) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Taskul nu exista.");
    return;
  }
  if (task.status !== "proposed") {
    res.writeHead(409, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(`Taskul nu poate fi respins din statusul ${task.status}.`);
    return;
  }
  task.status = "rejected";
  task.updatedAt = new Date().toISOString();
  audit(data, { type: "task.rejected", actorEmail, proposedTaskId: task.id, sourceId: task.sourceId, message: "Task respins." });
  await writeStore(data);
  redirect(res);
}

async function handleComplete(req, res, taskId) {
  const form = await parseForm(req);
  const actorEmail = actorFromForm(form);
  const data = await readStore();
  const task = data.proposedTasks.find((item) => item.id === taskId);
  if (!task) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Taskul nu exista.");
    return;
  }
  if (!plannerTerminalSourceStatuses.has(task.status)) {
    res.writeHead(409, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(`Taskul nu poate fi marcat terminat din statusul ${task.status}.`);
    return;
  }
  const previousStatus = task.status;
  task.status = "completed_in_planner";
  task.updatedAt = new Date().toISOString();
  audit(data, {
    type: "task.completed",
    actorEmail,
    proposedTaskId: task.id,
    sourceId: task.sourceId,
    message: "Task marcat ca terminat.",
    metadata: { previousStatus, plannerTaskId: task.plannerTaskId }
  });
  await writeStore(data);
  redirect(res);
}

async function handleDelete(req, res, taskId) {
  const form = await parseForm(req);
  const actorEmail = actorFromForm(form);
  const data = await readStore();
  const task = data.proposedTasks.find((item) => item.id === taskId);
  if (!task) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Taskul nu exista.");
    return;
  }
  if (!plannerTerminalSourceStatuses.has(task.status)) {
    res.writeHead(409, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(`Taskul nu poate fi marcat sters din statusul ${task.status}.`);
    return;
  }
  const previousStatus = task.status;
  task.status = "deleted_in_planner";
  task.updatedAt = new Date().toISOString();
  audit(data, {
    type: "task.deleted",
    actorEmail,
    proposedTaskId: task.id,
    sourceId: task.sourceId,
    message: "Task marcat ca sters din Planner.",
    metadata: { previousStatus, plannerTaskId: task.plannerTaskId }
  });
  await writeStore(data);
  redirect(res);
}

async function renderHome(res) {
  const data = await readStore();
  const tasks = [...data.proposedTasks].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const sourcesById = new Map(data.sources.map((source) => [source.id, source]));
  const taskStatusCounts = tasks.reduce((acc, task) => {
    acc[task.status] = (acc[task.status] ?? 0) + 1;
    return acc;
  }, {});
  const errors = [...data.processingErrors].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const auditEvents = [...data.auditEvents].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const reviewTasks = tasks.filter((task) => task.status === "proposed");
  const plannerActiveTasks = tasks.filter((task) => plannerTerminalSourceStatuses.has(task.status));

  const html = `<!doctype html>
<html lang="ro">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Taskuri AI</title>
  <style>
    :root{--bg:#f6f7f9;--surface:#fff;--surface-2:#fbfcfd;--line:#d8dee8;--text:#17202a;--muted:#657083;--accent:#12635f;--danger:#b42318;--danger-bg:#fee4e2;--ok:#067647;--ok-bg:#dcfae6;--archived:#475467;--archived-bg:#f2f4f7}
    *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:Inter,Arial,Helvetica,sans-serif}main{max-width:1380px;margin:0 auto;padding:22px 22px 48px}h1,h2,h3,p{margin-top:0}h1{font-size:24px;line-height:1.2;margin-bottom:4px}h2{font-size:15px;margin-bottom:12px}.muted{color:var(--muted)}.app-header{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:18px}.summary{display:flex;gap:8px;flex-wrap:wrap}.metric{background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:9px 12px;min-width:108px}.metric strong{display:block;font-size:20px}.workspace{display:grid;grid-template-columns:330px minmax(0,1fr) 300px;gap:16px;align-items:start}.panel{background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:16px}.panel-subtle{background:var(--surface-2)}label{display:block;font-size:12px;font-weight:700;color:#344054;margin:12px 0 6px}input,select,textarea{width:100%;border:1px solid #cbd5e1;border-radius:6px;padding:9px 10px;background:#fff;color:var(--text);font:inherit}textarea{min-height:170px;resize:vertical}button{border:0;border-radius:6px;background:var(--accent);color:#fff;font-weight:700;padding:9px 12px;cursor:pointer}.button-muted{background:#eef2f6;color:#263445}.danger{background:var(--danger-bg);color:var(--danger)}.task-list{display:grid;gap:10px}.task-card{background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:14px}.task-card[data-status="planner_sync_failed"]{border-color:#f6c7c3}.task-top{display:flex;justify-content:space-between;gap:12px}.task-title{font-weight:800;font-size:15px;line-height:1.35}.badge{display:inline-flex;align-items:center;border-radius:999px;background:#eef2f6;color:#344054;padding:4px 8px;font-size:12px;font-weight:700;white-space:nowrap}.proposed{background:#e0f2fe;color:#075985}.planner_sync_failed,.rejected,.deleted_in_planner{background:var(--danger-bg);color:var(--danger)}.approved,.created_in_planner,.completed_in_planner{background:var(--ok-bg);color:var(--ok)}.deleted_in_planner,.completed_in_planner{background:var(--archived-bg);color:var(--archived)}.meta{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}.evidence{border-left:3px solid #b7c4d5;background:#f8fafc;margin:10px 0;padding:9px 10px;color:#334155;font-size:13px}.source{font-size:12px;color:var(--muted);margin-top:6px}.edit{border-top:1px solid var(--line);margin-top:12px;padding-top:10px}.edit textarea{min-height:74px}.advanced summary,.edit summary{cursor:pointer;color:#344054;font-size:13px;font-weight:700}.compact{display:grid;grid-template-columns:1fr 150px;gap:8px}.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.filters{display:flex;flex-wrap:wrap;gap:7px;margin:8px 0 12px}.task-table{width:100%;border-collapse:collapse;font-size:13px}.task-table th,.task-table td{border-top:1px solid var(--line);padding:8px;text-align:left;vertical-align:top}.task-table th{color:var(--muted);font-size:12px}.task-row{display:table-row}.task-row.hidden{display:none}.event{border-top:1px solid var(--line);padding:10px 0;font-size:13px}.empty{border:1px dashed var(--line);border-radius:8px;padding:20px;text-align:center;color:var(--muted);background:#fbfcfd}.review-heading{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:12px}.review-heading p{margin:0}.drawer{display:grid;gap:12px;position:sticky;top:16px}@media(max-width:1100px){.workspace{grid-template-columns:1fr}.drawer{position:static}.app-header{display:block}.summary{margin-top:12px}}@media(max-width:680px){main{padding:14px}.compact{grid-template-columns:1fr}.task-top{display:block}.badge{margin-top:8px}}
  </style>
  <script>
    function filterTasks(status) {
      document.querySelectorAll("[data-task-row]").forEach((row) => {
        row.classList.toggle("hidden", status !== "all" && row.dataset.status !== status);
      });
    }
    function loadEmailFile(input) {
      const file = input.files && input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const target = document.querySelector("[name='rawEmail']");
        if (target) target.value = String(reader.result || "");
      };
      reader.readAsText(file);
    }
  </script>
</head>
<body>
<main>
  <header class="app-header">
    <div>
      <h1>TaskWizard</h1>
      <p class="muted">Inbox de verificare pentru taskuri extrase din emailuri si minute.</p>
    </div>
    <div class="summary">
      <div class="metric"><strong>${reviewTasks.length}</strong><span class="muted">de verificat</span></div>
      <div class="metric"><strong>${tasks.length}</strong><span class="muted">total taskuri</span></div>
      <div class="metric"><strong>${errors.length}</strong><span class="muted">erori</span></div>
    </div>
  </header>

  <div class="workspace">
    <aside class="panel panel-subtle">
      <h2>Import email</h2>
      <form method="post" action="/sources/manual">
        <label>Procesat de</label><input name="actorEmail" type="email" value="${escapeHtml(defaultActorEmail)}" />
        <label>Fisier .eml</label><input type="file" accept=".eml,message/rfc822,text/plain" onchange="loadEmailFile(this)" />
        <label>Email complet / text copiat</label><textarea name="rawEmail" required placeholder="Alege fisierul .eml sau lipeste emailul complet aici."></textarea>
        <p><button type="submit">Extrage taskuri propuse</button></p>
      </form>
      <details class="advanced">
        <summary>Introducere avansata</summary>
        <form method="post" action="/sources/manual">
          <input type="hidden" name="actorEmail" value="${escapeHtml(defaultActorEmail)}" />
          <label>Tip sursa</label><select name="type"><option value="manual_upload">Recap / text manual</option><option value="email">Email copiat</option><option value="teams_transcript">Transcript Teams</option></select>
          <label>Subiect</label><input name="subject" />
          <label>Expeditor / organizator</label><input name="fromEmail" type="email" />
          <label>Participanti</label><input name="participants" placeholder="email1, email2" />
          <label>Text</label><textarea name="rawText"></textarea>
          <p><button type="submit">Proceseaza sursa avansata</button></p>
        </form>
      </details>
    </aside>

    <section class="panel">
      <div class="review-heading">
        <div>
          <h2>Review taskuri</h2>
          <p class="muted">Verifica titlul, responsabilul si dovada inainte de aprobare.</p>
        </div>
        <span class="badge proposed">${reviewTasks.length} active</span>
      </div>
      <div class="task-list">${reviewTasks.length ? reviewTasks.map((task) => {
        const source = sourcesById.get(task.sourceId);
        return `
        <article class="task-card" data-status="${escapeHtml(task.status)}">
          <div class="task-top">
            <div class="task-title">${escapeHtml(task.title)}</div>
            <span class="badge ${escapeHtml(task.status)}">${escapeHtml(task.status)}</span>
          </div>
          <div class="meta">
            <span class="badge">${escapeHtml(task.assigneeName || task.assigneeEmail || "fara responsabil")}</span>
            <span class="badge">${escapeHtml(task.dueDate || "fara termen")}</span>
            <span class="badge">confidence: ${escapeHtml(task.confidence)}</span>
          </div>
          <div class="evidence">${escapeHtml(task.evidence)}</div>
          <div class="source">${escapeHtml(source?.subject ?? "sursa necunoscuta")}</div>
          <details class="edit">
            <summary>Editeaza taskul</summary>
            <form method="post" action="/tasks/${task.id}/update">
              <input type="hidden" name="actorEmail" value="${escapeHtml(defaultActorEmail)}" />
              <label>Titlu</label><input name="title" value="${escapeHtml(task.title)}" required />
              <div class="compact"><div><label>Responsabil</label><input name="assigneeName" value="${escapeHtml(task.assigneeName || task.assigneeEmail || "")}" /></div><div><label>Termen</label><input name="dueDate" type="date" value="${escapeHtml(task.dueDate || "")}" /></div></div>
              <label>Descriere</label><textarea name="description">${escapeHtml(task.description || "")}</textarea>
              <label>Proiect</label><input name="projectHint" value="${escapeHtml(task.projectHint || "")}" />
              <div class="actions"><button class="button-muted" type="submit">Salveaza</button></div>
            </form>
          </details>
          <div class="actions">
            <form method="post" action="/tasks/${task.id}/approve"><input type="hidden" name="actorEmail" value="${escapeHtml(defaultActorEmail)}" /><button>Aproba</button></form>
            ${plannerTerminalSourceStatuses.has(task.status) ? `<form method="post" action="/tasks/${task.id}/complete"><input type="hidden" name="actorEmail" value="${escapeHtml(defaultActorEmail)}" /><button class="button-muted">Marcheaza terminat</button></form><form method="post" action="/tasks/${task.id}/delete"><input type="hidden" name="actorEmail" value="${escapeHtml(defaultActorEmail)}" /><button class="danger">Marcheaza sters</button></form>` : ""}
            ${task.status === "proposed" ? `<form method="post" action="/tasks/${task.id}/reject"><input type="hidden" name="actorEmail" value="${escapeHtml(defaultActorEmail)}" /><button class="danger">Respinge</button></form>` : ""}
          </div>
        </article>`;
      }).join("") : `<div class="empty">Nu exista taskuri de verificat.</div>`}</div>
      <div class="review-heading" style="margin-top:18px">
        <div>
          <h2>Taskuri active / aprobate</h2>
          <p class="muted">Aici apar butoanele de terminare sau stergere dupa aprobare.</p>
        </div>
        <span class="badge created_in_planner">${plannerActiveTasks.length} active</span>
      </div>
      <div class="task-list">${plannerActiveTasks.length ? plannerActiveTasks.map((task) => {
        const source = sourcesById.get(task.sourceId);
        return `
        <article class="task-card" data-status="${escapeHtml(task.status)}">
          <div class="task-top">
            <div class="task-title">${escapeHtml(task.title)}</div>
            <span class="badge ${escapeHtml(task.status)}">${escapeHtml(task.status)}</span>
          </div>
          <div class="meta">
            <span class="badge">${escapeHtml(task.assigneeName || task.assigneeEmail || "fara responsabil")}</span>
            <span class="badge">${escapeHtml(task.dueDate || "fara termen")}</span>
            ${task.plannerTaskId ? `<span class="badge">Planner: ${escapeHtml(task.plannerTaskId)}</span>` : ""}
          </div>
          <div class="evidence">${escapeHtml(task.description || task.evidence)}</div>
          <div class="source">${escapeHtml(source?.subject ?? "sursa necunoscuta")}</div>
          <div class="actions">
            <form method="post" action="/tasks/${task.id}/complete"><input type="hidden" name="actorEmail" value="${escapeHtml(defaultActorEmail)}" /><button class="button-muted">Marcheaza terminat</button></form>
            <form method="post" action="/tasks/${task.id}/delete"><input type="hidden" name="actorEmail" value="${escapeHtml(defaultActorEmail)}" /><button class="danger">Marcheaza sters</button></form>
          </div>
        </article>`;
      }).join("") : `<div class="empty">Nu exista taskuri aprobate. Aproba un task propus, apoi vor aparea aici butoanele Marcheaza terminat si Marcheaza sters.</div>`}</div>
    </section>

    <aside class="drawer">
      <section class="panel">
        <h2>Toate taskurile</h2>
    <div class="filters">
      <button type="button" onclick="filterTasks('all')">Toate (${tasks.length})</button>
      ${statusFilters
        .map((status) => `<button type="button" onclick="filterTasks('${status}')">${status} (${taskStatusCounts[status] ?? 0})</button>`)
        .join("")}
    </div>
    ${
      tasks.length
        ? `<table class="task-table">
            <thead><tr><th>Status</th><th>Titlu</th><th>Responsabil</th><th>Termen</th><th>Proiect</th><th>Actiuni</th></tr></thead>
            <tbody>
              ${tasks
                .map(
                  (task) => `<tr class="task-row" data-task-row data-status="${escapeHtml(task.status)}"><td><span class="badge ${escapeHtml(task.status)}">${escapeHtml(task.status)}</span></td><td>${escapeHtml(task.title)}</td><td>${escapeHtml(task.assigneeName || task.assigneeEmail || "fara responsabil")}</td><td>${escapeHtml(task.dueDate || "fara termen")}</td><td>${escapeHtml(task.projectHint || "-")}</td><td>${plannerTerminalSourceStatuses.has(task.status) ? `<div class="actions"><form method="post" action="/tasks/${task.id}/complete"><input type="hidden" name="actorEmail" value="${escapeHtml(defaultActorEmail)}" /><button class="button-muted">Terminat</button></form><form method="post" action="/tasks/${task.id}/delete"><input type="hidden" name="actorEmail" value="${escapeHtml(defaultActorEmail)}" /><button class="danger">Sters</button></form></div>` : "-"}</td></tr>`
                )
                .join("")}
            </tbody>
          </table>`
        : `<p class="muted">Nu exista taskuri inca.</p>`
    }
      </section>
      <section class="panel"><h2>Erori</h2>${errors.length ? errors.slice(0,5).map((error) => `<div class="event"><strong>${escapeHtml(error.stage)}</strong><br>${escapeHtml(error.message)}</div>`).join("") : `<p class="muted">Nu exista erori.</p>`}</section>
      <section class="panel"><h2>Audit recent</h2>${auditEvents.length ? auditEvents.slice(0,6).map((event) => `<div class="event"><strong>${escapeHtml(event.type)}</strong><br><span class="muted">${escapeHtml(event.message)}</span></div>`).join("") : `<p class="muted">Nu exista evenimente.</p>`}</section>
    </aside>
  </div>
</main>
</body>
</html>`;

  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    if (req.method === "GET" && url.pathname === "/") return renderHome(res);
    if (req.method === "POST" && url.pathname === "/sources/manual") return handleIngest(req, res);
    const approve = url.pathname.match(/^\/tasks\/([^/]+)\/approve$/);
    if (req.method === "POST" && approve) return handleApprove(req, res, approve[1]);
    const update = url.pathname.match(/^\/tasks\/([^/]+)\/update$/);
    if (req.method === "POST" && update) return handleUpdate(req, res, update[1]);
    const reject = url.pathname.match(/^\/tasks\/([^/]+)\/reject$/);
    if (req.method === "POST" && reject) return handleReject(req, res, reject[1]);
    const complete = url.pathname.match(/^\/tasks\/([^/]+)\/complete$/);
    if (req.method === "POST" && complete) return handleComplete(req, res, complete[1]);
    const deleteTask = url.pathname.match(/^\/tasks\/([^/]+)\/delete$/);
    if (req.method === "POST" && deleteTask) return handleDelete(req, res, deleteTask[1]);
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  } catch (error) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(error instanceof Error ? error.stack : String(error));
  }
}).listen(port, () => {
  console.log(`Local MVP server: http://localhost:${port}`);
});
