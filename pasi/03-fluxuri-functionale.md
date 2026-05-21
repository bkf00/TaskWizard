# 03 - Fluxuri functionale

## Flux email

1. Utilizatorul muta un email intr-un folder dedicat, de exemplu `De transformat in task`.
2. Microsoft Graph notifica sistemul sau sistemul verifica periodic folderul.
3. Modulul `ingestion` citeste emailul.
4. Sistemul verifica daca emailul a mai fost procesat.
5. Sursa este salvata in `source_items`.
6. Workerul trimite continutul catre AI.
7. AI returneaza taskuri propuse.
8. Taskurile apar in UI cu status `proposed`.
9. Utilizatorul aproba, editeaza sau respinge.
10. Taskurile aprobate sunt create in Planner.
11. Sistemul salveaza auditul.

## Flux meeting Teams

1. Meetingul trebuie sa aiba transcript, recap sau note disponibile.
2. In MVP, meetingurile nu se proceseaza toate automat.
3. Utilizatorul marcheaza meetingul de procesat sau incarca transcriptul/recap-ul.
4. Sistemul citeste transcriptul prin Graph daca este posibil.
5. Daca transcriptul nu este disponibil, se foloseste fallback manual: fisier/recap in SharePoint sau email dedicat.
6. AI extrage taskuri propuse.
7. Utilizatorul aproba, editeaza sau respinge.
8. Taskurile aprobate sunt create in Planner.

## Regula importanta

Nicio sursa nu trebuie sa creeze taskuri direct in Planner fara pasul de aprobare.

## Zone unde apar frecvent probleme

- Transcriptul Teams nu exista.
- Graph nu are permisiuni suficiente.
- Notificarea Graph ajunge de mai multe ori.
- AI identifica discutii ca taskuri.
- Responsabilul nu este clar.
- Termenul limita nu este mentionat explicit.

