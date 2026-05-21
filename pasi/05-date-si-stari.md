# 05 - Date si stari

## Tabele minime

- `users`
- `roles`
- `source_items`
- `proposed_tasks`
- `planner_tasks`
- `audit_events`
- `graph_subscriptions`
- `system_settings`
- `processing_errors`

## `source_items`

Reprezinta o sursa procesata: email, transcript Teams sau recap manual.

Campuri importante:

- `id`
- `type`: `email`, `teams_transcript`, `manual_upload`
- `external_id`
- `source_hash`
- `subject`
- `from_email`
- `participants`
- `received_at`
- `raw_text_encrypted`
- `retention_until`
- `status`

Stari posibile:

- `received`
- `processing`
- `processed`
- `failed`
- `ignored_duplicate`

## `proposed_tasks`

Reprezinta taskurile propuse de AI.

Campuri importante:

- `id`
- `source_id`
- `title`
- `description`
- `assignee_email`
- `due_date`
- `project_hint`
- `confidence`
- `evidence`
- `status`
- `approved_by`
- `approved_at`
- `planner_task_id`

Stari posibile:

- `proposed`
- `approved`
- `rejected`
- `created_in_planner`
- `planner_sync_failed`

## Reguli de integritate

- Un `source_item` poate genera mai multe `proposed_tasks`.
- Un `proposed_task` aprobat poate crea cel mult un task Planner.
- Un task nu poate trece in `created_in_planner` fara `planner_task_id`.
- AI nu poate marca singur un task ca `approved`.

