# ADR 0001 - Use a Modular Monolith

Status: Accepted

Date: 2026-05-18

## Context

The company has about 8 employees. The product must automate task proposal from Teams meetings and Outlook email without adding heavy operational burden.

Microservices would introduce multiple deployments, distributed tracing, service-to-service auth, versioned contracts and more infrastructure than the current scale justifies.

## Decision

Use a TypeScript modular monolith with clear package boundaries:

- `domain`
- `ai`
- `graph`
- `storage`
- `audit`
- `queue`
- `db`

Workers may run separately later, but they share the same domain contracts.

## Consequences

Positive:

- Faster delivery for MVP.
- Easier debugging.
- Lower operational complexity.
- Natural path to extract workers later.

Negative:

- Requires discipline to keep modules clean.
- Scaling is mostly vertical/asynchronous until modules are extracted.

## Revisit When

- The system processes enough volume that AI extraction or Graph sync needs independent scaling.
- Multiple teams need independent deployment ownership.
- Worker failures regularly impact the web app.

