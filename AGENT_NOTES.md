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

## 2026-05-21

- Am mutat proiectul intr-un folder local curat: `C:\Users\BogdanCojocaru\TaskWizard`.
- Am initializat Git local si am publicat commit-ul initial pe `bkf00/TaskWizard`.
- Am reverificat remote-ul GitHub si testele locale.
- Am continuat roadmap-ul cu editarea taskului inainte de aprobare.
- Am extins testele locale la 15 cazuri, toate passing.

## 2026-05-22

- Am clarificat ca pentru volumul firmei merita testata intai o solutie AI gratuita/locala.
- Am adaugat in roadmap provider AI configurabil `fallback` / `ollama`.
- Am pastrat Azure OpenAI ca optiune platita doar daca AI local nu este suficient.
- Am decis sa mutam lucrul la AI mai tarziu si sa continuam cu functionalitatea de produs: actor local, lista taskuri, persistenta si integrare Microsoft.
- Am implementat actor local/mock pentru audit si aprobare, configurabil prin `LOCAL_ACTOR_EMAIL`.
- Am adaugat sectiunea locala "Toate taskurile" cu filtre pe status si test dedicat.

## Regula de utilizare

La fiecare schimbare viitoare:

1. Ruleaza sau actualizeaza testele relevante.
2. Actualizeaza `CHANGELOG.md` daca se schimba comportamentul.
3. Adauga o nota scurta aici daca decizia conteaza pentru directia proiectului.
4. Daca apare un impas, verifica `pasi/08-checklist-impasuri.md`.
