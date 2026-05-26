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

### Changed

- Aprobarea locala salveaza `approvedBy` din formular, nu un placeholder hardcodat.
- AI provider local/Ollama a fost mutat in Milestone 4 ca prioritate ulterioara.
- Cardurile de review pun in prim-plan titlul, responsabilul, termenul si dovada; editarea completa este disponibila expandabil.
- Testele locale cresc de la 15 la 25 cazuri.
- Extractorul fallback compacteaza mai bine actiuni uzuale din emailuri dezordonate: poze sondaj, raspuns autorizatie, disponibilitate membrana, centralizator IMSAT, tabel curat, lista materiale si semnatar minute.
- Layout-ul local trece de la 3 coloane fixe la 2 zone principale: review central si istoric lateral compact.
- Layout-ul local foloseste mai bine ecranele late: containerul principal se extinde pana la 1760px, cu istoric lateral flexibil.
- Faviconul PNG este decupat mai strans, astfel incat iconita sa ocupe mai mult spatiu in tab.

### Known Limitations

- `npm`/`pnpm` nu este disponibil in PATH pe masina curenta.
- Varianta Next.js nu a fost inca build-uita local.
- Graph/Planner nu sunt inca conectate la un tenant real.
- Storage-ul activ pentru MVP local este JSON, nu PostgreSQL.
