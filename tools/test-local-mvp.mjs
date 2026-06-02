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
    assert(html.includes("TaskWizard"), "Pagina principala nu contine brandul aplicatiei.");
    assert(html.includes("<title>TaskWizard</title>"), "Titlul tabului trebuie sa fie profesional.");
    assert(html.includes('type="image/png"'), "Pagina trebuie sa expuna faviconul PNG.");
    assert(html.includes("/assets/taskwizard-hat.png"), "Pagina trebuie sa foloseasca assetul PNG TaskWizard.");
    assert(html.includes("brand-mark"), "Headerul trebuie sa includa marca vizuala.");
    assert(html.includes("Import email"), "Pagina principala nu contine zona de import.");
    assert(html.includes("Adauga email"), "Importul trebuie pornit dintr-un buton principal.");
    assert(html.includes('id="import-dialog"'), "Importul trebuie sa fie intr-un dialog/modal.");
    assert(html.includes("Review taskuri"), "Pagina principala nu contine zona de review.");
    assert(html.includes("Toate taskurile"), "Pagina principala nu contine istoricul taskurilor.");
  });

  await record("Next.js app uses the organized TaskWizard dashboard", async () => {
    const [pageSource, formSource, manualRouteSource, emailFormatSource, documentExtractSource, liveRefreshSource, historySource, taskBoardSource, tasksPageSource, cssSource, versionRouteSource, privacySource, ingestionSource, approvalSource, gitignoreSource] = await Promise.all([
      readFile(path.join(projectRoot, "apps/web/app/page.tsx"), "utf8"),
      readFile(path.join(projectRoot, "apps/web/app/email-source-form.tsx"), "utf8"),
      readFile(path.join(projectRoot, "apps/web/app/api/sources/manual/route.ts"), "utf8"),
      readFile(path.join(projectRoot, "packages/domain/src/email-format.ts"), "utf8"),
      readFile(path.join(projectRoot, "packages/domain/src/document-extract.ts"), "utf8"),
      readFile(path.join(projectRoot, "apps/web/app/live-dashboard-refresh.tsx"), "utf8"),
      readFile(path.join(projectRoot, "apps/web/app/task-history-panel.tsx"), "utf8"),
      readFile(path.join(projectRoot, "apps/web/app/tasks/task-board.tsx"), "utf8"),
      readFile(path.join(projectRoot, "apps/web/app/tasks/page.tsx"), "utf8"),
      readFile(path.join(projectRoot, "apps/web/app/globals.css"), "utf8"),
      readFile(path.join(projectRoot, "apps/web/app/api/state/version/route.ts"), "utf8"),
      readFile(path.join(projectRoot, "packages/domain/src/privacy.ts"), "utf8"),
      readFile(path.join(projectRoot, "packages/domain/src/ingestion.ts"), "utf8"),
      readFile(path.join(projectRoot, "packages/domain/src/approval.ts"), "utf8"),
      readFile(path.join(projectRoot, ".gitignore"), "utf8")
    ]);

    assert(pageSource.includes("app-header"), "UI-ul Next trebuie sa foloseasca headerul nou organizat.");
    assert(pageSource.includes("workspace"), "UI-ul Next trebuie sa foloseasca layoutul nou pe zone.");
    assert(pageSource.includes("TaskHistoryPanel"), "Istoricul compact trebuie randat prin componenta dedicata.");
    assert(pageSource.includes("LiveDashboardRefresh"), "Dashboardul trebuie sa primeasca refresh cand alt user schimba taskuri.");
    assert(pageSource.includes("Aproba prioritar"), "Review-ul trebuie sa permita aprobare cu prioritate.");
    assert(pageSource.includes("href=\"/tasks\""), "Review-ul trebuie sa lege view-ul dedicat de taskuri.");
    assert(formSource.includes("id=\"import-dialog\""), "Importul emailurilor trebuie sa ramana intr-un dialog.");
    assert(formSource.includes("Adauga email"), "Importul trebuie pornit din butonul principal.");
    assert(formSource.includes("encType=\"multipart/form-data\""), "Importul trebuie sa trimita fisiere reale, inclusiv documente binare.");
    assert(formSource.includes(".docx") && formSource.includes(".pdf") && formSource.includes(".xlsx"), "Importul trebuie sa accepte documente uzuale atasate sau directe.");
    assert(manualRouteSource.includes("sourceFile"), "Ruta de import trebuie sa citeasca fisierul incarcat.");
    assert(manualRouteSource.includes("parseEmailPasteWithAttachments"), "Emailurile .eml trebuie procesate impreuna cu atasamentele.");
    assert(documentExtractSource.includes("mammoth"), "Extractorul trebuie sa suporte Word .docx.");
    assert(documentExtractSource.includes("pdf-parse"), "Extractorul trebuie sa suporte PDF.");
    assert(documentExtractSource.includes("jszip"), "Extractorul trebuie sa suporte Excel modern fara pachetul xlsx vulnerabil.");
    assert(emailFormatSource.includes("extractEmailAttachments"), "Parserul de email trebuie sa caute atasamente procesabile.");
    assert(liveRefreshSource.includes("router.refresh()"), "Refresh-ul live trebuie sa actualizeze view-ul fara reload manual.");
    assert(liveRefreshSource.includes("userIsEditing()"), "Refresh-ul live trebuie sa protejeze formularele deschise.");
    assert(liveRefreshSource.includes("details.edit[open]"), "Refresh-ul live nu trebuie sa inchida editari deschise.");
    assert(historySource.includes("className=\"panel task-history\""), "Panoul de taskuri trebuie identificabil in UI.");
    assert(cssSource.includes(".workspace"), "Stilurile pentru layoutul nou trebuie sa existe.");
    assert(cssSource.includes(".history-list"), "Stilurile pentru istoricul compact trebuie sa existe.");
    assert(cssSource.includes(".sync-banner"), "UI-ul trebuie sa anunte cand exista refresh amanat.");
    assert(liveRefreshSource.includes("/api/state/version"), "Refresh-ul live trebuie sa citeasca o versiune mica de stare.");
    assert(versionRouteSource.includes("Cache-Control"), "Endpointul de versiune nu trebuie cache-uit.");
    assert(tasksPageSource.includes("TaskBoard"), "Ruta /tasks trebuie sa randeze view-ul dedicat taskurilor.");
    assert(taskBoardSource.includes("Sortare taskuri"), "View-ul taskurilor trebuie sa aiba sortare.");
    assert(taskBoardSource.includes("Filtre responsabili"), "View-ul taskurilor trebuie sa aiba filtre dinamice pe responsabili.");
    assert(taskBoardSource.includes("internalEmployees"), "View-ul taskurilor trebuie sa separe angajatii interni de restul tagurilor.");
    assert(taskBoardSource.includes("Tudor") && taskBoardSource.includes("Sonia"), "Randul de angajati trebuie sa contina numele interne cunoscute.");
    assert(taskBoardSource.includes("cleanAssigneeLabel"), "Responsabilii extrasi cu fragmente de data trebuie curatati in view.");
    assert(taskBoardSource.includes("Altii"), "View-ul trebuie sa aiba rand separat pentru firme, echipe sau taguri externe.");
    assert(taskBoardSource.includes("sortFilterTags"), "Tagurile de responsabili trebuie ordonate dupa numarul de taskuri.");
    assert(taskBoardSource.includes("b.count - a.count"), "Tagurile cu mai multe taskuri trebuie sa apara primele.");
    assert(taskBoardSource.includes("Calendar"), "View-ul taskurilor trebuie sa includa o vedere calendaristica.");
    assert(taskBoardSource.includes("priorityRank"), "View-ul taskurilor trebuie sa poata ordona dupa prioritate.");
    assert(taskBoardSource.includes("actionableStatuses"), "View-ul /tasks trebuie sa includa doar taskuri actionabile.");
    assert(taskBoardSource.includes("\"proposed\"") && taskBoardSource.includes("\"approved\""), "View-ul /tasks trebuie sa includa taskuri aprobate si in asteptare.");
    assert(pageSource.includes("filterVisibleTasks"), "Dashboardul trebuie sa filtreze taskurile private in functie de actor.");
    assert(tasksPageSource.includes("filterVisibleTasks"), "View-ul /tasks trebuie sa respecte regulile de vizibilitate.");
    assert(versionRouteSource.includes("getCurrentActorEmail"), "Versiunea live trebuie calculata pentru actorul curent.");
    assert(privacySource.includes("TASKWIZARD_PRIVACY_RULES_FILE"), "Regulile de privacy trebuie incarcate din fisier local configurabil.");
    assert(privacySource.includes("blockedSourceEmails"), "Regulile de privacy trebuie sa poata bloca expeditori.");
    assert(privacySource.includes("privateSourceEmailOwners"), "Regulile de privacy trebuie sa poata marca surse private.");
    assert(ingestionSource.includes("source.privacy_ignored"), "Ingestia trebuie sa auditeze sursele blocate de privacy.");
    assert(ingestionSource.includes("rawText: \"\""), "Sursele blocate nu trebuie sa pastreze textul brut al emailului.");
    assert(approvalSource.includes("assertTaskAccess"), "Actiunile pe taskuri trebuie sa verifice accesul, nu doar UI-ul.");
    assert(gitignoreSource.includes("config/privacy-rules.local.json"), "Fisierul local cu adrese reale trebuie ignorat de Git.");
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
      fromEmail: "test@example.com"
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
      fromEmail: "manager@example.com",
      participants: "bogdan@example.com, coleg@example.com"
    });
    assert(response.status === 303, "Ingestia valida ar trebui sa redirectioneze.", response.status);
    const store = await readStore();
    assert(store.sources.length === 2, "Ar trebui sa existe doua surse dupa ingestie.", store.sources.length);
    assert(store.proposedTasks.length === 3, "Ar trebui create trei taskuri propuse.", store.proposedTasks);
    assert(store.proposedTasks.every((task) => task.status === "proposed"), "Taskurile noi trebuie sa fie proposed.");
    assert(store.proposedTasks.every((task) => task.confidence === "low"), "Taskurile fara responsabil si termen raman low confidence.");
    assert(store.proposedTasks.every((task) => wordCount(task.title) <= 5), "Titlurile trebuie sa fie scurte.", store.proposedTasks);
    assert(
      store.proposedTasks.some((task) => task.description === "Te rog verifica PV-ul pentru lucrarea X."),
      "Descrierea trebuie sa pastreze actiunea completa.",
      store.proposedTasks
    );
  });

  await record("raw EML paste extracts headers and plain text body", async () => {
    const rawEmail = `From: Tudor Timofti <tudor.timofti@example.com>
To: Daniel Florian <daniel.florian@example.com>
CC: Alex Example <alex.example@example.com>
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
      actorEmail: "alex.example@example.com",
      rawEmail
    });
    assert(response.status === 303, "Emailul .eml lipit ar trebui procesat.", response.status);
    const store = await readStore();
    const source = store.sources.find((item) => item.subject.includes("Reabilitare Acoperis"));
    assert(source, "Subiectul trebuie extras din headerul EML.");
    assert(source.type === "email", "Sursa .eml trebuie marcata ca email.", source);
    assert(source.fromEmail === "tudor.timofti@example.com", "Expeditorul trebuie extras.", source);
    assert(source.participants.includes("daniel.florian@example.com"), "To trebuie extras in participanti.", source);
    assert(source.participants.includes("alex.example@example.com"), "CC/actor trebuie inclus in participanti.", source);
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
    assert(tasks.every((task) => task.confidence === "high"), "Liniile cu responsabil si termen explicit trebuie sa fie high confidence.", tasks);
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
        "Actualizeaza planul mar\u021bi.",
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
    assert(tasks.some((task) => task.title === "Actualizeaza planul" && task.dueDate === "2026-05-26"), "Marti cu diacritica trebuie mapat la urmatoarea marti.", tasks);
    assert(tasks.some((task) => task.description.includes("miercuri") && task.dueDate === "2026-05-27"), "Miercuri trebuie mapat la urmatoarea miercuri.", tasks);
  });

  await record("chaotic action headings are ignored and polite assignees are cleaned", async () => {
    const response = await postForm("/sources/manual", {
      type: "email",
      subject: "Email haotic cu heading",
      rawText: [
        "Ac\u021biuni ramase / posibil de f\u0103cut:",
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
    assert(
      tasks.every((task) => task.confidence === "high"),
      "Taskurile cu responsabil clar si termen relativ trebuie sa fie high confidence.",
      tasks
    );
  });

  await record("duplicate source is ignored idempotently", async () => {
    const response = await postForm("/sources/manual", {
      type: "email",
      subject: "PV Lucrare X",
      rawText:
        "Te rog verifica PV-ul pentru lucrarea X. Ramane sa trimitem documentatia catre client. Pregateste lista de observatii pentru sedinta urmatoare.",
      fromEmail: "manager@example.com"
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

  await record("identical task identity is blocked across different sources", async () => {
    const before = await readStore();
    const response = await postForm("/sources/manual", {
      type: "email",
      subject: "Follow-up operational cu task duplicat",
      rawText: "Bogdan te rog verifica lista de PV-uri lipsa pana maine dimineata."
    });
    assert(response.status === 303, "Sursa noua cu task duplicat ar trebui procesata.", response.status);
    const store = await readStore();
    const source = store.sources.find((item) => item.subject === "Follow-up operational cu task duplicat");
    assert(source, "Sursa noua trebuie salvata chiar daca taskul extras e duplicat.");
    const sourceTasks = store.proposedTasks.filter((task) => task.sourceId === source.id);
    assert(sourceTasks.length === 0, "Taskul cu acelasi titlu, termen si responsabil nu trebuie duplicat.", sourceTasks);
    assert(store.proposedTasks.length === before.proposedTasks.length, "Numarul total de taskuri nu trebuie sa creasca.", store.proposedTasks);
    assert(
      store.auditEvents.some((event) => event.type === "task.duplicate_ignored" && event.sourceId === source.id),
      "Taskul duplicat trebuie marcat in audit."
    );
  });

  await record("duplicate source can be reprocessed after all review tasks are closed", async () => {
    const storeBefore = await readStore();
    const source = storeBefore.sources.find((item) => item.subject === "PV Lucrare X");
    assert(source, "Sursa PV Lucrare X trebuie sa existe.");
    const sourceTasks = storeBefore.proposedTasks.filter((task) => task.sourceId === source.id && task.status === "proposed");
    assert(sourceTasks.length === 3, "Sursa trebuie sa aiba trei taskuri active inainte de inchidere.", sourceTasks);

    for (const task of sourceTasks) {
      const rejectResponse = await postForm(`/tasks/${task.id}/reject`, { actorEmail: "ana@example.com" });
      assert(rejectResponse.status === 303, "Respingerile pregatitoare ar trebui sa redirectioneze.", rejectResponse.status);
    }

    const response = await postForm("/sources/manual", {
      type: "email",
      subject: "PV Lucrare X",
      rawText:
        "Te rog verifica PV-ul pentru lucrarea X. Ramane sa trimitem documentatia catre client. Pregateste lista de observatii pentru sedinta urmatoare.",
      fromEmail: "manager@example.com"
    });
    assert(response.status === 303, "Reprocesarea duplicatului ar trebui sa redirectioneze.", response.status);
    const store = await readStore();
    const reviewableTasks = store.proposedTasks.filter((task) => task.sourceId === source.id && task.status === "proposed");
    assert(store.sources.length === 7, "Reprocesarea nu trebuie sa creeze o sursa noua.", store.sources);
    assert(reviewableTasks.length === 3, "Reprocesarea taskurilor fara responsabil/termen explicit ramane permisa.", reviewableTasks);
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
      actorEmail: "ana@example.com",
      title: "Trimite centralizatorul PV actualizat",
      description: "Descriere editata manual inainte de aprobare.",
      assigneeEmail: "ana@example.com",
      dueDate: "2026-05-25",
      projectHint: "PV-uri"
    });
    assert(response.status === 303, "Editarea valida ar trebui sa redirectioneze.", response.status);
    const store = await readStore();
    const updated = store.proposedTasks.find((item) => item.id === task.id);
    assert(updated.title === "Trimite centralizatorul PV actualizat", "Titlul editat trebuie salvat.", updated);
    assert(updated.description === "Descriere editata manual inainte de aprobare.", "Descrierea editata trebuie salvata.", updated);
    assert(updated.assigneeEmail === "ana@example.com", "Responsabilul editat trebuie salvat.", updated);
    assert(updated.dueDate === "2026-05-25", "Termenul editat trebuie salvat.", updated);
    assert(updated.projectHint === "PV-uri", "Proiectul editat trebuie salvat.", updated);
    assert(updated.status === "proposed", "Editarea nu trebuie sa aprobe taskul.", updated);
    assert(
      store.auditEvents.some((event) => event.type === "task.updated" && event.actorEmail === "ana@example.com"),
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

  await record("approval without Planner config remains approved locally", async () => {
    const storeBefore = await readStore();
    const task = storeBefore.proposedTasks.find((item) => item.status === "proposed");
    assert(task, "Trebuie sa existe un task propus pentru aprobare.");
    const response = await postForm(`/tasks/${task.id}/approve`, {
      actorEmail: "bogdan@example.com",
      priority: "high"
    });
    assert(response.status === 303, "Aprobarea ar trebui sa redirectioneze.", response.status);
    const store = await readStore();
    const updated = store.proposedTasks.find((item) => item.id === task.id);
    assert(updated.status === "approved", "Fara Planner configurat, taskul trebuie sa ramana aprobat local.", updated);
    assert(updated.approvedBy === "bogdan@example.com", "Aprobarea trebuie sa salveze actorul real.", updated);
    assert(updated.priority === "high", "Aprobarea cu prioritate trebuie sa marcheze taskul ca prioritar.", updated);
    assert(store.processingErrors.length === 0, "Planner neconfigurat nu trebuie sa polueze lista de erori.", store.processingErrors);
  });

  await record("approved local task can be marked completed", async () => {
    const storeBefore = await readStore();
    const task = storeBefore.proposedTasks.find((item) => item.status === "approved");
    assert(task, "Trebuie sa existe un task aprobat local pentru finalizare.");
    const response = await postForm(`/tasks/${task.id}/complete`, {
      actorEmail: "bogdan@example.com"
    });
    assert(response.status === 303, "Marcarea ca terminat ar trebui sa redirectioneze.", response.status);
    const store = await readStore();
    const updated = store.proposedTasks.find((item) => item.id === task.id);
    assert(updated.status === "completed_in_planner", "Taskul trebuie sa devina completed_in_planner.", updated);
    assert(
      store.auditEvents.some((event) => event.type === "task.completed" && event.actorEmail === "bogdan@example.com"),
      "Finalizarea trebuie auditata cu actorul real."
    );
  });

  await record("approved local task can be marked deleted", async () => {
    const storeBefore = await readStore();
    const task = storeBefore.proposedTasks.find((item) => item.status === "proposed");
    assert(task, "Trebuie sa existe un task propus pentru stergere dupa aprobare.");
    const approveResponse = await postForm(`/tasks/${task.id}/approve`, {
      actorEmail: "ana@example.com"
    });
    assert(approveResponse.status === 303, "Aprobarea pregatitoare ar trebui sa redirectioneze.", approveResponse.status);
    const response = await postForm(`/tasks/${task.id}/delete`, {
      actorEmail: "ana@example.com"
    });
    assert(response.status === 303, "Marcarea ca sters ar trebui sa redirectioneze.", response.status);
    const store = await readStore();
    const updated = store.proposedTasks.find((item) => item.id === task.id);
    assert(updated.status === "deleted_in_planner", "Taskul trebuie sa devina deleted_in_planner.", updated);
    assert(
      store.auditEvents.some((event) => event.type === "task.deleted" && event.actorEmail === "ana@example.com"),
      "Stergerea trebuie auditata cu actorul real."
    );
  });

  await record("proposed task cannot be marked completed before approval", async () => {
    const storeBefore = await readStore();
    const task = storeBefore.proposedTasks.find((item) => item.status === "proposed");
    assert(task, "Trebuie sa existe un task propus pentru blocarea finalizarii.");
    const response = await postForm(`/tasks/${task.id}/complete`, {
      actorEmail: "ana@example.com"
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
      actorEmail: "mihai@example.com"
    });
    assert(response.status === 303, "Respingerea ar trebui sa redirectioneze.", response.status);
    const store = await readStore();
    const updated = store.proposedTasks.find((item) => item.id === task.id);
    assert(updated.status === "rejected", "Taskul trebuie sa devina rejected.", updated);
    assert(
      store.auditEvents.some((event) => event.type === "task.rejected" && event.actorEmail === "mihai@example.com"),
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
    assert(page.includes("filter-button active"), "Filtrul curent trebuie evidentiat vizual.");
    assert(page.includes("De verificat"), "Statusul proposed trebuie afisat ca eticheta umana.");
    assert(page.includes("Aprobate"), "Statusul approved trebuie afisat ca eticheta umana.");
    assert(page.includes("Sincronizare"), "Statusul planner_sync_failed trebuie afisat ca eticheta umana.");
    assert(page.includes("In Planner"), "Statusul created_in_planner trebuie afisat ca eticheta umana.");
    assert(page.includes("Terminate"), "Statusul completed_in_planner trebuie afisat ca eticheta umana.");
    assert(page.includes("Sterse"), "Statusul deleted_in_planner trebuie afisat ca eticheta umana.");
    assert(page.includes("Respinse"), "Statusul rejected trebuie afisat ca eticheta umana.");
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

  await record("Microsoft 365 integration wiring is present", async () => {
    const graphFiles = await Promise.all([
      readFile(path.join(projectRoot, "packages/graph/src/outlook.ts"), "utf8"),
      readFile(path.join(projectRoot, "packages/graph/src/users.ts"), "utf8"),
      readFile(path.join(projectRoot, "packages/graph/src/subscriptions.ts"), "utf8"),
      readFile(path.join(projectRoot, "packages/domain/src/m365.ts"), "utf8"),
      readFile(path.join(projectRoot, "apps/web/app/api/graph/webhook/route.ts"), "utf8"),
      readFile(path.join(projectRoot, "apps/web/auth-actor.ts"), "utf8"),
      readFile(path.join(projectRoot, "apps/web/app/page.tsx"), "utf8"),
      readFile(path.join(projectRoot, "docs/microsoft-365-setup.md"), "utf8"),
      readFile(path.join(projectRoot, ".env.example"), "utf8")
    ]);
    const joined = graphFiles.join("\n");
    assert(joined.includes("listOutlookFolderMessages"), "Trebuie sa existe citire Outlook folder.");
    assert(joined.includes("@odata.nextLink"), "Citirea Outlook trebuie sa gestioneze pagination.");
    assert(joined.includes("lookupEntraUserByEmail"), "Trebuie sa existe mapping email -> Entra user ID.");
    assert(joined.includes("createOutlookFolderSubscription"), "Trebuie sa existe creare subscription Outlook.");
    assert(joined.includes("validationToken"), "Webhook-ul trebuie sa raspunda la validationToken.");
    assert(joined.includes("GRAPH_WEBHOOK_CLIENT_STATE"), "Webhook-ul trebuie sa valideze clientState.");
    assert(joined.includes("OUTLOOK_FOLDER_ID"), "Documentatia/env trebuie sa ceara folder Outlook configurabil.");
    assert(joined.includes("PLANNER_PLAN_ID") && joined.includes("PLANNER_BUCKET_ID"), "Planner plan/bucket trebuie configurabile.");
    assert(joined.includes("getCurrentActorEmail"), "Rutele web trebuie sa foloseasca actorul autentificat Entra.");
    assert(joined.includes("Actor:"), "Pagina web trebuie sa afiseze actorul curent folosit in audit.");
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
      participants: "bogdan@example.com, ana@example.com, mihai@example.com"
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
