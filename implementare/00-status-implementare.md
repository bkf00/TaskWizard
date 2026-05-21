# Status implementare

Data: 2026-05-18

## Ce exista acum

Aplicatia are un schelet functional pentru MVP:

- proiect TypeScript/Next.js;
- pagina principala pentru adaugare surse manuale;
- API pentru ingestie manuala;
- extractie taskuri prin Azure OpenAI, cu fallback local simplu daca AI nu este configurat;
- lista de taskuri propuse;
- aprobare/respingere task;
- incercare de creare task in Planner dupa aprobare;
- audit local;
- lista de erori;
- webhook Graph de baza pentru validare si audit notificari;
- schema PostgreSQL/Drizzle pentru baza de date finala;
- worker de reinnoire subscription-uri Graph;
- runner local fara dependinte: `tools/local-mvp-server.mjs`.

## Ce este local/provizoriu

Pentru MVP local se foloseste `data/store.json`.

Aceasta alegere este intentionata pentru a putea testa fluxul fara Azure/PostgreSQL. Pentru productie, storage-ul trebuie inlocuit cu PostgreSQL/Drizzle.

## Ce trebuie configurat inainte de rulare reala

1. Pentru varianta Next.js, `npm` sau `pnpm` trebuie disponibil in PATH.
2. Dependintele trebuie instalate cu `npm install`.
3. Se creeaza `.env.local` din `.env.example`.
4. Pentru AI real:
   - `AZURE_OPENAI_ENDPOINT`
   - `AZURE_OPENAI_API_KEY`
   - `AZURE_OPENAI_DEPLOYMENT`
5. Pentru Planner real:
   - `GRAPH_TENANT_ID`
   - `GRAPH_CLIENT_ID`
   - `GRAPH_CLIENT_SECRET`
   - `PLANNER_PLAN_ID`
   - `PLANNER_BUCKET_ID`
6. Pentru Graph webhook:
   - `GRAPH_WEBHOOK_CLIENT_STATE`
   - URL public HTTPS pentru webhook.

## Ce NU este inca complet

- Autentificare Entra ID activa in UI.
- Repository PostgreSQL in loc de JSON local.
- Subscription Graph pentru folder Outlook creat automat.
- Citire reala emailuri/transcripturi din Graph.
- UI de editare completa a taskului inainte de aprobare.
- Mapping responsabil email -> Microsoft Entra user ID.
- Detectie duplicate cu `pgvector`.
- Deployment Azure/Terraform.

## Ordinea recomandata pentru urmatoarea sesiune

1. Pornim runnerul local fara npm si testam fluxul manual.
2. Instalam npm/pnpm pentru aplicatia Next.js.
3. Testam fluxul manual cu fallback AI.
4. Adaugam editare task in UI.
5. Adaugam Entra ID auth.
6. Mutam storage-ul pe PostgreSQL.
7. Integram Graph pentru folder Outlook.
8. Integram Planner si testam cu un plan real.
