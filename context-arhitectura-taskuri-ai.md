# Context si arhitectura: taskuri automate din Teams si emailuri

Data documentului: 2026-05-18

## Context companie

- Firma are aproximativ 8 angajati.
- Exista deja licente Microsoft 365 Premium / Business Premium sau similare, cu acces la Teams, Outlook, SharePoint, Planner/To Do si probabil Power Automate standard.
- Nu este confirmat daca exista licente Microsoft 365 Copilot. Copilot este in mod normal licenta separata fata de Business Premium.
- Scopul este transformarea meetingurilor Teams si emailurilor in taskuri utile, cu AI care extrage actiuni, responsabili si termene.
- Pentru dimensiunea firmei, sistemul trebuie sa fie simplu operational, sigur si usor de intretinut.

## Decizii arhitecturale agreate pana acum

Prioritati:

1. Securitate
2. Scalabilitate controlata

Latenta nu este critica. Este acceptabil ca taskurile propuse sa apara dupa 30-90 secunde.

Recomandarea principala:

- Modular monolith, nu microservicii.
- TypeScript ca limbaj principal.
- Next.js pentru interfata si API intern.
- Microsoft Entra ID pentru autentificare.
- PostgreSQL ca baza de date principala.
- `pgvector` pentru detectarea taskurilor similare / duplicate.
- Azure Service Bus pentru procesare asincrona.
- Azure OpenAI pentru extractie AI custom.
- Microsoft Graph API pentru Outlook, Teams, Calendar si Planner.
- Planner ca destinatie oficiala pentru taskuri aprobate.
- SharePoint/Excel raman utile ca surse existente sau pentru export, dar nu ar trebui sa fie nucleul aplicatiei.

## De ce modular monolith

Pentru o firma de 8 persoane, microserviciile ar introduce complexitate inutila:

- mai multe deploy-uri;
- autentificare intre servicii;
- debugging mai greu;
- monitorizare mai complicata;
- cost operational mai mare.

Un modular monolith cu workers asincroni este suficient si mai robust. Daca sistemul creste, modulele `extraction-worker` si `planner-sync-worker` pot fi separate ulterior.

## Flux functional recomandat

### Flux email

1. Utilizatorul muta un email intr-un folder dedicat, de exemplu `De transformat in task`.
2. Microsoft Graph trimite notificare sau sistemul face polling controlat.
3. Modulul `ingestion` citeste emailul.
4. Se salveaza sursa in `raw_sources`, cu continut minim necesar.
5. Workerul trimite textul catre AI pentru extragere taskuri.
6. AI returneaza taskuri propuse, nu definitive.
7. Taskurile apar in UI cu status `proposed`.
8. Un utilizator aproba, editeaza sau respinge.
9. Dupa aprobare, `planner-sync-worker` creeaza taskul in Microsoft Planner.
10. Sistemul salveaza auditul complet.

### Flux meeting Teams

1. Meetingul trebuie sa aiba transcript/recap disponibil.
2. Procesarea meetingurilor nu ar trebui facuta automat pentru toate intalnirile la inceput.
3. Recomandare MVP: utilizatorul marcheaza manual meetingul de procesat sau pune transcriptul/recap-ul intr-un folder SharePoint/Outlook dedicat.
4. Sistemul citeste transcriptul prin Microsoft Graph, daca permisiunile si politicile tenantului permit.
5. Daca transcriptul nu este disponibil prin API, fallback-ul este upload/manual drop intr-un folder SharePoint.
6. AI extrage doar actiuni explicite.
7. Taskurile propuse intra in acelasi flux de aprobare.

## Module necesare

### `identity`

Responsabilitati:

- login prin Microsoft Entra ID;
- limitare acces la domeniul companiei;
- roluri: `admin`, `approver`, `viewer`;
- mapare utilizatori interni la email si ID Microsoft Entra.

Necesar pentru functionare: da.

### `graph`

Responsabilitati:

- citire emailuri;
- citire calendar/meeting metadata;
- citire transcript Teams, unde este disponibil;
- creare taskuri in Planner;
- reinnoire subscriptions Microsoft Graph;
- tratare throttling si erori 429.

Necesar pentru functionare: da.

### `ingestion`

Responsabilitati:

- primeste notificari Graph sau proceseaza polling;
- normalizeaza surse diferite: email, transcript, recap manual;
- calculeaza hash de sursa pentru idempotenta;
- salveaza datele brute minime.

Necesar pentru functionare: da.

### `ai-extraction`

Responsabilitati:

- curata textul sursa;
- trimite catre Azure OpenAI;
- valideaza raspunsul cu schema stricta;
- marcheaza confidence: `high`, `medium`, `low`;
- nu inventeaza deadline-uri sau responsabili.

Necesar pentru functionare: da.

### `approval`

Responsabilitati:

- afiseaza taskuri propuse;
- permite editare titlu, descriere, responsabil, termen, proiect;
- permite aprobare/respingere;
- pastreaza link catre sursa.

Necesar pentru functionare: da. Pentru aceasta firma mica, validarea umana este cheia sistemului.

### `planner-sync`

Responsabilitati:

- creeaza taskuri aprobate in Planner;
- actualizeaza taskul local cu `plannerTaskId`;
- retry pe erori temporare;
- evita crearea duplicatelor.

Necesar pentru functionare: da.

### `audit`

Responsabilitati:

- log pentru fiecare sursa procesata;
- log pentru fiecare rezultat AI;
- log pentru fiecare aprobare/respingere;
- log pentru fiecare task creat in Planner.

Necesar pentru functionare: da, mai ales pentru confidentialitate si incredere.

### `deduplication`

Responsabilitati:

