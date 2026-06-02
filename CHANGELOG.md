# Changelog

Format inspirat de Keep a Changelog. Proiectul foloseste versionare pragmatica pana la prima versiune productiva.

## [0.1.0] - 2026-05-18

### Added

- Context arhitectural si pasi de lucru pentru proiect.
- MVP local pentru ingestie manuala, taskuri propuse, aprobare/respingere si audit.
- Runner local fara dependinte: `tools/local-mvp-server.mjs`.
- Test runner fara dependinte: `tools/test-local-mvp.mjs`.
- Schema PostgreSQL/Drizzle pentru versiunea productiva.
- Clienti Microsoft Graph initiali pentru auth, Planner si subscriptions.
- Documentatie de implementare, coverage comportamental si harta cod.
- Pregatire repository GitHub: contributing, security, roadmap, issue templates, PR template si CI.

## [0.1.1] - 2026-05-21

### Added

- Editare task propus inainte de aprobare in UI-ul Next.js si runnerul local.
- Ruta API `POST /api/tasks/[taskId]/update`.
- Ruta locala `POST /tasks/:taskId/update`.
- Teste pentru editare valida, editare invalida si blocarea editarii dupa respingere.

### Changed

- Testele locale cresc de la 12 la 15 cazuri.

## [0.1.2] - 2026-05-22

### Added

- Actor local/mock configurabil prin `LOCAL_ACTOR_EMAIL`.
- Camp actor vizibil in formularele de editare din UI.
- Audit pentru editare, aprobare si respingere cu emailul actorului real.
- Sectiune locala "Toate taskurile" cu filtre pe status.
- Formular simplificat pentru paste email complet / `.eml`.
- Parser pentru headere `From`, `To`, `CC`, `Subject` si corp `text/plain` quoted-printable.
- Extractor fallback imbunatatit pentru linii de minuta de forma `data = responsabil actiune`.
- Responsabili textuali precum `RST`, `AVT` sau `echipa de proiectare`.
- Interfata locala tip triage inbox: import email in stanga, review taskuri in centru, context/audit in dreapta.
- Reprocesare pentru aceeasi sursa daca taskurile active anterioare au fost inchise.
- Titluri compacte pentru taskurile extrase, cu descrierea completa pastrata in interiorul taskului.
- Detectie de termene din date explicite si cuvinte relative precum `maine`, `poimaine`, `marti`, `miercuri`.
- Statusuri post-aprobare `completed_in_planner` si `deleted_in_planner`, cu audit si actiuni in UI.
- Sectiune vizibila "Taskuri active / aprobate" pentru actiunile post-aprobare.
- Separare UI intre review (`proposed`) si taskuri aprobate/active, evitand dublarea dupa aprobare.
- Test de regresie pentru emailuri haotice: headingurile de tip "Taskuri ramase" sunt ignorate, formulele politicoase nu intra in responsabil, iar titlurile rezultate sunt mai scurte si naturale.
- Importul de email este mutat intr-un dialog deschis din butonul principal "Adauga email".
- Istoricul "Toate taskurile" este randat ca lista compacta de carduri cu scroll intern, nu ca tabel lat.
- Pagina locala pastreaza numele TaskWizard, cu favicon PNG transparent si o marca vizuala mai mare.
- Contract `TaskWizardRepository` pentru migrarea controlata de la JSON local la PostgreSQL.
- Detectie explicita pentru configurarea Planner, astfel incat local mode sa nu creeze erori repetitive cand Planner nu este activat.

### Changed

