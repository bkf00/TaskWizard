# 06 - Securitate si confidentialitate

## Principii

- Procesare explicita, nu supraveghere generala.
- Acces minim necesar.
- AI propune, omul decide.
- Datele brute se pastreaza doar cat este necesar.
- Fiecare actiune importanta este auditata.

## Autentificare

- Login prin Microsoft Entra ID.
- Acces doar pentru utilizatorii companiei.
- Roluri minime:
  - `admin`
  - `approver`
  - `viewer`

## Permisiuni Microsoft Graph

Se folosesc cele mai mici permisiuni care permit:

- citirea folderului Outlook selectat;
- citirea transcripturilor Teams selectate, daca este posibil;
- crearea taskurilor in Planner;
- citirea utilizatorilor pentru asignare.

Permisiunile trebuie revizuite inainte de productie.

## Criptare

- Conexiune DB prin TLS.
- Date at-rest criptate in PostgreSQL/Azure.
- Secrete in Azure Key Vault.
- Textul brut al surselor poate fi criptat aplicativ daca sensibilitatea o cere.

## Retention

Recomandare initiala:

- surse brute: 30-90 zile;
- audit: termen mai lung, dar fara text brut complet daca nu este necesar;
- taskuri aprobate: pastrate operational in Planner si in sistem.

## Informare interna

Utilizatorii trebuie sa stie ca:

- emailurile mutate in folderul dedicat pot fi procesate de AI;
- transcripturile/recap-urile incarcate pot fi procesate de AI;
- taskurile nu sunt create automat fara aprobare.

