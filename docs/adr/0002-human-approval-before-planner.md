# ADR 0002 - Require Human Approval Before Planner Sync

Status: Accepted

Date: 2026-05-18

## Context

AI extraction can produce false positives, miss context, assign the wrong person, or infer deadlines that were not explicitly stated. For a small company, operational trust matters more than full automation.

## Decision

AI-generated tasks always start with status `proposed`. A human must approve or reject each task before it can be created in Microsoft Planner.

## Consequences

Positive:

- Prevents task noise in Planner.
- Keeps accountability with humans.
- Makes AI mistakes visible and correctable.
- Simplifies privacy review because processing is explicit.

Negative:

- Adds a manual review step.
- Some low-risk tasks are not fully automated.

## Revisit When

- Approval rate is consistently above 90%.
- Duplicate and false-positive rates are low.
- There is a clear class of tasks that can be safely auto-approved.

