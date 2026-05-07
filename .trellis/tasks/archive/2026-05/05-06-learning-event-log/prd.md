# Implement Learning Event Log Foundation

## Goal

Add a durable local learning event log that records the important state-changing moments in the review, rewrite, transfer, retry, skip, snooze, expiry, and pattern-maintenance loop. The first version is infrastructure for auditability and future import/export/debugging, not a learner-facing analytics surface.

## What I Already Know

- This is the next Horizon 2 item after pattern merge/de-dup and richer pattern lifecycle work.
- The roadmap says the app must keep months of local learning history understandable, portable, and trustworthy.
- The current learning loop already has delayed-transfer signals: D+1 repair, D+3 transfer, D+7 spaced reuse, rewrite-check outcomes, retry, skip, snooze, expiry, and pattern merge.
- `saveReviewRun` is the durable boundary for review-saved history and D+1 task creation.
- `completeRewritePractice`, `retryRewriteCheck`, `skipRewritePractice`, `snoozeRewritePractice`, `expireStaleRewritePractices`, and `maybeGenerateNextNewContextReuseTask` are the main rewrite lifecycle mutation points.
- `mergeErrorPatterns` is the durable pattern de-dup mutation point.
- Existing tests use fake Drizzle-like databases for service behavior; avoid new tests that require loading native `better-sqlite3` in memory.

## Assumptions

- The user's repeated `ok` and `继续` responses confirm continuing through the roadmap sequence with a conservative next slice.
- The first event-log slice should be append-only and local-first, with a read API for future UI/debugging, but no visible UI in this task.
- Event logging should be part of the same local transaction/mutation when practical. Logging failures should not be silently swallowed because missing audit data would make the local learning history less trustworthy.

## Requirements

- Add a `learning_events` SQLite table and Drizzle schema.
- Store timestamps as Unix milliseconds through Drizzle `timestamp_ms`.
- Store a unique nullable `dedupe_key` so repeated idempotent calls do not duplicate event rows.
- Store optional links to related durable entities:
  - `review_run_id`
  - `pattern_id`
  - `rewrite_task_id`
  - `rewrite_check_id`
- Store a JSON payload for small event-specific metadata. Payloads must not contain raw provider output, API keys, or full writing text.
- Add shared Zod schemas/types for learning events and a read output.
- Add a service helper to append learning events with consistent IDs, timestamps, dedupe behavior, JSON payload handling, and snapshot mapping.
- Add a read API that returns recent events sorted newest-first, with a bounded limit.
- Expose the read API through learning-assets IPC/preload types so future UI/export work can consume it.
- Record events at these mutation points:
  - review saved or saved-as-stale history
  - D+1 rewrite task created by review save
  - rewrite submitted or recovery-submitted
  - rewrite check attempt finished or retryable
  - retry requested for a saved rewrite
  - D+3/D+7 transfer task created after a correct check
  - skip rewrite practice
  - snooze rewrite practice
  - stale rewrite practice expired
  - pattern merged
- Do not log events for validation failures, missing IDs, no-op terminal calls, preview-only reviews, or read-only list operations.
- Preserve existing learning evidence semantics. Event rows are a history/audit log; Progress remains derived from durable patterns, tasks, and checks.

## Acceptance Criteria

- [ ] Migration `0011_learning_events.sql` is registered in Drizzle's journal and creates `learning_events` with event type, timestamp, dedupe key, related IDs, payload JSON, and creation timestamp.
- [ ] `src/main/db/schema.ts` exports `learningEvents` and select/insert types.
- [ ] Shared `learning-assets` types include a learning-event event-type enum, snapshot schema, and list output schema.
- [ ] A service-level append helper creates one event per logical state change and ignores duplicate `dedupe_key` inserts.
- [ ] `saveReviewRun` logs one review-save event and one D+1 task-created event when a task is actually created; repeated save calls do not add duplicates.
- [ ] `completeRewritePractice` logs submitted/recovery events, logs the resulting check attempt, and logs D+3/D+7 task creation only when a next task is actually inserted.
- [ ] `retryRewriteCheck` logs retry-requested and resulting check-attempt events only when retry evaluation runs.
- [ ] `skipRewritePractice`, `snoozeRewritePractice`, and expiry logic log events only when task status actually changes.
- [ ] `mergeErrorPatterns` logs one merge event after a successful merge; invalid or rejected merges do not log.
- [ ] The read API returns recent events newest-first with numeric timestamps and parsed payload objects.
- [ ] Tests cover schema/migration registration, review save logging/idempotency, rewrite lifecycle logging/idempotency, merge logging, and shared schema parsing.

## Definition Of Done

- Tests added or updated for changed behavior.
- `pnpm typecheck`, `pnpm lint`, and relevant Vitest targets pass.
- `pnpm test` is run if practical; if native-module constraints block a subset, report the exact limitation.
- Task validates through `task.py validate`.
- Specs are reviewed for whether the event-log contract should be captured.
- Work is committed in a code commit plus task-context commit before finish-work.

## Out Of Scope

- No visible event timeline UI.
- No analytics dashboard, score/streak system, or gamified mastery copy.
- No event replay engine.
- No import/export implementation.
- No local-backup implementation.
- No user-approved apply-correction revision flow.
- No raw writing text, provider raw output, or hidden fingerprint internals in public event snapshots.

## Technical Notes

- Relevant specs:
  - `.trellis/spec/product/roadmap.md`
  - `.trellis/spec/product/learning-flow.md`
  - `.trellis/spec/product/data-model-contract.md`
  - `.trellis/spec/product/validation-and-testing.md`
  - `.trellis/spec/backend/database.md`
  - `.trellis/spec/backend/type-safety.md`
  - `.trellis/spec/shared/timestamp.md`
- Relevant mutation files discovered during auto-context:
  - `src/main/services/review/procedures/save.ts`
  - `src/main/services/writing/service.ts`
  - `src/main/services/learning-assets/service.ts`
  - `src/main/db/schema.ts`
  - `src/main/ipc/handlers.ts`
  - `src/preload/index.ts`
  - `src/shared/constants/channels.ts`
  - `src/shared/types/learning-assets.ts`
- Use existing fake database patterns in `test/review-save.test.ts`, `test/rewrite-practice-service.test.ts`, and `test/learning-assets-merge.test.ts`.
- Event payloads should be minimal and structured, for example status/stage/kind/outcome/error state and source/target pattern IDs. They should not duplicate full source content already stored in durable tables.
