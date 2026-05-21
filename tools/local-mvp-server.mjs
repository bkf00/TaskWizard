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

function fallbackExtract(source) {
  return source.rawText
    .split(/\r?\n|[.;]/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) =>
      /\b(trebuie|de facut|rog|te rog|ramane|verifica|trimite|pregateste|actualizeaza|creeaza)\b/i.test(line)
    )
    .slice(0, 5)
    .map((line) => ({
      id: id("ptask"),
      sourceId: source.id,
      title: line.length > 90 ? `${line.slice(0, 87)}...` : line,
      description: line,
      assigneeEmail: null,
      dueDate: null,
      projectHint: null,
      confidence: "low",
      evidence: line,
      status: "proposed",
      approvedBy: null,
      approvedAt: null,
      plannerTaskId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));
}

function audit(data, event) {
  data.auditEvents.push({
    id: id("audit"),
    actorEmail: null,
    sourceId: event.sourceId ?? null,
    proposedTaskId: event.proposedTaskId ?? null,
    metadata: {},
    createdAt: new Date().toISOString(),
    ...event
  });
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
  const type = form.type || "manual_upload";
  const subject = String(form.subject || "").trim();
  const rawText = String(form.rawText || "").trim();
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
    audit(data, {
      type: "source.duplicate_ignored",
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
    fromEmail: form.fromEmail || null,
    participants: String(form.participants || "")
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
  audit(data, { type: "source.received", sourceId: source.id, message: "Sursa a fost primita." });
  const tasks = fallbackExtract(source);
  data.proposedTasks.push(...tasks);
  audit(data, {
    type: "source.extraction_completed",
    sourceId: source.id,
    message: `Au fost propuse ${tasks.length} taskuri.`
  });
  await writeStore(data);
  redirect(res);
}

async function handleApprove(req, res, taskId) {
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
  task.approvedBy = "approver@firma.ro";
  task.approvedAt = new Date().toISOString();
  task.updatedAt = new Date().toISOString();
  audit(data, { type: "task.approved", proposedTaskId: task.id, sourceId: task.sourceId, message: "Task aprobat." });
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
  task.dueDate = String(form.dueDate || "").trim() || null;
  task.projectHint = String(form.projectHint || "").trim() || null;
  task.updatedAt = new Date().toISOString();

  audit(data, { type: "task.updated", proposedTaskId: task.id, sourceId: task.sourceId, message: "Task editat." });
  await writeStore(data);
  redirect(res);
}

async function handleReject(req, res, taskId) {
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
  audit(data, { type: "task.rejected", proposedTaskId: task.id, sourceId: task.sourceId, message: "Task respins." });
  await writeStore(data);
  redirect(res);
}

async function renderHome(res) {
  const data = await readStore();
  const tasks = [...data.proposedTasks].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const errors = [...data.processingErrors].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const auditEvents = [...data.auditEvents].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const html = `<!doctype html>
<html lang="ro">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Taskuri AI</title>
  <style>
    body{margin:0;background:#f7f8fa;color:#17202a;font-family:Arial,Helvetica,sans-serif}
    main{max-width:1120px;margin:0 auto;padding:28px 18px 48px}
    h1{margin:0 0 8px;font-size:28px} h2{font-size:18px;margin:0 0 14px}
    .muted{color:#667085}.grid{display:grid;grid-template-columns:390px 1fr;gap:18px;align-items:start}
    .panel,.task,.event{background:#fff;border:1px solid #d9dee7;border-radius:8px}.panel{padding:18px}.task{padding:14px}.event{padding:10px;font-size:13px}
    label{display:block;font-size:13px;font-weight:700;margin:12px 0 6px}
    input,select,textarea{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:6px;padding:10px;font:inherit}
    textarea{min-height:170px;resize:vertical}button{border:0;border-radius:6px;background:#0f766e;color:#fff;font-weight:700;padding:9px 13px;cursor:pointer}
    .danger{background:#fee4e2;color:#b42318}.stack{display:grid;gap:10px}.row{display:flex;justify-content:space-between;gap:10px}
    .badge{display:inline-block;border-radius:999px;background:#eef2f6;padding:4px 8px;font-size:12px;font-weight:700;margin:3px}
    .proposed{background:#e0f2fe;color:#075985}.planner_sync_failed,.rejected{background:#fee4e2;color:#b42318}.approved,.created_in_planner{background:#dcfae6;color:#067647}
    .edit{border-top:1px solid #d9dee7;margin-top:12px;padding-top:4px}.edit textarea{min-height:80px}.compact{display:grid;grid-template-columns:1fr 150px;gap:8px}
    @media(max-width:850px){.grid{display:block}.grid>*+*{margin-top:18px}}
  </style>
</head>
<body>
<main>
  <h1>Taskuri AI din Teams si emailuri</h1>
  <p class="muted">Runner local fara dependinte. AI propune, omul aproba, Planner vine dupa configurare.</p>
  <div class="grid">
    <section class="panel">
      <h2>Adauga sursa</h2>
      <form method="post" action="/sources/manual">
        <label>Tip sursa</label><select name="type"><option value="manual_upload">Recap / text manual</option><option value="email">Email copiat</option><option value="teams_transcript">Transcript Teams</option></select>
        <label>Subiect</label><input name="subject" required />
        <label>Expeditor / organizator</label><input name="fromEmail" type="email" />
        <label>Participanti</label><input name="participants" placeholder="email1, email2" />
        <label>Text</label><textarea name="rawText" required></textarea>
        <p><button type="submit">Extrage taskuri propuse</button></p>
      </form>
    </section>
    <section class="stack">
      <div class="panel"><h2>Taskuri propuse</h2>${tasks.length ? tasks.map((task) => `
        <article class="task">
          <div class="row"><strong>${escapeHtml(task.title)}</strong><span class="badge ${escapeHtml(task.status)}">${escapeHtml(task.status)}</span></div>
          <p class="muted">${escapeHtml(task.description)}</p>
          <span class="badge">confidence: ${escapeHtml(task.confidence)}</span><span class="badge">${escapeHtml(task.assigneeEmail || "fara responsabil")}</span><span class="badge">${escapeHtml(task.dueDate || "fara termen")}</span>
          <p class="muted"><strong>Evidence:</strong> ${escapeHtml(task.evidence)}</p>
          ${task.status === "proposed" || task.status === "planner_sync_failed" ? `
            <form class="edit" method="post" action="/tasks/${task.id}/update">
              <label>Titlu</label><input name="title" value="${escapeHtml(task.title)}" required />
              <label>Descriere</label><textarea name="description">${escapeHtml(task.description || "")}</textarea>
              <div class="compact"><div><label>Responsabil</label><input name="assigneeEmail" type="email" value="${escapeHtml(task.assigneeEmail || "")}" /></div><div><label>Termen</label><input name="dueDate" type="date" value="${escapeHtml(task.dueDate || "")}" /></div></div>
              <label>Proiect</label><input name="projectHint" value="${escapeHtml(task.projectHint || "")}" />
              <p><button type="submit">Salveaza editarea</button></p>
            </form>
            <form style="display:inline" method="post" action="/tasks/${task.id}/approve"><button>Aproba</button></form> <form style="display:inline" method="post" action="/tasks/${task.id}/reject"><button class="danger">Respinge</button></form>` : ""}
        </article>`).join("") : `<p class="muted">Nu exista taskuri propuse inca.</p>`}</div>
      <div class="panel"><h2>Erori</h2>${errors.length ? errors.slice(0,5).map((error) => `<div class="event"><strong>${escapeHtml(error.stage)}</strong><br>${escapeHtml(error.message)}</div>`).join("") : `<p class="muted">Nu exista erori.</p>`}</div>
      <div class="panel"><h2>Audit recent</h2>${auditEvents.length ? auditEvents.slice(0,8).map((event) => `<div class="event"><strong>${escapeHtml(event.type)}</strong><br><span class="muted">${escapeHtml(event.message)}</span></div>`).join("") : `<p class="muted">Nu exista evenimente.</p>`}</div>
    </section>
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
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  } catch (error) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(error instanceof Error ? error.stack : String(error));
  }
}).listen(port, () => {
  console.log(`Local MVP server: http://localhost:${port}`);
});
