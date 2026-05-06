# Learning Event Log Technical Plan

## Converged Design

The event log is an append-only local audit trail over durable learning mutations. It should explain what happened without becoming the source of truth for Progress.

Recommended schema shape:

```text
learning_events
  id text primary key
  event_type text not null
  occurred_at integer timestamp_ms not null
  dedupe_key text unique null
  review_run_id text null references review_runs(id) on delete set null
  pattern_id text null references error_patterns(id) on delete set null
  rewrite_task_id text null references rewrite_tasks(id) on delete set null
  rewrite_check_id text null references rewrite_checks(id) on delete set null
  payload_json text not null default '{}'
  created_at integer timestamp_ms not null default (unixepoch() * 1000)
```

Use `on delete set null` for parent links so historical events can remain readable if a future cleanup deletes a parent row.

## Event Types

Minimum event type set for this task:

- `review_saved`
- `rewrite_task_created`
- `rewrite_submitted`
- `rewrite_check_recorded`
- `rewrite_retry_requested`
- `rewrite_skipped`
- `rewrite_snoozed`
- `rewrite_expired`
- `pattern_merged`

Do not add `mastery_*` event types yet because current specs explicitly avoid mastered claims until delayed transfer data justifies that vocabulary.

## Dedupe Keys

Suggested key examples:

- `review_saved:<reviewRunId>:<finalStatus>`
- `rewrite_task_created:<rewriteTaskId>`
- `rewrite_submitted:<rewriteTaskId>:<completedAtMillis>`
- `rewrite_check_recorded:<rewriteCheckId>`
- `rewrite_retry_requested:<rewriteTaskId>:<startedAtMillis or checkId>`
- `rewrite_skipped:<rewriteTaskId>`
- `rewrite_snoozed:<rewriteTaskId>:<dueAtMillis>`
- `rewrite_expired:<rewriteTaskId>`
- `pattern_merged:<sourcePatternId>:<targetPatternId>`

Prefer keys tied to inserted row IDs or final mutation timestamps. Avoid keys based only on user input text.

## Payload Policy

Payloads may include compact metadata:

- task kind and spaced stage
- previous and new task status
- rewrite-check status/outcome
- whether the review was saved as stale history
- merge source/target IDs
- next-stage task reason

Payloads must not include:

- full writing content
- raw provider output
- API keys or provider credentials
- hidden pattern fingerprint internals

## API

Expose a read-only learning-assets API:

```ts
window.api.learningAssets.listLearningEvents(): Promise<ListLearningEventsOutput>
```

Return recent events newest-first, with all timestamp fields as Unix millisecond numbers and `payload` parsed as `Record<string, unknown>`.

## Testing Focus

- Migration and Drizzle journal registration.
- Shared Zod schema rejects malformed completed output.
- Service helper dedupes duplicate keys.
- Review save creates events once across repeated saves.
- Rewrite submit/retry/skip/snooze/expiry creates events only on actual mutations.
- Pattern merge creates an event only on successful merge.

