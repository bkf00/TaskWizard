# 09 - Decizii deschise

Acestea sunt lucruri care trebuie confirmate inainte de implementarea completa.

## Licente Microsoft

- Avem Microsoft 365 Business Premium sau alt plan?
- Avem Microsoft 365 Copilot?
- Avem acces la Power Automate premium?
- Avem deja Azure subscription?

## Destinatie taskuri

- Folosim Planner ca sursa operationala finala?
- Avem un singur Planner plan sau mai multe pe proiect/client?
- Cine aproba taskurile propuse?

## Surse initiale

- Ce folder Outlook folosim pentru emailurile de procesat?
- Ce meetinguri vrem sa procesam in prima faza?
- Acceptam fallback manual pentru transcripturi?

## Confidentialitate

- Cat timp pastram textul brut?
- Cine are voie sa vada transcripturile procesate?
- Este nevoie de informare interna scrisa?

## Implementare

- Folosim Azure App Service sau Azure Container Apps?
- Folosim PostgreSQL in Azure sau alt hosting?
- Folosim Azure OpenAI sau initial doar reguli/Power Automate?
- Implementam UI custom Next.js sau incepem cu SharePoint List pentru aprobare?

## Recomandare curenta

Pentru inceput:

- Planner ca destinatie finala.
- Un singur folder Outlook dedicat.
- Meetinguri procesate doar la cerere.
- UI simplu custom sau SharePoint List, in functie de buget.
- Azure OpenAI doar daca exista disponibilitate clara in tenant/Azure.

