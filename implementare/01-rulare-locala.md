# Rulare locala

## 1. Verifica Node si npm

```powershell
node --version
npm --version
```

In momentul crearii proiectului, `node` era disponibil, dar `npm` nu era in PATH.

## 2. Instaleaza dependinte

```powershell
npm install
```

## Alternativa fara npm

Pentru test imediat:

```powershell
node .\tools\local-mvp-server.mjs
```

Deschide `http://localhost:3000`.

## 3. Creeaza `.env.local`

```powershell
Copy-Item .env.example .env.local
```

Pentru test local fara Azure OpenAI si fara Planner, poti lasa credentialele goale. Aplicatia va folosi extractorul fallback si va pastra taskurile aprobate local, fara sa creeze erori repetitive de configurare Planner.

## 4. Porneste aplicatia

```powershell
npm run dev
```

Deschide:

```text
http://localhost:3000
```

## 5. Test manual

Introdu o sursa cu text de forma:

```text
Te rog verifica PV-ul pentru lucrarea X.
Ramane sa trimitem documentatia catre client pana vineri.
Pregateste lista de observatii pentru sedinta urmatoare.
```

Rezultat asteptat:

- apar 1-3 taskuri propuse;
- status initial `proposed`;
- la aprobare, daca Planner nu este configurat, taskul ramane `approved` local si nu creeaza eroare repetata;
- eroarea apare in zona "Erori procesare";
- auditul se completeaza.
