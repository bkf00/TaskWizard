# Agent Notes

Acest fisier este jurnalul de lucru al agentului. Se actualizeaza la fiecare schimbare semnificativa, astfel incat istoricul deciziilor sa fie inteligibil si pentru om, si pentru Codex.

## 2026-05-18

- Am stabilit ca proiectul este pentru o firma mica, aproximativ 8 angajati.
- Am ales MVP controlat: procesare explicita, AI propune, omul aproba.
- Am evitat microservicii si procesare automata generala a tuturor meetingurilor.
- Am creat documentele din `pasi/` ca sursa de adevar pentru impasuri.
- Am implementat un MVP local fara dependinte deoarece `npm` nu este disponibil in PATH.
- Am adaugat teste extensive pentru runnerul local: 12/12 passing.
- Am pregatit repository-ul pentru GitHub cu governance, CI, issue templates, PR template, security policy, roadmap si changelog.

## Regula de utilizare

La fiecare schimbare viitoare:

1. Ruleaza sau actualizeaza testele relevante.
2. Actualizeaza `CHANGELOG.md` daca se schimba comportamentul.
3. Adauga o nota scurta aici daca decizia conteaza pentru directia proiectului.
4. Daca apare un impas, verifica `pasi/08-checklist-impasuri.md`.

