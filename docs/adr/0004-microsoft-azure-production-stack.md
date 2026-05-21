# ADR 0004 - Prefer Microsoft Azure for Production

Status: Accepted

Date: 2026-05-18

## Context

The product integrates with Microsoft 365: Teams, Outlook, Planner, Entra ID and Microsoft Graph. The company already works inside this ecosystem.

## Decision

Use Azure as the default production platform:

- Microsoft Entra ID for auth.
- Microsoft Graph for integrations.
- Azure OpenAI for AI extraction.
- Azure Key Vault for secrets.
- PostgreSQL Flexible Server for data.
- Azure Service Bus for async processing.
- Azure App Service or Azure Container Apps for hosting.

## Consequences

Positive:

- Better fit with Microsoft identity and compliance.
- Cleaner access model for Graph and Planner.
- Fewer cross-cloud security questions.

Negative:

- Azure setup is required.
- Some services may need additional licensing or subscription configuration.

## Revisit When

- The company already standardizes on a different cloud.
- Azure OpenAI is unavailable in the required region.
- Cost or governance constraints make Azure unsuitable.

