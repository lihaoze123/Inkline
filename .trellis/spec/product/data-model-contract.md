# Data Model Contract

## Content Revision Contract

Corrections are anchored to the reviewed content version, not necessarily the current editor content.

- `journal_entries` represents a journal identity and points to the active revision.
- `journal_revisions` stores versioned text.
- `review_runs.input_snapshot_json` must contain the complete normalized journal content used for review.
- `corrections.start_offset` and `corrections.end_offset` are relative to the content version identified by `review_runs.content_hash`.
- Editing the active journal revision makes old reviews stale but does not delete them.
- Accepting corrections is out of scope for v0.1; future apply-correction behavior must create a new user-approved revision and never mutate historical snapshots.

## v0.1 Required Tables

```text
journal_entries
journal_revisions
review_runs
corrections
self_repair_attempts
reference_rewrites
rewrite_tasks
```

v0.1 may keep fields needed by later revisions, but it must not expose v0.2 workflows unless the task requires them.

## Status Enums

Review run status:

```text
draft
reviewing
review_ready
review_saved
review_failed
stale
discarded
```

Review validation status:

```text
valid
valid_with_warnings
invalid
```

Correction status:

```text
suggested
kept
dismissed
stale
low_confidence
```

v0.1 does not use `accepted` because Apply correction is not implemented.

Rewrite status:

```text
pending
in_progress
completed
skipped
snoozed
expired
```

Self-repair result:

```text
correct
partly_correct
incorrect
skipped
revealed_without_attempt
```

Rewrite practice kind:

```text
rewrite_original
new_context_reuse
pattern_detection
```

v0.1 only requires `rewrite_original` with `D+1`.

## Review State Rules

- User clicking Review creates or transitions a run to `reviewing`.
- Validated agent output transitions to `review_ready`.
- User saving transitions to `review_saved`.
- Agent failure or invalid schema transitions to `review_failed`.
- Editing the active journal revision marks the old active review as `stale`.
- Discarding preview transitions to `discarded`.
- `journal_entries.last_review_run_id` is the current active saved review pointer. Do not add a separate `review_runs.is_active` flag.

## Validation Levels

`valid`:

- Schema passes.
- Pattern references exist.
- Most correction anchors succeed.
- Low-confidence corrections are below the threshold.

`valid_with_warnings`:

- Schema passes.
- Some corrections cannot be anchored.
- Preview and save are allowed.
- Low-confidence corrections do not update pattern count or generate rewrite practice.

`invalid`:

- Schema fails.
- Pattern references do not exist.
- Many corrections cannot be anchored.
- Rewrite tasks reference missing correction/pattern indexes.
- Agent mixes upgrade opportunities into corrections.

Invalid output must not update learning history.

## Save Review Transaction

`saveReviewRun(reviewRunId: string)` is atomic and idempotent.

Transaction order:

```text
1. Confirm review_run is review_ready.
2. Confirm current journal hash matches, or save as historical stale review if allowed.
3. Write what_went_well, focus_pattern, and input_bridge snapshots.
4. Write corrections with exactly one focus correction.
5. Write self_repair_attempts.
6. Write reference_rewrites.
7. Write rewrite_tasks.
8. Reuse or create error_patterns if the current version requires them.
9. Update pattern counters and mastery fields only after save.
10. Preserve old active review as history.
11. Mark current run review_saved.
12. Update journal_entries.last_review_run_id and reviewed_at.
```

Failure rolls back the entire transaction.

Idempotency:

- A review run can move from `review_ready` to `review_saved` only once.
- Repeating `saveReviewRun` must not duplicate pattern counts, rewrite tasks, reference rewrites, or self-repair attempts.
- Preview-stage data must not change long-term statistics.

## Pattern Rules

- Pattern reuse is preferred over creating near-duplicate patterns.
- Agents cannot generate final pattern IDs.
- New pattern suggestions provide only category, rule, and canonical example.
- The client generates a normalized `pattern_key`, searches for similar active patterns, and generates final snake_case IDs only after de-dup.
- `unique(pattern_key)` is required. De-dup cannot rely on application logic alone.
- Do not send all patterns to the review agent. v0.1 limit is 30.
- Default pattern selection excludes spelling.

Pattern merge is v0.2+. Historical corrections keep original pattern IDs, and display follows `merged_into_pattern_id` only when merge exists.
