# Coverage comportamental

Data: 2026-05-18

Acest coverage este comportamental, nu coverage instrumentat de linii de cod. Motivul: `npm`/`pnpm` nu este disponibil in PATH, deci nu putem instala inca un runner de teste cu instrumentare.

## Acoperit acum

| Zona | Acoperire | Test |
| --- | --- | --- |
| Server local | Raspunde pe HTTP | `GET / returns the MVP interface` |
| Validare input | Subiect/text obligatorii | `empty input is rejected` |
| Validare tip sursa | Doar `email`, `teams_transcript`, `manual_upload` | `invalid source type is rejected` |
| Ingestie fara task | Sursa salvata, fara taskuri false | `source without action phrases creates no proposed tasks` |
| Ingestie actionabila | Creeaza taskuri propuse | `clear source creates expected proposed tasks` |
| Email raw `.eml` | Extrage headere si corp text/plain | `raw EML paste extracts headers and plain text body` |
| Minute structurate | Extrage firme/acronime ca responsabili si sumarizeaza titluri | `meeting minute lines summarize actions and extract company assignees` |
| Idempotenta | Duplicat ignorat | `duplicate source is ignored idempotently` |
| Editare task | `proposed` ramane editabil inainte de aprobare | `proposed task can be edited before approval` |
| Validare editare | Titlu prea scurt respins | `invalid task edit is rejected` |
| Aprobare | Fara Planner configurat ramane aprobat local | `approval without Planner config remains approved locally` |
| Task inexistent | Returneaza `404` | `unknown task approval returns 404` |
| Respingere | `proposed` -> `rejected` | `reject changes only proposed tasks to rejected` |
| Tranzitii invalide | Respinge repetare cu `409` | `rejected tasks cannot be rejected twice` |
| Tranzitii invalide | Blocheaza editarea unui task respins | `rejected tasks cannot be edited` |
| UI escaping | Nu reda script raw | `HTML-like task content is escaped in UI` |
| Lista taskuri | Expune filtre pe status | `all tasks section exposes status filters` |
| Dialog lung | Extrage taskuri operationale din sedinta | `long meeting dialog extracts multiple operational tasks` |

## Neacoperit inca

- Coverage instrumentat pe linii/functii.
- Typecheck TypeScript complet.
- Build Next.js.
- Teste UI cu Playwright.
- Teste PostgreSQL/Drizzle.
- Teste reale Microsoft Graph.
- Teste reale Planner.
- Teste Azure OpenAI cu raspuns JSON strict.
- Teste de autentificare Entra ID.

## Prag recomandat pentru productie

Inainte de productie:

- minimum 80% line coverage pentru modulele `domain`, `ai`, `graph`;
- 100% coverage pe tranzitii critice de status;
- teste integration pentru Graph/Planner intr-un tenant de test;
- teste de regresie pe dialoguri romanesti reale;
- test de securitate pentru acces neautentificat dupa activarea Entra ID.
