# GitHub setup

## Status curent

Repository-ul local este pregatit pentru GitHub:

- README profesional;
- security policy;
- contributing guide;
- changelog;
- roadmap;
- ADR-uri;
- issue templates;
- PR template;
- CODEOWNERS;
- GitHub Actions CI;
- teste locale fara dependinte.

## Limitare curenta

In sesiunea curenta:

- GitHub connector este conectat la utilizatorul `bkf00`;
- repo-ul `bkf00/TaskWizard` este vizibil prin metadata;
- scrierea prin connector esueaza cu `403 Resource not accessible by integration`;
- instalarea GitHub App apare goala: `installations: []`, `accounts: []`;
- `git` nu este disponibil in PATH local.
- browserul in-app poate deschide repo-ul, dar nu este autentificat in GitHub.

## Pas manual necesar

Creeaza un repository gol in GitHub, recomandat:

```text
taskuri-ai-teams-emailuri
```

Recomandari:

- Visibility: Private
- Initialize with README: No
- Add .gitignore: No
- Add license: No

Dupa ce repository-ul exista si este accesibil prin connector, Codex poate continua cu:

- verificare repo;
- creare branch `codex/initial-professional-repo`;
- upload fisiere;
- creare PR;
- comentarii pe PR si issue-uri.

## Fallback fara git/gh

Exista un script care poate publica repo-ul direct prin GitHub REST API daca exista un token local:

```powershell
$env:GITHUB_TOKEN="tokenul-tau"
node .\tools\publish-to-github.mjs
```

Tokenul trebuie sa fie fine-grained, limitat la `bkf00/TaskWizard`, cu permisiunea:

```text
Contents: Read and write
```

Nu salva tokenul in repository si nu il scrie in fisiere.

## Regula pentru comentarii viitoare

La fiecare schimbare semnificativa, Codex trebuie sa actualizeze:

- `AGENT_NOTES.md` pentru decizii/context;
- `CHANGELOG.md` pentru schimbari de comportament;
- PR description cu teste si riscuri;
- issue/PR comments cand exista discutii de proiect.
