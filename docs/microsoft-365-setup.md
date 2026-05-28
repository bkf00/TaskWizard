# Microsoft 365 Integration Setup

Milestone 2 foloseste un flux server-side cu Microsoft Entra ID application permissions pentru procesare autonoma:

```text
Outlook folder dedicat
  -> Graph webhook sau sync manual
  -> ingestie source email
  -> extractie taskuri propuse
  -> aprobare umana
  -> Planner task create
  -> Entra user lookup pentru assignment
```

## 1. App registration Entra ID

1. In Microsoft Entra admin center, creeaza o App registration pentru TaskWizard.
2. Noteaza:
   - Directory tenant ID
   - Application client ID
3. Creeaza un client secret pentru local/dev. Pentru productie, prefera certificate sau Key Vault.
4. Configureaza redirect URI pentru NextAuth:
   - local: `http://localhost:3000/api/auth/callback/microsoft-entra-id`
   - productie: `https://<host>/api/auth/callback/microsoft-entra-id`

Variabile:

```env
ENTRA_ID_TENANT_ID=
ENTRA_ID_CLIENT_ID=
ENTRA_ID_CLIENT_SECRET=
AUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
```

## 2. Graph API permissions

Adauga Microsoft Graph permissions si ruleaza **Grant admin consent**.

Application permissions pentru procesarea autonoma:

- `Mail.Read` - citire emailuri din folderul Outlook dedicat.
- `User.Read.All` - lookup email -> Entra user ID.
- `Group.ReadWrite.All` - acces Planner pentru planuri/buckets/taskuri asociate grupurilor Microsoft 365.
- `Tasks.ReadWrite.All` - creare si actualizare Planner tasks.

Delegated permissions pentru sign-in UI:

- `openid`
- `profile`
- `email`
- `offline_access`
- `User.Read`

Nota de securitate: pentru productie, limiteaza mailbox-ul la un folder dedicat si aplica restrictii Exchange/Application Access Policy unde este disponibil in tenant.

## 3. Folder Outlook dedicat

Configureaza un mailbox si un folder explicit pentru emailurile care pot fi procesate de TaskWizard.

```env
OUTLOOK_USER_ID=automation-mailbox@example.com
OUTLOOK_FOLDER_ID=<mailFolder-id>
```

Endpoint manual de sync:

```http
POST /api/graph/outlook/sync
Content-Type: application/json

{
  "top": 25,
  "maxPages": 5,
  "sinceDateTime": "2026-05-01T00:00:00Z"
}
```

Codul gestioneaza pagination prin `@odata.nextLink`, retry pentru statusuri temporare Graph (`429`, `5xx`) si deduplicare prin `externalId` / hash.

### Reguli locale de privacy

Adresele reale nu se pun in repository. Copiaza `config/privacy-rules.example.json` in `config/privacy-rules.local.json` si completeaza local:

```json
{
  "blockedSourceEmails": ["contact@example.com"],
  "privateSourceEmailOwners": [
    {
      "sourceEmails": ["user.private@example.com"],
      "visibleToEmails": ["user.private@example.com"]
    }
  ]
}
```

Comportament:

- `blockedSourceEmails` opreste complet ingestia din acei expeditori: emailul nu creeaza taskuri, iar textul brut nu este pastrat.
- `privateSourceEmailOwners` marcheaza taskurile ca private daca adresa apare ca expeditor sau participant; doar adresele din `visibleToEmails` le vad si pot actiona asupra lor.

Fisierul local este ignorat de Git prin `.gitignore`. Poti schimba locatia prin:

```env
TASKWIZARD_PRIVACY_RULES_FILE=config/privacy-rules.local.json
```

## 4. Graph subscriptions

Webhook:

```env
GRAPH_WEBHOOK_NOTIFICATION_URL=https://<host>/api/graph/webhook
GRAPH_LIFECYCLE_NOTIFICATION_URL=https://<host>/api/graph/webhook
GRAPH_WEBHOOK_CLIENT_STATE=<long-random-secret>
```

Creare subscription:

```http
POST /api/graph/subscriptions
```

Endpoint-ul `/api/graph/webhook` raspunde cu `validationToken` in text/plain pentru validarea Microsoft Graph si verifica `clientState` la notificari. Pentru lifecycle `reauthorizationRequired`, reinnoieste subscription-ul.

Important: Graph cere endpoint public HTTPS pentru webhook.

## 5. Planner test plan

Configureaza un plan si bucket de test:

```env
PLANNER_PLAN_ID=
PLANNER_BUCKET_ID=
```

Dupa aprobare, TaskWizard creeaza Planner task cu:

- titlu validat de om;
- due date, daca exista;
- descriere in Planner task details;
- assignment daca `assigneeEmail` poate fi mapat la Entra user ID.

## 6. Mapping email -> Entra user ID

`lookupEntraUserByEmail` cauta in Graph dupa `mail` sau `userPrincipalName`.

Rezultate gestionate:

- `found` - se foloseste user ID-ul pentru assignment Planner.
- `not_found` - taskul se creeaza fara assignment, dar auditul pastreaza statusul lookup-ului.
- `ambiguous` - taskul se creeaza fara assignment, iar auditul marcheaza ambiguitatea.

## Surse Microsoft folosite

- Client credentials flow: https://learn.microsoft.com/entra/identity-platform/v2-oauth2-client-creds-grant-flow
- Mail folder messages: https://learn.microsoft.com/graph/api/mailfolder-list-messages
- Change notifications/webhooks: https://learn.microsoft.com/graph/change-notifications-delivery-webhooks
- Planner task creation: https://learn.microsoft.com/graph/api/planner-post-tasks
- Permissions reference: https://learn.microsoft.com/graph/permissions-reference
