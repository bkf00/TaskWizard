# Test audit - 2026-06-09

## Scope

Audit rulat pentru TaskWizard in `C:\Users\BogdanCojocaru\TaskWizard`, commit de baza `8c383c1`.

## Teste rulate

- `npm run typecheck`
- `npm run test:local`
- `npm run lint`
- `npm run test:packages`
- `npm run build`
- `npm audit --omit=dev --audit-level=high`
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
- PASS: `npm run lint` ruleaza non-interactiv cu ESLint flat config.
- PASS: testele pe pachete acopera reguli de domeniu, contracte Graph/M365 si importuri `.eml/.docx/.pdf/.xlsx/.csv/.txt`.
- PASS: `npm audit --omit=dev --audit-level=high` nu mai blocheaza CI.
- RISK: `npm audit --omit=dev` raporteaza inca vulnerabilitatea moderata `postcss` via `next`.

## Vulnerabilitati npm audit

- FIXED: `drizzle-orm <0.45.2`: high severity, SQL injection prin identificatori SQL escapati incorect. Dependinta a fost actualizata la `^0.45.2`.
- `postcss <8.5.10`: moderate severity, XSS in CSS stringify; vine prin `next`.

Nu am rulat `npm audit fix --force`, deoarece pentru PostCSS propune o schimbare breaking prin `next@9.3.3`, nepotrivita pentru aplicatia curenta.

## Observatii tehnice

- Aplicatia este intr-o stare functionala pentru MVP local.
- Testele acopera multe regresii importante: parsing email/minute, date relative, duplicate, review/approval, privacy, M365 wiring, taskuri urgente, follow-up si sanitizare responsabili falsi.
- Testul monolitic `tools/test-local-mvp.mjs` ramane util ca regression suite end-to-end, dar cazurile pure au inceput sa fie sparte in `tools/test-domain-units.ts`, `tools/test-graph-units.ts` si `tools/test-import-fixtures.ts`.
- Harness-ul de importuri valideaza extractia documentelor fara sa atinga store-ul local.
- Urmatorul nivel pentru importuri este un smoke API cu `LOCAL_DATA_DIR` temporar si server Next pornit izolat.

## Urmatoarele puncte de lucru

1. Finalizare lint non-interactiv
   - DONE: configurare ESLint explicita pentru TypeScript/React hooks.
   - DONE: inlocuire `next lint` cu ESLint CLI.
   - TODO: adauga reguli Next.js dedicate daca pachetul oficial devine compatibil cu versiunea locala ESLint.

2. Actualizare dependinte cu risc
   - DONE: upgrade controlat pentru `drizzle-orm`.
   - Verifica compatibilitatea Next/PostCSS si urmareste patch-ul sigur pentru versiunea curenta de Next.
   - Ruleaza build/test dupa fiecare upgrade.

3. Test harness pentru importuri reale
   - DONE: genereaza si testeaza local `.eml`, `.docx`, `.pdf`, `.xlsx`, `.csv`, `.txt` prin extractorii de domeniu.
   - TODO: porneste Next cu `LOCAL_DATA_DIR` temporar si incarca aceleasi fisiere prin API.

4. Teste unitare separate
   - DONE: teste dedicate pentru `packages/domain`: privacy, assignee, urgency, task identity.
   - DONE: teste dedicate pentru `packages/graph`: encoding, mapping Outlook si subscription request.
   - TODO: mutare pe termen lung in test runners per workspace cand repo-ul creste.

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
