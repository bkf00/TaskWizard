# Harta cod

## UI si API

- `apps/web/app/page.tsx` - pagina principala.
- `apps/web/app/api/sources/manual/route.ts` - ingestie manuala.
- `apps/web/app/api/tasks/[taskId]/approve/route.ts` - aprobare task.
- `apps/web/app/api/tasks/[taskId]/reject/route.ts` - respingere task.
- `apps/web/app/api/graph/webhook/route.ts` - webhook Graph.

## Domeniu

- `packages/domain/src/types.ts` - tipuri centrale.
- `packages/domain/src/ids.ts` - ID-uri si hash sursa.
- `packages/domain/src/ingestion.ts` - flux sursa -> taskuri propuse.
- `packages/domain/src/approval.ts` - flux aprobare -> Planner.

## AI

- `packages/ai/src/extract-tasks.ts` - Azure OpenAI + fallback local.

## Microsoft Graph

- `packages/graph/src/auth.ts` - token app Graph.
- `packages/graph/src/planner.ts` - creare task Planner.
- `packages/graph/src/subscriptions.ts` - creare/reinnoire subscriptions.

## Date

- `packages/storage/src/local-store.ts` - storage local JSON.
- `packages/storage/src/repository.ts` - contractul de persistenta pentru JSON local si PostgreSQL viitor.
- `packages/db/src/schema.ts` - schema PostgreSQL/Drizzle.

## Audit si erori

- `packages/audit/src/audit.ts` - creare evenimente audit.
- Erorile sunt salvate prin `store.addProcessingError`.

## Workers

- `workers/subscription-renewal-worker/src/index.ts` - reinnoire subscriptions Graph.
