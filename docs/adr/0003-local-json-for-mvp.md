# ADR 0003 - Use Local JSON Storage for Dependency-Free MVP

Status: Accepted for MVP

Date: 2026-05-18

## Context

The current machine has Node.js available but `npm`, `pnpm`, `yarn` and `corepack` are not available in PATH. We still need a runnable MVP to validate product flow.

## Decision

Use `data/store.json` for the dependency-free local runner. Keep PostgreSQL/Drizzle schema in the repository as the production path.

## Consequences

Positive:

- The MVP runs immediately with plain Node.js.
- Tests can run without dependency installation.
- Product flow can be validated now.

Negative:

- Local JSON is not safe for concurrent production use.
- No transactional guarantees.
- No query/index performance for real volume.

## Revisit When

- `npm`/`pnpm` is available.
- PostgreSQL is configured.
- Entra ID and Graph integration begin.

