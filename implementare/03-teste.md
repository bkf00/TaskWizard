# Teste MVP local

## Comanda

```powershell
node .\tools\test-local-mvp.mjs
```

## Ce acopera

- `GET /` raspunde cu interfata MVP.
- Input gol este respins.
- Tip de sursa invalid este respins.
- Sursa fara actiuni clare nu creeaza taskuri.
- Sursa clara creeaza taskuri propuse.
- Sursa duplicata este ignorata idempotent.
- Task propus poate fi editat inainte de aprobare.
- Editarea invalida este respinsa.
- Aprobare fara Planner configurat esueaza controlat in `planner_sync_failed`.
- Aprobare pentru task inexistent intoarce `404`.
- Respingerea schimba statusul in `rejected`.
- Respingerea repetata a unui task respins intoarce `409`.
- Task respins nu mai poate fi editat.
- Continutul HTML-like este scapat in UI.
- Dialog lung de meeting extrage mai multe taskuri operationale.

## Rezultat ultima rulare

Data: 2026-05-18

Comanda:

```powershell
node .\tools\test-local-mvp.mjs
```

Rezultat:

```text
15 teste rulate
15 passed
0 failed
4 surse create in test
9 taskuri propuse
1 eroare controlata de Planner neconfigurat
12 evenimente audit
```

## Dialog lung testat

Fragmentul de test a simulat o sedinta cu Bogdan, Ana si Mihai despre evidenta PV-uri.

Taskuri asteptate/extrase de fallback:

- verificarea listei de PV-uri lipsa pentru luna aprilie;
- trimiterea centralizatorului actualizat catre client;
- actualizarea statusului pentru lucrarea IMSAT;
- pregatirea listei de observatii pentru sedinta urmatoare;
- verificarea duplicatelor in registrul de PV-uri.

Nota: runnerul local foloseste extractor fallback pe expresii actionabile si limiteaza la 5 taskuri. In versiunea cu Azure OpenAI, limita si calitatea extractiei vor fi controlate prin prompt si schema.

## Limite

Aceste teste acopera runnerul local fara dependinte. Dupa ce `npm`/`pnpm` devine disponibil, trebuie adaugate:

- typecheck pe proiectul Next.js;
- teste unitare pentru modulele TypeScript;
- teste integration cu PostgreSQL;
- teste Graph/Planner cu tenant de test;
- teste Playwright pentru UI.
