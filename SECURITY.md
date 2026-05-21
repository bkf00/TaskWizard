# Security Policy

## Scope

Acest proiect proceseaza emailuri, recap-uri si transcripturi care pot contine date confidentiale. Orice schimbare trebuie tratata ca security-sensitive.

## Principii obligatorii

- Procesare explicita, nu supraveghere generala.
- Least privilege pentru Microsoft Graph.
- Secrete doar in `.env.local`, Azure Key Vault sau GitHub Secrets.
- Fara commit de transcripturi reale, emailuri reale sau date personale.
- Fara taskuri create direct in Planner fara pas de aprobare.
- Audit pentru ingestie, extractie, aprobare si sincronizare Planner.

## Raportare vulnerabilitati

Pentru moment, raporteaza direct catre administratorul intern al proiectului. Nu deschide issue public cu secrete, tokenuri, transcripturi sau date de client.

## Checklist inainte de productie

- Entra ID activ pe toate rutele.
- Graph permissions revizuite.
- Retention configurata.
- PostgreSQL cu TLS.
- Secrete mutate in Key Vault/GitHub Secrets.
- Teste cu tenant Microsoft de test.
- Backup si restore documentate.