- detecteaza duplicate prin hash exact;
- detecteaza similaritate prin `pgvector`;
- avertizeaza utilizatorul inainte de aprobare daca exista task similar.

Necesar pentru MVP: partial.
Necesar pentru productie buna: da.

### `admin-settings`

Responsabilitati:

- configurare Planner plan/bucket;
- configurare folder email monitorizat;
- configurare retention;
- configurare utilizatori/roluri.

Necesar pentru MVP: da, chiar daca minimal.

## Ce era in plus in arhitectura anterioara

Pentru o firma de 8 oameni, urmatoarele sunt probabil prea mult pentru MVP:

- dashboard complex;
- microservicii;
- Graph Data Connect;
- procesare automata a tuturor meetingurilor;
- Copilot Studio ca platforma separata;
- Power Apps daca facem deja UI in Next.js;
- reguli avansate de clasificare pe foarte multe proiecte;
- pipeline complex de redaction in prima versiune, daca sursele sunt selectate manual.

Acestea pot ramane optiuni pentru faza 2, nu cerinte initiale.

## Ce lipsea sau trebuia clarificat

### 1. Reinnoirea subscription-urilor Graph

Microsoft Graph subscriptions expira si trebuie reinnoite periodic. Sistemul are nevoie de un job programat care verifica si reinnoieste subscriptions.

### 2. Idempotenta

Aceeasi notificare Graph poate ajunge de mai multe ori. Sistemul trebuie sa foloseasca hash/source ID ca sa nu proceseze de doua ori acelasi email sau transcript.

### 3. Fallback pentru transcripturi

Transcripturile Teams nu sunt garantate. Pot lipsi daca:

- nu a fost pornita transcrierea;
- politica tenantului nu permite acces;
- organizatorul nu are permisiunile potrivite;
- meetingul nu este calendar-backed sau are limitari Graph.

Fallback necesar: folder SharePoint/Outlook unde utilizatorul pune manual recap/transcript.

### 4. Human-in-the-loop

AI nu trebuie sa creeze direct taskuri in Planner in prima versiune. Riscul de taskuri false sau duplicate este prea mare.

### 5. Retention si confidentialitate

Trebuie setata o politica simpla:

- sursele brute se pastreaza 30-90 zile;
- taskurile aprobate raman in sistem;
- auditul ramane mai mult timp, dar fara text complet sensibil daca nu este necesar.

### 6. Observability

Sistemul are nevoie de un ecran simplu de erori:

- emailuri care nu au putut fi citite;
- transcripturi lipsa;
- erori AI;
- erori Planner;
- retry-uri epuizate.

Fara asta, sistemul pare "magic" si greu de reparat.

### 7. Consimtamant si informare interna

Trebuie clarificat intern ca meetingurile/emailurile marcate pot fi procesate automat de AI. Pentru inceput, recomand procesare explicita, nu supraveghere generala.

## Model de date minim

Tabele recomandate:

- `users`
- `roles`
- `source_items`
- `proposed_tasks`
- `planner_tasks`
- `audit_events`
- `graph_subscriptions`
- `system_settings`
- `processing_errors`

### `source_items`

Campuri:

- `id`
- `type`: `email`, `teams_transcript`, `manual_upload`
- `external_id`
- `source_hash`
- `subject`
- `from_email`
- `participants`
- `received_at`
- `raw_text_encrypted`
- `retention_until`
- `status`

### `proposed_tasks`

Campuri:

- `id`
- `source_id`
- `title`
- `description`
- `assignee_email`
- `due_date`
- `project_hint`
- `confidence`
- `evidence`
- `status`: `proposed`, `approved`, `rejected`, `created_in_planner`
- `approved_by`
- `approved_at`
- `planner_task_id`

## MVP recomandat

MVP-ul corect pentru aceasta firma:

1. Login cu Microsoft Entra ID.
2. Folder Outlook dedicat pentru emailuri de procesat.
3. Upload/manual drop pentru transcripturi sau recap-uri in prima faza.
4. Extractie AI in taskuri propuse.
5. UI simplu de aprobare.
6. Creare taskuri aprobate in Planner.
7. Audit si ecran de erori.
8. Retention simplu pentru surse brute.

Nu as incepe cu procesare automata a tuturor meetingurilor. Pentru o companie mica, castigul nu justifica riscul operational si de confidentialitate.

## Faza 2

Dupa 2-4 saptamani de utilizare:

- integrare directa Teams transcript prin Graph;
- detectie duplicate cu embeddings/pgvector;
- asignare automata responsabil pe baza participantilor;
- dashboard de volum si rata de aprobare;
- clasificare pe proiect/client;
- reguli custom pe emailuri;
- procesare automata pentru meetinguri recurente selectate.

## Criterii de succes

Sistemul este util daca:

- peste 70% dintre taskurile propuse sunt aprobate cu modificari mici;
- duplicatele sunt rare sau semnalate;
- utilizatorul poate valida taskurile in sub 2 minute dupa un meeting/email;
- nu apar taskuri in Planner fara aprobare;
- fiecare task are sursa si audit;
- sursele brute nu sunt pastrate mai mult decat este necesar.

## Concluzie arhitecturala

Arhitectura descrisa anterior este functionala ca directie, dar pentru firma de 8 oameni trebuie restransa in MVP:

- pastram modular monolith;
- pastram Azure/Microsoft stack;
- pastram PostgreSQL si queue;
- pastram AI cu validare umana;
- eliminam complexitatea inutila in prima faza;
- adaugam explicit idempotenta, renewal Graph subscriptions, fallback transcripturi, retention si ecran de erori.

Forma finala recomandata nu este "AI care face taskuri automat", ci "AI care pregateste taskuri, omul decide, Planner devine sursa operationala".
