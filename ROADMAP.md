# Roadmap

## Milestone 0 - Repository professional

- [x] Structura MVP.
- [x] Test runner local.
- [x] Documentatie de arhitectura.
- [x] Templates GitHub.
- [x] CI pregatit.

## Milestone 1 - MVP local utilizabil

- [x] Ingestie manuala.
- [x] Extractie fallback.
- [x] Aprobare/respingere.
- [x] Audit si erori.
- [x] Editare task inainte de aprobare.
- [x] Autentificare mock/local pentru actor real.
- [x] Ecran dedicat "Toate taskurile" cu filtre pe status.
- [x] Formular simplificat pentru paste email `.eml` / Outlook.
- [x] Persistenta pregatita pentru migrare de la JSON la repository interface.

## Milestone 2 - Microsoft 365 integration

- [x] Entra ID auth.
- [x] Configurare Graph app registration.
- [x] Citire folder Outlook dedicat.
- [x] Creare subscriptions Graph.
- [x] Creare taskuri Planner intr-un plan de test.
- [x] Mapping email -> Entra user ID.
- [ ] Validare cu tenant real si folder Outlook real.
- [ ] Hardening productie: certificate/Key Vault si Application Access Policy pentru mailbox.

## Milestone 3 - Production foundation

- [ ] PostgreSQL/Drizzle repository.
- [ ] Azure Key Vault.
- [ ] Terraform pentru Azure.
- [ ] Observability si backup.
- [ ] Politica retention implementata.

## Milestone 4 - Quality and intelligence

- [ ] Provider AI configurabil: `fallback` / `ollama`.
- [ ] Teste cu 3 emailuri si 1 transcript folosind provider AI local.
- [ ] Azure OpenAI configurat ca optiune platita, doar daca Ollama/local AI nu este suficient.
- [ ] Teste Playwright UI.
- [ ] Coverage instrumentat minimum 80% pe module critice.
- [ ] Teste cu dialoguri romanesti reale.
- [ ] Deduplicare cu `pgvector`.
- [ ] Clasificare pe proiect/client.