- Aprobarea locala salveaza `approvedBy` din formular, nu un placeholder hardcodat.
- AI provider local/Ollama a fost mutat in Milestone 4 ca prioritate ulterioara.
- Cardurile de review pun in prim-plan titlul, responsabilul, termenul si dovada; editarea completa este disponibila expandabil.
- Testele locale cresc de la 15 la 25 cazuri.
- Extractorul fallback compacteaza mai bine actiuni uzuale din emailuri dezordonate: poze sondaj, raspuns autorizatie, disponibilitate membrana, centralizator IMSAT, tabel curat, lista materiale si semnatar minute.
- Layout-ul local trece de la 3 coloane fixe la 2 zone principale: review central si istoric lateral compact.
- Layout-ul local foloseste mai bine ecranele late: containerul principal se extinde pana la 1760px, cu istoric lateral flexibil.
- Faviconul PNG este decupat mai strans, astfel incat iconita sa ocupe mai mult spatiu in tab.
- Storage-ul JSON local implementeaza contractul comun de repository, pastrand API-ul existent `store`.
- Aprobarea fara Planner configurat ramane `approved` local; `planner_sync_failed` este rezervat pentru esecuri cand integrarea Planner este configurata.
- Filtrele din "Toate taskurile" folosesc etichete profesionale in romana si contoare separate, in locul statusurilor tehnice brute.
- Confidence-ul fallback este calculat din semnale concrete: actiune detectata, responsabil, termen si titlu compact; taskurile complete pot ajunge `high`, iar cele vagi raman `low`.
- Milestone 2 Microsoft 365: Entra ID sign-in, Graph client cu retry, Outlook folder sync, Graph subscriptions/webhook, Planner task creation cu descriere si Entra user lookup pentru assignment.
- Aplicatia web foloseste sesiunea Entra ID pentru actorul de audit/aprobare, cu fallback local doar cand nu exista sesiune.
- UI-ul Next.js a fost aliniat cu dashboardul TaskWizard organizat: header profesional, import email in modal, review central, taskuri active separate si istoric compact in dreapta.
- Testele locale includ acum o regresie statica pentru layoutul Next.js, ca aplicatia sa nu revina accidental la interfata veche.
- Dashboardul Next.js verifica periodic versiunea starii si face refresh automat cand alt utilizator aproba, respinge, editeaza, termina sau sterge taskuri.
- Ingestia blocheaza taskurile 100% identice cand au acelasi titlu, acelasi termen si acelasi responsabil; duplicatele sunt marcate in audit ca `task.duplicate_ignored`.
- A fost adaugat view-ul `/tasks` pentru urmarirea taskurilor dupa termen, prioritate si responsabil, cu filtre dinamice si mini-calendar lateral.
- Review-ul permite acum `Aproba prioritar`, marcand taskul cu prioritate ridicata inainte de sincronizare/urmarire.
- Filtrele de responsabili din `/tasks` sunt separate pe doua randuri: angajati interni si alti responsabili, cu curatare pentru taguri poluate de date/numere.
- Tagurile de responsabili din `/tasks` sunt ordonate descrescator dupa numarul de taskuri, cu sortare alfabetica doar la egalitate.
- Audit de clean code: view-ul `/tasks` calculeaza o singura data responsabilul/angajatul per task, storage-ul local foloseste lookup prin `Map`, iar versiunea dashboardului gaseste ultimul timestamp fara sortare inutila.
- View-ul `/tasks` afiseaza doar taskuri actionabile: in asteptare de aprobare, aprobate sau active in Planner/sincronizare.
- Reguli locale de privacy pentru emailuri: expeditorii blocati nu creeaza taskuri si nu pastreaza text brut, iar sursele private creeaza taskuri vizibile/actionabile doar pentru adresele configurate in fisier local ignorat de Git.
- Importul citeste acum fisiere reale si atasamente din `.eml`: `.docx`, `.pdf`, `.xlsx/.xlsm`, `.csv` si `.txt` sunt transformate in text inainte de extractia taskurilor; `.doc` vechi are doar extractie best-effort.
- Storage-ul JSON local scrie atomic prin fisier temporar si serializeaza mutatiile, evitand coruperea `store.json` la requesturi concurente.
- Extractorul fallback nu mai produce titluri trunchiate de tip `Transmite solutie astazi sau` si curata separatorii `-` / `–` ramasi in responsabil.

### Known Limitations

- `npm`/`pnpm` nu este disponibil in PATH pe masina curenta.
- Varianta Next.js nu a fost inca build-uita local.
- Graph/Planner sunt implementate la nivel de client si endpoint, dar nu au fost validate inca pe tenant real.
- Storage-ul activ pentru MVP local este JSON, nu PostgreSQL.
