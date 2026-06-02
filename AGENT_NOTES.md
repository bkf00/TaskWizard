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
- Am simplificat introducerea emailurilor: utilizatorul poate lipi un `.eml`/email complet intr-un singur camp, iar sistemul extrage automat subiectul, expeditorul, participantii si corpul text/plain.
- Am imbunatatit extractorul fallback pentru minute: liniile de forma `data = responsabil actiune` extrag responsabilul textual si genereaza titluri de actiune mai curate.
- Am redesenat UI-ul local ca un triage inbox: import simplu, review vizual al taskurilor active, editare expandabila si panou separat pentru istoricul complet/audit.
- Am corectat fluxul de retestare: aceeasi sursa poate fi reprocesata daca nu mai are taskuri active de review, pastrand in continuare protectia anti-duplicare cand exista propuneri active.
- Am schimbat conventia de extractie: titlul taskului trebuie sa fie scurt si scanabil, iar actiunea completa ramane in descriere/evidence.
- Am adaugat detectie de termene in fallback: date explicite, `azi`, `maine`, `poimaine` si zile ale saptamanii calculate relativ la data curenta.
- Am extins ciclul de viata post-aprobare: taskurile create/aprobate pot fi marcate ca terminate sau sterse din Planner, fara stergere hard din audit.
- Am clarificat UI-ul local pentru ciclul post-aprobare: butoanele Terminat/Sters apar intr-o sectiune dedicata taskurilor aprobate/active.
- Am corectat dublarea post-aprobare: `planner_sync_failed` nu mai apare in Review, ci doar in sectiunea de taskuri active/aprobate.
- Am resetat storage-ul local si am retestat cu 4 emailuri haotice generate local: 14 taskuri propuse, 0 erori, responsabili curatati si titluri mai scurte.
- Am extins testele locale la 25 cazuri, inclusiv headinguri haotice, responsabili cu formule politicoase si titluri compacte pentru emailuri reale dezordonate.
- Am simplificat UI-ul local: importul este un dialog deschis din buton, iar istoricul taskurilor este un panou compact cu scroll intern, pentru a evita tabelul lat si derularea greoaie.
- Am largit layout-ul local pentru ecrane wide, reducand spatiul lateral nefolosit fara sa reintroduc scroll orizontal.
- Am pastrat numele experientei locale ca TaskWizard si am adaugat favicon/header mark PNG transparent, pastrand tonul profesional al produsului.
- Am decupat mai strans faviconul PNG pentru ca iconita sa para mai mare in tab, in limitele browserului.
- Am finalizat ultimul punct din Milestone 1: persistenta este separata prin contractul `TaskWizardRepository`, iar JSON local este doar prima implementare.
- Am schimbat comportamentul local pentru Planner neconfigurat: aprobarile raman `approved` si nu mai creeaza erori repetitive `planner_sync`.
- Am rafinat zona de categorii din istoricul taskurilor: statusurile interne raman in cod, dar UI-ul afiseaza etichete profesionale si contoare usor de scanat.
- Am imbunatatit criteriul de confidence: un task este considerat mai sigur cand are actiune, responsabil, termen si titlu compact; asta apropie scorul de verificarea umana.
- Am implementat Milestone 2 la nivel de cod: Entra ID auth, Graph client, Outlook sync, subscriptions/webhook, Planner create si lookup email -> Entra user ID. Urmatorul risc major este validarea cu un tenant real si restrictii de acces pe mailbox.
- Am legat UI-ul si rutele Next.js de actorul autentificat prin Entra, astfel incat aprobarile si auditul sa foloseasca emailul userului logat in locul fallback-ului local.
- Am aliniat UI-ul Next.js cu interfata TaskWizard organizata folosita in runnerul local: import prin modal, review central, taskuri active separate si istoric compact cu filtre profesionale.
- Am adaugat test de regresie pentru layoutul Next.js, deoarece pagina veche poate reaparea usor cand lucram separat pe runnerul local si pe aplicatia web.
- Am adaugat refresh live prin polling de versiune pentru dashboardul Next.js. Alegerea e intentionat simpla pentru o echipa mica: ceilalti utilizatori vad actiunile pe taskuri fara refresh manual, iar formularele deschise nu sunt intrerupte.
- Am adaugat safeguard de deduplicare pentru taskuri identice. Cheia este stricta si cere titlu, termen si responsabil; taskurile fara termen sau responsabil explicit nu sunt blocate doar pentru ca au titlu asemanator.
- Am separat experienta de review de experienta operationala: `/` ramane inbox de aprobare, iar `/tasks` devine view pentru planificare pe termen, prioritate si responsabil, cu mini-calendar lateral.
- Am separat filtrele din `/tasks` in doua randuri: angajati interni cunoscuti si alti responsabili. Asta pregateste viitorul pas de asignare reala catre useri fara sa amestecam firmele sau fragmentele extrase gresit cu oamenii interni.
- Am ordonat tagurile de responsabili dupa volum: cele cu mai multe taskuri sunt primele, iar cele fara taskuri cad la final.
- Am definit `/tasks` ca view operational pentru taskuri actionabile: include `proposed`, `approved`, `created_in_planner` si `planner_sync_failed`, dar exclude istoricul inchis.
- Am facut auditul de clean code pe zonele adaugate recent: am eliminat calcule repetate in `/tasks`, am simplificat calculul versiunii live si am optimizat salvarea batch in storage fara sa schimb comportamentul functional.
- Am adaugat privacy local configurabil prin fisier ignorat de Git: expeditorii blocati nu genereaza taskuri si nu pastreaza raw text, iar taskurile private sunt filtrate pe actor si protejate si in actiunile de aprobare/editare/inchidere.
- Am extins importul cu extractie de documente si atasamente: `.eml` poate alimenta taskurile din `.docx` atasat, iar documentele moderne `.docx`, `.pdf`, `.xlsx/.xlsm`, `.csv` si `.txt` pot fi incarcate direct. Am evitat pachetul `xlsx` din cauza vulnerabilitatilor fara fix si am folosit un parser XLSX minimal prin `jszip`.
- Am reparat o corupere a `apps/web/data/store.json` aparuta dupa scrieri concurente si am schimbat storage-ul local sa foloseasca o coada de mutatii plus scriere atomica prin fisier temporar si rename.
- Am corectat fallback-ul de extractie pentru linii precum `Soprema si Bouder - transmite solutie astazi sau maine`: titlul devine `Transmite solutie`, iar responsabilul ramane `Soprema si Bouder`, fara separatorul dintre responsabil si actiune.

## Regula de utilizare

La fiecare schimbare viitoare:

1. Ruleaza sau actualizeaza testele relevante.
2. Actualizeaza `CHANGELOG.md` daca se schimba comportamentul.
3. Adauga o nota scurta aici daca decizia conteaza pentru directia proiectului.
4. Daca apare un impas, verifica `pasi/08-checklist-impasuri.md`.
