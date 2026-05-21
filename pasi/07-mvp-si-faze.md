# 07 - MVP si faze

## MVP recomandat

Pentru firma de 8 angajati, MVP-ul trebuie sa fie mic si sigur.

Include:

1. Login cu Microsoft Entra ID.
2. Folder Outlook dedicat pentru emailuri de procesat.
3. Procesare manuala sau semi-automata pentru transcripturi/recap-uri.
4. Extractie AI in taskuri propuse.
5. UI simplu de aprobare.
6. Creare taskuri aprobate in Planner.
7. Audit.
8. Ecran de erori.
9. Retention pentru surse brute.

## Ce nu intra in MVP

- Procesarea tuturor meetingurilor automat.
- Microservicii.
- Dashboard complex.
- Graph Data Connect.
- Power Apps separat daca avem UI Next.js.
- Clasificare avansata pe multi-client/proiect in prima versiune.
- Automatizare fara aprobare umana.

## Faza 2

Dupa 2-4 saptamani de utilizare:

- integrare directa mai buna cu Teams transcript prin Graph;
- detectie duplicate cu `pgvector`;
- asignare automata pe baza participantilor;
- clasificare pe proiect/client;
- dashboard de volum si rata de aprobare;
- reguli custom pentru emailuri;
- procesare automata pentru meetinguri recurente selectate.

## Faza 3

Doar daca sistemul devine critic:

- separare workers in servicii independente;
- raportare avansata;
- politici de confidentialitate mai sofisticate;
- integrare cu alte sisteme interne;
- modele AI specializate pe datele firmei.

