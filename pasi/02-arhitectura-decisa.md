# 02 - Arhitectura decisa

## Prioritati

1. Securitate
2. Scalabilitate controlata

Latenta este secundara. Este acceptabil ca taskurile propuse sa apara dupa 30-90 secunde.

## Alegere principala

Se foloseste un modular monolith, nu microservicii.

## Stack recomandat

- Limbaj: TypeScript
- UI si API intern: Next.js
- Autentificare: Microsoft Entra ID prin Auth.js / NextAuth
- Baza de date: PostgreSQL
- Similaritate si duplicate: `pgvector`
- Queue: Azure Service Bus
- AI: Azure OpenAI
- Integrare Microsoft: Microsoft Graph API
- Destinatie taskuri: Microsoft Planner
- Hosting: Azure App Service sau Azure Container Apps
- Infrastructure as Code: Terraform

## De ce Azure

Firma este deja in ecosistemul Microsoft 365. Azure se potriveste mai bine pentru:

- Entra ID;
- Graph API;
- audit si compliance;
- Key Vault;
- conectare naturala cu Planner, Teams si Outlook.

## De ce nu microservicii

Pentru 8 angajati, microserviciile adauga mai multa complexitate decat valoare:

- mai multe deploy-uri;
- debugging mai dificil;
- monitorizare mai grea;
- cost operational mai mare.

Workerii asincroni sunt suficienti pentru scalare.

