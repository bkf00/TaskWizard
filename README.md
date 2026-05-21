# Taskuri AI din Teams si Emailuri

Internal product for turning selected Microsoft Teams meeting notes/transcripts and Outlook emails into proposed operational tasks.

Core rule:

> AI proposes. A human approves. Microsoft Planner receives only validated tasks.

## Current Status

This repository contains:

- a dependency-free local MVP runner;
- a Next.js/TypeScript application skeleton;
- domain modules for ingestion, AI extraction, approval, audit and Planner sync;
- Microsoft Graph clients for auth, Planner and subscriptions;
- PostgreSQL/Drizzle schema for production;
- behavioral tests for the local MVP;
- architecture docs, ADRs, security policy and GitHub workflow templates.

The local MVP is runnable now with plain Node.js. The full Next.js app needs `npm` or `pnpm` available in PATH.

## Product Scope

MVP includes:

- manual source input for copied email, recap or transcript text;
- action-item extraction into proposed tasks;
- approval/rejection flow;
- controlled Planner sync path;
- audit events;
- processing errors;
- duplicate source detection.

MVP deliberately excludes:

- processing every Teams meeting automatically;
- creating Planner tasks without approval;
- microservices;
- storing real transcripts in GitHub;
- broad Graph permissions.

## Architecture

```text
Selected email / recap / transcript
  -> ingestion
  -> AI extraction
  -> proposed_tasks
  -> human approval
  -> Planner sync
  -> audit
```

Key packages:

- `packages/domain` - workflow and state transitions.
- `packages/ai` - Azure OpenAI extraction and local fallback.
- `packages/graph` - Microsoft Graph and Planner clients.
- `packages/storage` - local JSON storage for dependency-free MVP.
- `packages/db` - PostgreSQL/Drizzle production schema.
- `packages/audit` - audit event creation.

## Run Without npm

Useful on machines where Node exists but npm is not available:

```powershell
node .\tools\local-mvp-server.mjs
```

Open:

```text
http://localhost:3000
```

## Tests Without npm

```powershell
node .\tools\test-local-mvp.mjs
```

The test runner starts an isolated server on port `3197`, uses a temporary data directory, and covers:

- input validation;
- duplicate detection;
- task extraction;
- approval and rejection;
- safe Planner failure when not configured;
- HTML escaping;
- long meeting dialog extraction.

Latest local result:

```text
12 passed
0 failed
```

## GitHub Remote Setup

On Windows PowerShell, after installing Git and GitHub CLI:

```powershell
.\tools\setup-github-remote.ps1
git add .
git commit -m "chore: initial TaskWizard repository"
git push -u origin main
```

If using a GitHub token, set it only in the current shell:

```powershell
$env:GITHUB_TOKEN="your_token_here"
.\tools\setup-github-remote.ps1
```

## Full Next.js App

After `npm` or `pnpm` is available:

```powershell
npm install
npm run dev
npm run typecheck
npm run build
```

Create `.env.local` from `.env.example`.

## Documentation Map

- `pasi/` - project operating steps and impasse checklist.
- `implementare/` - implementation status, runbooks, tests and coverage notes.
- `docs/adr/` - architecture decision records.
- `SECURITY.md` - security and confidentiality policy.
- `ROADMAP.md` - staged delivery plan.
- `AGENT_NOTES.md` - Codex working journal.
- `CHANGELOG.md` - version history.

## Repository Discipline

Every meaningful change should:

1. keep human approval before Planner sync;
2. avoid committing real business data;
3. run `node tools/test-local-mvp.mjs`;
4. update docs when behavior changes;
5. update `CHANGELOG.md` or `AGENT_NOTES.md` when relevant.
