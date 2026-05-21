# 04 - Module si responsabilitati

## `identity`

Responsabil pentru:

- login prin Microsoft Entra ID;
- limitare acces la companie;
- roluri: `admin`, `approver`, `viewer`;
- mapare email utilizator la ID Microsoft.

## `graph`

Responsabil pentru:

- citire emailuri;
- citire calendar si meeting metadata;
- citire transcripturi Teams, unde sunt disponibile;
- creare taskuri Planner;
- reinnoire Graph subscriptions;
- tratare throttling si erori 429.

## `ingestion`

Responsabil pentru:

- primirea evenimentelor din Graph;
- normalizarea surselor: email, transcript, recap manual;
- calcul hash pentru idempotenta;
- salvare sursa in baza de date.

## `ai-extraction`

Responsabil pentru:

- trimiterea textului catre AI;
- extragerea taskurilor;
- validarea raspunsului AI cu schema stricta;
- marcarea increderii: `high`, `medium`, `low`;
- evitarea inventarii de deadline-uri sau responsabili.

## `approval`

Responsabil pentru:

- afisarea taskurilor propuse;
- editare taskuri;
- aprobare;
- respingere;
- vizualizare sursa.

## `planner-sync`

Responsabil pentru:

- creare task in Planner dupa aprobare;
- salvare `plannerTaskId`;
- retry pe erori temporare;
- prevenire duplicate.

## `audit`

Responsabil pentru:

- cine a procesat;
- ce a propus AI;
- cine a aprobat;
- ce s-a creat in Planner;
- ce erori au aparut.

## `admin-settings`

Responsabil pentru:

- folder Outlook monitorizat;
- Planner plan si bucket;
- reguli de retention;
- utilizatori si roluri;
- setari AI.

