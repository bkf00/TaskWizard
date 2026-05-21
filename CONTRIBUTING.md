# Contributing

Acest proiect este intern. Schimbarile trebuie sa pastreze principiul de baza:

> AI propune. Omul aproba. Planner primeste doar taskuri validate.

## Workflow

1. Citeste `pasi/00-index.md`.
2. Verifica `implementare/00-status-implementare.md`.
3. Creeaza o schimbare mica si verificabila.
4. Ruleaza testele locale:

```powershell
node .\tools\test-local-mvp.mjs
```

5. Actualizeaza documentatia afectata.
6. Noteaza schimbarea in `CHANGELOG.md` sau `AGENT_NOTES.md`.

## Reguli tehnice

- Nu crea taskuri in Planner fara aprobare umana.
- Nu introduce procesare automata generala a tuturor meetingurilor in MVP.
- Nu salva secrete in repository.
- Nu pastra date brute mai mult decat politica de retention.
- Orice integrare Graph/Planner trebuie sa fie idempotenta.
- Orice schimbare la stari trebuie reflectata in `pasi/05-date-si-stari.md`.

## Definition of Done

- Codul ruleaza local sau are documentata clar limitarea.
- Testele locale trec.
- Documentatia relevanta este actualizata.
- Riscurile de securitate/confidentialitate sunt mentionate.

