# Task classification model

TaskWizard trebuie sa evite doua confuzii recurente:

- cine executa efectiv taskul;
- proiectul/contextul la care apartine taskul.

Pentru o firma mica, solutia nu trebuie sa fie un catalog hardcodat de clienti si oameni, ci o clasificare verificabila, editabila si invatabila din context.

## Clasificare propusa

Fiecare task trebuie tratat ca una dintre aceste clase:

- `internal_action`: responsabilul este din echipa RST si taskul trebuie executat intern.
- `external_action`: responsabilul este o firma/persoana externa; TaskWizard urmareste promisiunea, dar nu o executa.
- `watch_follow_up`: nu exista un executant clar, dar exista un eveniment de urmarit sau o conditie de verificat.
- `context_note`: informatia este utila pentru proiect, dar nu merita task operational.

Campurile existente acopera partial modelul:

- `assigneeName` / `assigneeEmail`: cine pare responsabil.
- `projectHint`: proiect/context estimat.
- `confidence`: cat de sigur este sistemul.
- `evidence`: textul sursa care justifica propunerea.

Campuri recomandate pentru urmatorul pas de schema:

- `executionOwnerType`: `internal`, `external`, `watch`, `none`.
- `projectContext`: nume liber/editabil al proiectului.
- `counterpartyName`: firma/persoana externa, cand nu este responsabil intern.
- `classificationReason`: explicatie scurta pentru audit si review.

## Reguli de produs

- Taskurile interne pot ajunge in Planner ca actiuni asignabile.
- Taskurile externe nu trebuie asignate automat unui angajat intern doar pentru ca apare numele lui in email; ele trebuie urmarite ca promisiuni externe.
- Taskurile `watch_follow_up` pot genera follow-up intern doar daca depasesc termenul sau utilizatorul apasa explicit follow-up.
- `projectContext` trebuie sa ramana editabil in review. Sistemul poate propune, omul confirma.

## Cum inferam proiectul fara hardcoding

Ordinea semnalelor:

1. Subiectul emailului si numele fisierului atasat.
2. Header-ele threadului si participantii.
3. Entitati repetate in primele paragrafe.
4. Folderul Outlook dedicat sau categoria Outlook, cand exista.
5. Istoricul surselor similare deja aprobate.

Daca doua proiecte au semnale apropiate, sistemul trebuie sa scada `confidence` si sa ceara confirmare, nu sa ghiceasca agresiv.

## Ce ramane de implementat

- Adaugare campuri in `ProposedTask` si schema PostgreSQL.
- UI de review pentru `internal/external/watch`.
- Filtru in `/tasks` pe proiect si tip de ownership.
- Teste cu minute ambigue, inclusiv cazuri DSSPG / DSS / Hala / proiect nou.
