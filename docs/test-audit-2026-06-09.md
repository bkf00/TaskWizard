# Test audit - 2026-06-09

## Scope

Audit rulat pentru TaskWizard in `C:\Users\BogdanCojocaru\TaskWizard`, commit de baza `8c383c1`.

## Teste rulate

- `npm run typecheck`
- `npm run test:local`
- `npm run build`
- `npm audit --omit=dev`
- `git diff --check`
- verificare HTTP pe serverul local Next.js:
  - `/`
  - `/tasks`
  - `/api/state/version`
  - `/api/auth/session`
- scan static rapid pentru TODO/FIXME/secret/token/privacy/urgent/follow-up.

## Rezultate

- PASS: TypeScript compileaza cu `tsc --noEmit`.
- PASS: suita locala are 28/28 teste trecute.
- PASS: build-ul Next.js trece si genereaza rutele asteptate.
- PASS: `/`, `/tasks`, `/api/state/version`, `/api/auth/session` raspund cu HTTP 200.
- PASS: `git diff --check` nu raporteaza whitespace invalid.
- FAIL/BLOCKED: `npm run lint` nu ruleaza non-interactiv; `next lint` cere configurare ESLint si este deprecated pentru Next 16.
- RISK: `npm audit --omit=dev` raporteaza vulnerabilitati in `drizzle-orm` si `postcss` via `next`.

## Vulnerabilitati npm audit

- `drizzle-orm <0.45.2`: high severity, SQL injection prin identificatori SQL escapati incorect.
- `postcss <8.5.10`: moderate severity, XSS in CSS stringify; vine prin `next`.

Nu am rulat `npm audit fix --force`, deoarece propune upgrade-uri breaking.

## Observatii tehnice

- Aplicatia este intr-o stare functionala pentru MVP local.
- Testele acopera multe regresii importante: parsing email/minute, date relative, duplicate, review/approval, privacy, M365 wiring, taskuri urgente, follow-up si sanitizare responsabili falsi.
- Exista inca dependenta mare pe testul monolitic `tools/test-local-mvp.mjs`; pe termen mediu trebuie impartit in teste unitare pe pachete.
- `npm run lint` trebuie reparat inainte de CI serios.
- Pentru testarea importului `.eml` fara a atinge store-ul local este nevoie de un harness dedicat cu `LOCAL_DATA_DIR` temporar si server Next pornit izolat.

## Urmatoarele puncte de lucru

1. Reparare lint non-interactiv
   - Adauga configurare ESLint explicita pentru Next/TypeScript.
   - Inlocuieste `next lint` cu ESLint CLI.
   - Adauga script `lint` care ruleaza fara prompt.

2. Actualizare dependinte cu risc
   - Planifica upgrade controlat pentru `drizzle-orm`.
   - Verifica compatibilitatea Next/PostCSS si urmareste patch-ul sigur pentru versiunea curenta de Next.
   - Ruleaza build/test dupa fiecare upgrade.

3. Test harness pentru importuri reale
   - Porneste Next cu `LOCAL_DATA_DIR` temporar.
   - Incarca `.eml`, `.docx`, `.pdf`, `.xlsx`, `.csv` prin API.
   - Verifica output-ul taskurilor fara sa modifice datele locale de lucru.

4. Teste unitare separate
   - Mutare teste pentru extractor in pachetul `packages/ai`.
   - Teste dedicate pentru `packages/domain`: approval, privacy, assignee, urgency, task identity.
   - Teste dedicate pentru `packages/graph` cu mock fetch.

5. Hardening Microsoft 365
   - Teste pentru Graph webhook validation token.
   - Teste pentru clientState invalid.
   - Teste pentru retry/pagination in Outlook.
   - Teste pentru mapping email -> Entra user.

6. UX pentru taskuri externe si proiecte
   - Defineste explicit tipul taskului: intern, extern, watch/follow-up.
   - Adauga project/context hint editabil si filtrabil.
   - Diferentiaza in UI intre responsabil intern si actor extern.

7. Persistenta production
   - Clarifica trecerea de la JSON local la PostgreSQL.
   - Adauga migratii Drizzle si teste pe schema.
   - Pastreaza JSON local doar pentru dev/MVP.

8. CI GitHub
   - Ruleaza typecheck, test:local, build, audit.
   - Adauga lint dupa repararea ESLint.
   - Adauga artifact cu sumar test.
