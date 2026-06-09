# PostgreSQL migration plan

Storage-ul activ ramane JSON pentru MVP local, dar codul este deja separat prin `TaskWizardRepository`. Migrarea reala la PostgreSQL trebuie facuta fara sa schimbe fluxul produsului.

## Directie

- Pastram JSON ca mod local/dev.
- Adaugam `PostgresTaskWizardRepository` langa `JsonFileTaskWizardRepository`.
- Selectam repository-ul prin env, de exemplu `TASKWIZARD_STORAGE=postgres`.
- Folosim schema Drizzle existenta din `packages/db/src/schema.ts`.

## Pasii recomandati

1. Adauga migratii Drizzle versionate.
2. Creeaza repository PostgreSQL cu aceleasi metode ca interfata curenta.
3. Adauga teste contractuale care ruleaza aceeasi suita pe JSON si PostgreSQL.
4. Adauga script de migrare JSON -> PostgreSQL pentru date locale existente.
5. Activeaza PostgreSQL in productie doar dupa backup si test restore.

## Indexuri importante

- `source_items.source_hash`: unic, deja modelat.
- `proposed_tasks.status`: pentru view-urile active/review.
- `proposed_tasks.due_date`: pentru calendar si overdue.
- `proposed_tasks.assignee_email` / `assignee_name`: pentru filtre responsabili.
- `audit_events.created_at`: pentru istoric si debugging.

## Date sensibile

- `raw_text_encrypted` trebuie sa ramana criptat la nivel aplicatie sau baza de date.
- `.env`, fisiere de privacy locale si exporturi reale nu se comit in Git.
- Pentru productie, se muta secret-ele in Key Vault/secret manager, nu in fisiere locale.

## Criteriu de acceptare

Migrarea este pregatita cand:

- `npm run test:local` ramane verde pe JSON;
- testele contractuale trec pe repository PostgreSQL;
- CI ruleaza lint/typecheck/test/build;
- exista rollback clar la JSON exportat sau backup PostgreSQL.
