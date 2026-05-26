import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = 3197;
const baseUrl = `http://localhost:${port}`;
const tempDir = await mkdtemp(path.join(tmpdir(), "taskuri-ai-test-"));
const storePath = path.join(tempDir, "store.json");

const results = [];

function assert(condition, message, details = undefined) {
  if (!condition) {
    const error = new Error(message);
    error.details = details;
    throw error;
  }
}

function record(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      results.push({ name, status: "PASS" });
    })
    .catch((error) => {
      results.push({ name, status: "FAIL", error });
      throw error;
    });
}

async function waitForServer() {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
  throw new Error("Serverul local nu a pornit in timp util.");
}

async function postForm(pathname, fields) {
  const body = new URLSearchParams(fields);
  return fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    body,
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded" }
  });
}

async function readStore() {
  try {
    return JSON.parse(await readFile(storePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return { sources: [], proposedTasks: [], auditEvents: [], processingErrors: [] };
    }
    throw error;
  }
}

function countByStatus(tasks) {
  return tasks.reduce((acc, task) => {
    acc[task.status] = (acc[task.status] ?? 0) + 1;
    return acc;
  }, {});
}

function wordCount(value) {
  return String(value).trim().split(/\s+/).filter(Boolean).length;
}

const server = spawn(process.execPath, ["tools/local-mvp-server.mjs"], {
  cwd: projectRoot,
  env: {
    ...process.env,
    PORT: String(port),
    LOCAL_TODAY: "2026-05-25",
    LOCAL_DATA_DIR: tempDir
  },
  stdio: ["ignore", "pipe", "pipe"]
});

let serverOutput = "";
server.stdout.on("data", (chunk) => {
  serverOutput += chunk.toString();
});
server.stderr.on("data", (chunk) => {
  serverOutput += chunk.toString();
});

try {
  await waitForServer();

  await record("GET / returns the MVP interface", async () => {
    const response = await fetch(baseUrl);
    const html = await response.text();
    assert(response.status === 200, "GET / nu a raspuns cu 200", response.status);
    assert(html.includes("TaskMage"), "Pagina principala nu contine brandul aplicatiei.");
    assert(html.includes("taskuri vrajite"), "Titlul tabului trebuie sa fie personalizat.");
    assert(html.includes("data:image/svg+xml"), "Pagina trebuie sa expuna faviconul SVG.");
    assert(html.includes("brand-mark"), "Headerul trebuie sa includa marca vizuala.");
    assert(html.includes("Import email"), "Pagina principala nu contine zona de import.");
    assert(html.includes("Adauga email"), "Importul trebuie pornit dintr-un buton principal.");
    assert(html.includes('id="import-dialog"'), "Importul trebuie sa fie intr-un dialog/modal.");
    assert(html.includes("Review taskuri"), "Pagina principala nu contine zona de review.");
    assert(html.includes("Toate taskurile"), "Pagina principala nu contine istoricul taskurilor.");
  });

  await record("empty input is rejected", async () => {
    const response = await postForm("/sources/manual", {
      type: "manual_upload",
      subject: "",
      rawText: ""
    });
    assert(response.status === 400, "Inputul gol ar trebui respins cu 400.", response.status);
    const store = await readStore();
    assert(store.sources.length === 0, "Inputul gol nu trebuie sa creeze surse.", store);
  });

  await record("invalid source type is rejected", async () => {
    const response = await postForm("/sources/manual", {
      type: "mailbox_dump",
      subject: "Tip invalid",
      rawText: "Te rog verifica ceva."
    });
    assert(response.status === 400, "Tipul invalid trebuie respins cu 400.", response.status);
    const store = await readStore();
    assert(store.sources.length === 0, "Tipul invalid nu trebuie sa creeze surse.", store);
  });

  await record("source without action phrases creates no proposed tasks but is audited", async () => {
    const response = await postForm("/sources/manual", {
      type: "manual_upload",
      subject: "Informare generala",
      rawText: "Am discutat stadiul proiectului. Nu exista actiuni clare pentru moment.",
      fromEmail: "test@firma.ro"
    });
    assert(response.status === 303, "Ingestia fara taskuri ar trebui sa redirectioneze.", response.status);
    const store = await readStore();
    assert(store.sources.length === 1, "Sursa informativa trebuie salvata.", store.sources);
    assert(store.proposedTasks.length === 0, "Nu ar trebui create taskuri fara expresii actionabile.", store.proposedTasks);
    assert(store.auditEvents.length >= 2, "Ingestia trebuie auditata.", store.auditEvents);
  });

  await record("clear source creates expected proposed tasks", async () => {
    const response = await postForm("/sources/manual", {
      type: "email",
      subject: "PV Lucrare X",
      rawText:
        "Te rog verifica PV-ul pentru lucrarea X. Ramane sa trimitem documentatia catre client. Pregateste lista de observatii pentru sedinta urmatoare.",
      fromEmail: "manager@firma.ro",
      participants: "bogdan@firma.ro, coleg@firma.ro"
    });
    assert(response.status === 303, "Ingestia valida ar trebui sa redirectioneze.", response.status);
    const store = await readStore();
    assert(store.sources.length === 2, "Ar trebui sa existe doua surse dupa ingestie.", store.sources.length);
    assert(store.proposedTasks.length === 3, "Ar trebui create trei taskuri propuse.", store.proposedTasks);
    assert(store.proposedTasks.every((task) => task.status === "proposed"), "Taskurile noi trebuie sa fie proposed.");
    assert(store.proposedTasks.every((task) => task.confidence === "low"), "Fallback extractor marcheaza confidence low.");
    assert(store.proposedTasks.every((task) => wordCount(task.title) <= 5), "Titlurile trebuie sa fie scurte.", store.proposedTasks);
    assert(
      store.proposedTasks.some((task) => task.description === "Te rog verifica PV-ul pentru lucrarea X."),
      "Descrierea trebuie sa pastreze actiunea completa.",
      store.proposedTasks
    );
  });

  await record("raw EML paste extracts headers and plain text body", async () => {
    const rawEmail = `From: Tudor Timofti <tudor.timofti@rst-services.ro>
To: Daniel Florian <daniel.florian@dssmith.com>
CC: Bogdan Cojocaru <bogdan.cojocaru@rst-services.ro>
Subject: DSSPG - Proj. Reabilitare Acoperis Hala - minuta 15.05.2026
Content-Type: multipart/alternative; boundary="_test"

--_test
Content-Type: text/plain; charset="iso-8859-1"
Content-Transfer-Encoding: quoted-printable

Buna ziua,

Te rog verifica minuta intalnirii.
Ramane sa trimitem documentatia catre client.
Pregateste lista de observatii pentru acoperis.

--_test--`;

    const response = await postForm("/sources/manual", {
      actorEmail: "bogdan.cojocaru@rst-services.ro",
      rawEmail
    });
    assert(response.status === 303, "Emailul .eml lipit ar trebui procesat.", response.status);
    const store = await readStore();
    const source = store.sources.find((item) => item.subject.includes("Reabilitare Acoperis"));
    assert(source, "Subiectul trebuie extras din headerul EML.");
    assert(source.type === "email", "Sursa .eml trebuie marcata ca email.", source);
    assert(source.fromEmail === "tudor.timofti@rst-services.ro", "Expeditorul trebuie extras.", source);
    assert(source.participants.includes("daniel.florian@dssmith.com"), "To trebuie extras in participanti.", source);
    assert(source.participants.includes("bogdan.cojocaru@rst-services.ro"), "CC/actor trebuie inclus in participanti.", source);
    assert(source.rawText.includes("Te rog verifica minuta intalnirii."), "Corpul text/plain trebuie extras.", source.rawText);
    const tasks = store.proposedTasks.filter((task) => task.sourceId === source.id);
    assert(tasks.length === 3, "Emailul .eml ar trebui sa creeze trei taskuri.", tasks);
  });

  await record("meeting minute lines summarize actions and extract company assignees", async () => {
    const response = await postForm("/sources/manual", {
      type: "manual_upload",
      subject: "Minuta structurata",
      rawText: [
        "15.05.2026 = RST a preluat arhiva de informatii despre proiect, se vor verifica datele si se vor transmite observatiile.",
        "15.05.2026 = AVT transmite catre proiectare detaliile pentru prinderi seismice.",
        "Daca sunt elemente pe care le-am omis va rog sa le adaugati."
      ].join("\n")
    });
    assert(response.status === 303, "Minuta structurata ar trebui procesata.", response.status);
    const store = await readStore();
    const source = store.sources.find((item) => item.subject === "Minuta structurata");
    assert(source, "Sursa minutei structurate trebuie salvata.");
    const tasks = store.proposedTasks.filter((task) => task.sourceId === source.id);
    assert(tasks.length === 2, "Linia generica de completari nu trebuie sa devina task.", tasks);
    assert(tasks.some((task) => task.assigneeName === "RST"), "RST trebuie extras ca responsabil.", tasks);
    assert(tasks.some((task) => task.assigneeName === "AVT"), "AVT trebuie extras ca responsabil.", tasks);
    assert(tasks.every((task) => !task.title.startsWith("2026 =")), "Titlul nu trebuie sa inceapa cu resturi de data.", tasks);
    assert(tasks.every((task) => wordCount(task.title) <= 5), "Titlul sumarizat trebuie sa ramana scurt.", tasks);
    assert(tasks.some((task) => task.title === "Verifica arhiva proiect"), "Titlul pentru arhiva trebuie sa fie scurt si natural.", tasks);
    assert(tasks.some((task) => task.title === "Pregateste detaliu prinderi"), "Titlul pentru prinderi trebuie sa fie scurt si natural.", tasks);
    assert(tasks.every((task) => task.dueDate === "2026-05-15"), "Data explicita din minuta trebuie extrasa ca termen.", tasks);
    assert(
      tasks.some((task) => /arhiva/i.test(task.title) || /verifica/i.test(task.title)),
      "Titlul trebuie sa sumarizeze actiunea, nu sa copieze linia bruta."
    );
    assert(
      tasks.some((task) => task.description.includes("se vor verifica datele si se vor transmite observatiile")),
      "Descrierea trebuie sa pastreze actiunea completa din minuta.",
      tasks
    );
  });

  await record("relative date words are converted to due dates", async () => {
    const response = await postForm("/sources/manual", {
      type: "manual_upload",
      subject: "Termene relative",
      rawText: [
        "Te rog verifica lista pana maine.",
        "Ramane sa trimitem oferta poimaine.",
        "Actualizeaza planul marti.",
        "Confirma disponibilitatea miercuri."
      ].join("\n")
    });
    assert(response.status === 303, "Sursa cu termene relative ar trebui procesata.", response.status);
    const store = await readStore();
    const source = store.sources.find((item) => item.subject === "Termene relative");
    assert(source, "Sursa cu termene relative trebuie salvata.");
    const tasks = store.proposedTasks.filter((task) => task.sourceId === source.id);
    assert(tasks.length === 4, "Ar trebui create patru taskuri cu termene relative.", tasks);
    assert(tasks.some((task) => task.description.includes("pana maine") && task.dueDate === "2026-05-26"), "Maine trebuie mapat la 2026-05-26.", tasks);
    assert(tasks.some((task) => task.description.includes("poimaine") && task.dueDate === "2026-05-27"), "Poimaine trebuie mapat la 2026-05-27.", tasks);
    assert(tasks.some((task) => task.description.includes("marti") && task.dueDate === "2026-05-26"), "Marti trebuie mapat la urmatoarea marti.", tasks);
    assert(tasks.some((task) => task.description.includes("miercuri") && task.dueDate === "2026-05-27"), "Miercuri trebuie mapat la urmatoarea miercuri.", tasks);
  });

  await record("chaotic action headings are ignored and polite assignees are cleaned", async () => {
    const response = await postForm("/sources/manual", {
      type: "email",
      subject: "Email haotic cu heading",
      rawText: [
        "Taskuri ramase / posibil de facut:",
        "Bogdan te rog verifica lista de PV-uri lipsa pana maine dimineata.",
        "Sika confirma miercuri disponibilitatea membranei si termenul de livrare estimat.",
        "DSS trebuie sa clarifice cu financiarul daca acordul tripartit poate fi semnat pana marti."
      ].join("\n")
    });
    assert(response.status === 303, "Emailul haotic ar trebui procesat.", response.status);
    const store = await readStore();
    const source = store.sources.find((item) => item.subject === "Email haotic cu heading");
    assert(source, "Sursa haotica trebuie salvata.");
    const tasks = store.proposedTasks.filter((task) => task.sourceId === source.id);
    assert(tasks.length === 3, "Headingul de taskuri nu trebuie sa devina task.", tasks);
    assert(tasks.some((task) => task.assigneeName === "Bogdan"), "Formula 'te rog' nu trebuie sa ramana in responsabil.", tasks);
    assert(tasks.some((task) => task.title === "Verifica lista PV-uri lipsa"), "Titlul trebuie curatat de termenul relativ.", tasks);
    assert(tasks.some((task) => task.title === "Clarifica acord tripartit"), "Titlul pentru acordul tripartit trebuie curatat.", tasks);
    assert(tasks.some((task) => task.title === "Confirma disponibilitate membrana"), "Titlul pentru membrana trebuie naturalizat.", tasks);
    assert(tasks.some((task) => task.dueDate === "2026-05-26"), "Termenul 'maine' trebuie pastrat ca data.", tasks);
  });

  await record("duplicate source is ignored idempotently", async () => {
    const response = await postForm("/sources/manual", {
      type: "email",
      subject: "PV Lucrare X",
      rawText:
        "Te rog verifica PV-ul pentru lucrarea X. Ramane sa trimitem documentatia catre client. Pregateste lista de observatii pentru sedinta urmatoare.",
      fromEmail: "manager@firma.ro"
    });
    assert(response.status === 303, "Duplicatul ar trebui sa redirectioneze.", response.status);
    const store = await readStore();
    assert(store.sources.length === 6, "Duplicatul nu trebuie sa creeze o sursa noua.", store.sources);
    assert(store.proposedTasks.length === 15, "Duplicatul nu trebuie sa creeze taskuri noi.", store.proposedTasks);
    assert(
      store.auditEvents.some((event) => event.type === "source.duplicate_ignored"),
      "Duplicatul trebuie marcat in audit."
    );
  });

  await record("duplicate source can be reprocessed after all review tasks are closed", async () => {
    const storeBefore = await readStore();
    const source = storeBefore.sources.find((item) => item.subject === "PV Lucrare X");
    assert(source, "Sursa PV Lucrare X trebuie sa existe.");
    const sourceTasks = storeBefore.proposedTasks.filter((task) => task.sourceId === source.id && task.status === "proposed");
    assert(sourceTasks.length === 3, "Sursa trebuie sa aiba trei taskuri active inainte de inchidere.", sourceTasks);

    for (const task of sourceTasks) {
      const rejectResponse = await postForm(`/tasks/${task.id}/reject`, { actorEmail: "ana@firma.ro" });
      assert(rejectResponse.status === 303, "Respingerile pregatitoare ar trebui sa redirectioneze.", rejectResponse.status);
    }

    const response = await postForm("/sources/manual", {
      type: "email",
      subject: "PV Lucrare X",
      rawText:
        "Te rog verifica PV-ul pentru lucrarea X. Ramane sa trimitem documentatia catre client. Pregateste lista de observatii pentru sedinta urmatoare.",
      fromEmail: "manager@firma.ro"
    });
    assert(response.status === 303, "Reprocesarea duplicatului ar trebui sa redirectioneze.", response.status);
    const store = await readStore();
    const reviewableTasks = store.proposedTasks.filter((task) => task.sourceId === source.id && task.status === "proposed");
    assert(store.sources.length === 6, "Reprocesarea nu trebuie sa creeze o sursa noua.", store.sources);
    assert(reviewableTasks.length === 3, "Reprocesarea trebuie sa creeze taskuri noi de verificat.", reviewableTasks);
    assert(
      store.auditEvents.some((event) => event.type === "source.reprocessed"),
      "Reprocesarea trebuie marcata in audit."
    );
  });

  await record("proposed task can be edited before approval", async () => {
    const storeBefore = await readStore();
    const task = storeBefore.proposedTasks.find((item) => item.status === "proposed");
    assert(task, "Trebuie sa existe un task propus pentru editare.");
    const response = await postForm(`/tasks/${task.id}/update`, {
      actorEmail: "ana@firma.ro",
      title: "Trimite centralizatorul PV actualizat",
      description: "Descriere editata manual inainte de aprobare.",
      assigneeEmail: "ana@firma.ro",
      dueDate: "2026-05-25",
      projectHint: "PV-uri"
    });
    assert(response.status === 303, "Editarea valida ar trebui sa redirectioneze.", response.status);
    const store = await readStore();
    const updated = store.proposedTasks.find((item) => item.id === task.id);
    assert(updated.title === "Trimite centralizatorul PV actualizat", "Titlul editat trebuie salvat.", updated);
    assert(updated.description === "Descriere editata manual inainte de aprobare.", "Descrierea editata trebuie salvata.", updated);
    assert(updated.assigneeEmail === "ana@firma.ro", "Responsabilul editat trebuie salvat.", updated);
    assert(updated.dueDate === "2026-05-25", "Termenul editat trebuie salvat.", updated);
    assert(updated.projectHint === "PV-uri", "Proiectul editat trebuie salvat.", updated);
    assert(updated.status === "proposed", "Editarea nu trebuie sa aprobe taskul.", updated);
    assert(
      store.auditEvents.some((event) => event.type === "task.updated" && event.actorEmail === "ana@firma.ro"),
      "Editarea trebuie auditata cu actorul real."
    );
  });

  await record("invalid task edit is rejected", async () => {
    const storeBefore = await readStore();
    const task = storeBefore.proposedTasks.find((item) => item.status === "proposed");
    assert(task, "Trebuie sa existe un task propus pentru test invalid.");
    const response = await postForm(`/tasks/${task.id}/update`, {
      title: "x",
      description: "invalid"
    });
    assert(response.status === 400, "Titlul prea scurt trebuie respins cu 400.", response.status);
  });

  await record("approval without Planner config fails safely", async () => {
    const storeBefore = await readStore();
    const task = storeBefore.proposedTasks.find((item) => item.status === "proposed");
    assert(task, "Trebuie sa existe un task propus pentru aprobare.");
    const response = await postForm(`/tasks/${task.id}/approve`, {
      actorEmail: "bogdan@firma.ro"
    });
    assert(response.status === 303, "Aprobarea ar trebui sa redirectioneze.", response.status);
    const store = await readStore();
    const updated = store.proposedTasks.find((item) => item.id === task.id);
    assert(updated.status === "planner_sync_failed", "Fara Planner configurat, statusul trebuie sa fie planner_sync_failed.", updated);
    assert(updated.approvedBy === "bogdan@firma.ro", "Aprobarea trebuie sa salveze actorul real.", updated);
    assert(store.processingErrors.length === 1, "Eroarea Planner trebuie salvata.", store.processingErrors);
  });

  await record("approved local task can be marked completed", async () => {
    const storeBefore = await readStore();
    const task = storeBefore.proposedTasks.find((item) => item.status === "planner_sync_failed");
    assert(task, "Trebuie sa existe un task aprobat local pentru finalizare.");
    const response = await postForm(`/tasks/${task.id}/complete`, {
      actorEmail: "bogdan@firma.ro"
    });
    assert(response.status === 303, "Marcarea ca terminat ar trebui sa redirectioneze.", response.status);
    const store = await readStore();
    const updated = store.proposedTasks.find((item) => item.id === task.id);
    assert(updated.status === "completed_in_planner", "Taskul trebuie sa devina completed_in_planner.", updated);
    assert(
      store.auditEvents.some((event) => event.type === "task.completed" && event.actorEmail === "bogdan@firma.ro"),
      "Finalizarea trebuie auditata cu actorul real."
    );
  });

  await record("approved local task can be marked deleted", async () => {
    const storeBefore = await readStore();
    const task = storeBefore.proposedTasks.find((item) => item.status === "proposed");
    assert(task, "Trebuie sa existe un task propus pentru stergere dupa aprobare.");
    const approveResponse = await postForm(`/tasks/${task.id}/approve`, {
      actorEmail: "ana@firma.ro"
    });
    assert(approveResponse.status === 303, "Aprobarea pregatitoare ar trebui sa redirectioneze.", approveResponse.status);
    const response = await postForm(`/tasks/${task.id}/delete`, {
      actorEmail: "ana@firma.ro"
    });
    assert(response.status === 303, "Marcarea ca sters ar trebui sa redirectioneze.", response.status);
    const store = await readStore();
    const updated = store.proposedTasks.find((item) => item.id === task.id);
    assert(updated.status === "deleted_in_planner", "Taskul trebuie sa devina deleted_in_planner.", updated);
    assert(
      store.auditEvents.some((event) => event.type === "task.deleted" && event.actorEmail === "ana@firma.ro"),
      "Stergerea trebuie auditata cu actorul real."
    );
  });

  await record("proposed task cannot be marked completed before approval", async () => {
    const storeBefore = await readStore();
    const task = storeBefore.proposedTasks.find((item) => item.status === "proposed");
    assert(task, "Trebuie sa existe un task propus pentru blocarea finalizarii.");
    const response = await postForm(`/tasks/${task.id}/complete`, {
      actorEmail: "ana@firma.ro"
    });
    assert(response.status === 409, "Finalizarea inainte de aprobare trebuie sa intoarca 409.", response.status);
  });

  await record("unknown task approval returns 404", async () => {
    const response = await fetch(`${baseUrl}/tasks/ptask_missing/approve`, { method: "POST", redirect: "manual" });
    assert(response.status === 404, "Aprobarea unui task inexistent trebuie sa intoarca 404.", response.status);
  });

  await record("reject changes only proposed tasks to rejected", async () => {
    const storeBefore = await readStore();
    const task = storeBefore.proposedTasks.find((item) => item.status === "proposed");
    assert(task, "Trebuie sa existe un task propus pentru respingere.");
    const response = await postForm(`/tasks/${task.id}/reject`, {
      actorEmail: "mihai@firma.ro"
    });
    assert(response.status === 303, "Respingerea ar trebui sa redirectioneze.", response.status);
    const store = await readStore();
    const updated = store.proposedTasks.find((item) => item.id === task.id);
    assert(updated.status === "rejected", "Taskul trebuie sa devina rejected.", updated);
    assert(
      store.auditEvents.some((event) => event.type === "task.rejected" && event.actorEmail === "mihai@firma.ro"),
      "Respingerea trebuie auditata cu actorul real."
    );
  });

  await record("rejected tasks cannot be rejected twice", async () => {
    const storeBefore = await readStore();
    const task = storeBefore.proposedTasks.find((item) => item.status === "rejected");
    assert(task, "Trebuie sa existe un task respins.");
    const response = await fetch(`${baseUrl}/tasks/${task.id}/reject`, { method: "POST", redirect: "manual" });
    assert(response.status === 409, "Respingerea repetata trebuie sa intoarca 409.", response.status);
  });

  await record("rejected tasks cannot be edited", async () => {
    const storeBefore = await readStore();
    const task = storeBefore.proposedTasks.find((item) => item.status === "rejected");
    assert(task, "Trebuie sa existe un task respins.");
    const response = await postForm(`/tasks/${task.id}/update`, {
      title: "Nu ar trebui salvat"
    });
    assert(response.status === 409, "Editarea unui task respins trebuie sa intoarca 409.", response.status);
  });

  await record("HTML-like task content is escaped in UI", async () => {
    const response = await postForm("/sources/manual", {
      type: "manual_upload",
      subject: "Test escaping",
      rawText: "Te rog verifica <script>alert('x')</script> in descriere."
    });
    assert(response.status === 303, "Sursa cu HTML-like text ar trebui acceptata.", response.status);
    const page = await (await fetch(baseUrl)).text();
    assert(!page.includes("<script>alert('x')</script>"), "UI-ul nu trebuie sa redea script raw.");
    assert(page.includes("&lt;script&gt;alert('x')&lt;/script&gt;"), "UI-ul trebuie sa scape continutul HTML-like.");
  });

  await record("all tasks section exposes status filters", async () => {
    const page = await (await fetch(baseUrl)).text();
    assert(page.includes("Toate taskurile"), "Pagina trebuie sa contina sectiunea Toate taskurile.");
    assert(page.includes("Taskuri active / aprobate"), "Pagina trebuie sa contina sectiunea pentru taskuri aprobate.");
    assert(page.includes("Marcheaza terminat"), "Pagina trebuie sa expuna actiunea de finalizare pentru taskurile aprobate.");
    assert(page.includes("Marcheaza sters"), "Pagina trebuie sa expuna actiunea de stergere pentru taskurile aprobate.");
    assert(page.includes("filterTasks('all')"), "Sectiunea trebuie sa aiba filtru pentru toate taskurile.");
    assert(page.includes("filterTasks('proposed')"), "Sectiunea trebuie sa aiba filtru pentru proposed.");
    assert(page.includes("filterTasks('rejected')"), "Sectiunea trebuie sa aiba filtru pentru rejected.");
    assert(page.includes("filterTasks('completed_in_planner')"), "Sectiunea trebuie sa aiba filtru pentru taskuri terminate.");
    assert(page.includes("filterTasks('deleted_in_planner')"), "Sectiunea trebuie sa aiba filtru pentru taskuri sterse.");
    assert(page.includes("data-task-row"), "Sectiunea trebuie sa includa randuri filtrabile.");
    assert(page.includes("history-card"), "Istoricul trebuie randat compact, ca lista de carduri.");
    assert(!page.includes("task-table"), "Istoricul nu trebuie sa revina la tabel lat cu scroll orizontal.");
  });

  await record("approved tasks are not duplicated in review and active sections", async () => {
    const page = await (await fetch(baseUrl)).text();
    const reviewSection = page.slice(page.indexOf("Review taskuri"), page.indexOf("Taskuri active / aprobate"));
    assert(!reviewSection.includes("planner_sync_failed"), "Taskurile aprobate local nu trebuie sa ramana in sectiunea Review.");
    assert(page.includes("Taskuri active / aprobate"), "Sectiunea activa trebuie sa existe.");
  });

  await record("long meeting dialog extracts multiple operational tasks", async () => {
    const longDialog = `
Bogdan: Hai sa trecem prin sedinta de azi pentru proiectul de evidenta PV-uri.
Ana: Stadiul general e ok, dar trebuie sa verificam lista de PV-uri lipsa pentru luna aprilie.
Mihai: Am vazut si eu cateva diferente in Excel.
Bogdan: Te rog trimite catre client centralizatorul actualizat dupa ce il verifici.
Ana: Ramane sa actualizeaza Mihai statusul pentru lucrarea IMSAT pana maine dimineata.
Mihai: Pot face asta, dar am nevoie de ultima varianta de fisier.
Bogdan: Pregateste lista de observatii pentru sedinta urmatoare si pune acolo ce lipseste din documentatie.
Ana: Discutia despre licente o lasam pe saptamana viitoare, nu e task acum.
Mihai: De facut si o verificare pe duplicate in registrul de PV-uri.
Bogdan: Creeaza un draft de procedura pentru cum mutam emailurile in folderul de taskuri.
Ana: Mai trebuie sa confirmam cine aproba taskurile propuse de AI.
`;

    const response = await postForm("/sources/manual", {
      type: "teams_transcript",
      subject: "Dialog lung sedinta PV-uri",
      rawText: longDialog,
      participants: "bogdan@firma.ro, ana@firma.ro, mihai@firma.ro"
    });
    assert(response.status === 303, "Dialogul lung ar trebui acceptat.", response.status);
    const store = await readStore();
    const longSource = store.sources.find((source) => source.subject === "Dialog lung sedinta PV-uri");
    assert(longSource, "Sursa dialogului lung trebuie salvata.");
    const tasks = store.proposedTasks.filter((task) => task.sourceId === longSource.id);
    assert(tasks.length === 5, "Fallback-ul limiteaza dialogul lung la primele 5 taskuri actionabile.", tasks);
    assert(
      tasks.some((task) => /PV-uri lipsa/i.test(task.title)),
      "Ar trebui extras taskul despre PV-uri lipsa."
    );
    assert(
      tasks.some((task) => /centralizatorul actualizat/i.test(task.title)),
      "Ar trebui extras taskul despre centralizator."
    );
    assert(
      tasks.every((task) => task.status === "proposed" && task.sourceId === longSource.id),
      "Taskurile din dialog trebuie sa fie proposed si legate de sursa."
    );
  });

  const finalStore = await readStore();
  const summary = {
    tests: results.length,
    passed: results.filter((result) => result.status === "PASS").length,
    failed: results.filter((result) => result.status === "FAIL").length,
    sources: finalStore.sources.length,
    proposedTasks: finalStore.proposedTasks.length,
    statuses: countByStatus(finalStore.proposedTasks),
    auditEvents: finalStore.auditEvents.length,
    processingErrors: finalStore.processingErrors.length
  };

  console.log(JSON.stringify({ summary, results }, null, 2));
} catch (error) {
  console.error("TEST_FAILURE");
  console.error(error.stack ?? error);
  if (error.details) {
    console.error("DETAILS", JSON.stringify(error.details, null, 2));
  }
  console.error("SERVER_OUTPUT", serverOutput);
  process.exitCode = 1;
} finally {
  server.kill();
  await rm(tempDir, { recursive: true, force: true });
}
