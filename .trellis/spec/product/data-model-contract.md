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
- Low-confidence corrections do not persist correction rows, update pattern count, or generate rewrite practice.

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

## Scenario: D+1 Rewrite Practice Today Slot

### 1. Scope / Trigger

- Trigger: Any task that changes saved-review rewrite task creation, Today journal snapshots, rewrite practice IPC, or rewrite task completion/skip persistence.
- v0.1 supports one due D+1 `rewrite_original` practice surfaced on Today; this is not the full rewrite queue.

### 2. Signatures

- DB table: `rewrite_tasks`
  - `native_model_sentence: text not null default ''`
  - `spaced_stage: text not null default 'D+1'`
  - `user_rewrite_text: text | null`
  - `completed_at: integer timestamp_ms | null`
  - `skipped_at: integer timestamp_ms | null`
- Today snapshot field:
  - `pendingRewritePractice: RewritePracticeSnapshot | null`
- `RewritePracticeSnapshot`:
  - `id`, `reviewRunId`, `originalSentence`, `focusPattern`, `nativeModelSentence`, `prompt`
  - `practiceKind: 'rewrite_original'`
  - `spacedStage: 'D+1'`
  - `status: pending | in_progress | completed | skipped | snoozed | expired`
  - `userRewriteText: string | null`
  - `dueAt: number | null`, `createdAt: number`, `isOlderThanSevenDays: boolean`
- IPC/API:
  - `journal.completeRewritePractice({ rewriteTaskId: string, userRewriteText: string }): RewritePracticeUpdateResult`
  - `journal.skipRewritePractice({ rewriteTaskId: string }): RewritePracticeUpdateResult`
  - `RewritePracticeUpdateResult = { success: boolean; journal?: TodayJournalSnapshot; rewritePractice?: RewritePracticeSnapshot | null; error?: string }`

### 3. Contracts

- `saveReviewRun` may create at most one pending rewrite task per saved review.
- The saved task must be `kind = 'rewrite_original'`, `spaced_stage = 'D+1'`, `status = 'pending'`, and `due_at = saved_at + 1 day`.
- The task must practice the single focus correction only. It must not be generated from a low-confidence correction or a non-focus correction.
- Today selects one pending due rewrite task where `kind = 'rewrite_original'`, `spaced_stage = 'D+1'`, `due_at <= now`, and `created_at >= now - 7 days`.
- Today rewrite practice must not block journal editing or autosave.
- The native model sentence stays hidden while the task is pending and is revealed only after the user submits a rewrite, or in a future flow that explicitly supports reveal.
- Completing a task stores trimmed `user_rewrite_text`, sets `status = 'completed'`, sets `completed_at`, returns a fresh Today snapshot, and still returns the completed `rewritePractice` so the renderer can reveal the native model after the pending slot is empty.
- Skipping a task sets `status = 'skipped'`, sets `skipped_at`, returns a fresh Today snapshot, and removes the card from the pending Today slot.
- All timestamp fields crossing IPC are Unix milliseconds numbers, not ISO strings.

### 4. Validation & Error Matrix

| Condition | Behavior |
| --- | --- |
| Save review has no D+1 `rewrite_original` operation | Save review succeeds without creating a rewrite task. |
| Rewrite operation references missing or low-confidence corrections | Do not create a rewrite task. |
| Rewrite operation does not reference the focus correction | Do not create a rewrite task. |
| Multiple D+1 rewrite operations exist | Create at most the first valid focus rewrite task. |
| Pending task is not due yet | Do not surface it in `pendingRewritePractice`. |
| Pending task is older than 7 days | Do not occupy the main Today rewrite slot. |
| Complete input has blank `userRewriteText` | Return `{ success: false, error }`; do not update the task. |
| Complete/skip task ID is missing | Return `{ success: false, error: 'Rewrite practice was not found.' }`. |
| Complete/skip task is already terminal | Return success with the current task snapshot and no duplicate status transition. |

### 5. Good/Base/Bad Cases

- Good: A saved valid review creates one D+1 focus rewrite task; next day Today shows it, journal writing still works, submitting reveals the native model and stores the trimmed rewrite.
- Base: The user skips the due practice; Today removes the card and still allows normal writing/review.
- Base: A task older than 7 days remains in storage/history but no longer occupies the main Today practice slot.
- Bad: A low-confidence or non-focus correction generates rewrite practice.
- Bad: The renderer derives the post-submit reveal card only from `journal.pendingRewritePractice`, so completion removes the card before the native model can be shown.
- Bad: Date fields return ISO strings over IPC or compare seconds to milliseconds.

### 6. Tests Required

- Save transaction test:
  - Assert saved review creates one pending `rewrite_original` task with `spacedStage = 'D+1'`, D+1 `dueAt`, focus original sentence, focus pattern, and native model sentence.
  - Assert multiple rewrite operations still create at most one task.
  - Assert low-confidence or non-focus referenced rewrite operations do not create tasks.
- Service test:
  - Assert Today returns one due pending D+1 task and excludes not-due, non-D+1, terminal, and older-than-7-days tasks.
  - Assert complete stores trimmed `userRewriteText`, sets `completedAt`, removes pending Today task, and returns completed `rewritePractice` for UI reveal.
  - Assert skip sets `skippedAt` and removes pending Today task.
- UI smoke/manual test:
  - Pending card shows original sentence, focus pattern, input, and Skip.
  - Native model is hidden before submit and visible after submit.
  - Journal editor remains editable/autosaves while the rewrite card is present.

### 7. Wrong vs Correct

#### Wrong

```typescript
if (result.success && result.journal) {
  setJournal(result.journal);
}

const practice = journal.pendingRewritePractice;
```

After completion, the fresh Today snapshot has no pending practice, so the UI loses the card before revealing the native model.

#### Correct

```typescript
if (result.success && result.journal && result.rewritePractice) {
  setJournal(result.journal);
  setCompletedRewritePractice(result.rewritePractice);
}

const practice = completedRewritePractice ?? journal.pendingRewritePractice;
```

The pending Today slot stays empty after completion, while the completed task remains available long enough to show the native model result.

## Scenario: Review Preview Payload and Save Boundary

### 1. Scope / Trigger

- Trigger: Any task that changes review preview rendering, review save IPC, persisted preview payload fields, or low-confidence correction handling.
- Preview is a cross-layer contract: validation harness -> `review_runs` preview payload columns -> main-process IPC -> renderer preview UI -> save transaction.

### 2. Signatures

- DB columns on `review_runs`:
  - `parsed_output_json: text | null` — validated `ReviewOutput` stored only for `review_ready` previews.
  - `preview_operations_json: text | null` — validated preview operations generated by the app-side validation harness.
- IPC/API:
  - `review.getPreview({ reviewRunId: string }): ReviewPreviewSnapshot | null`
  - `review.save({ reviewRunId: string, selfRepairAttemptText?: string, revealedWithoutAttempt?: boolean }): SaveReviewOutput`
- Save result:
  - `{ success: true, reviewRun: ReviewRunSnapshot, journal: TodayJournalSnapshot }`
  - `{ success: false, error: string }`

### 3. Contracts

- `getPreview` returns data only for `review_runs.status = "review_ready"` with both preview payload columns present.
- `ReviewPreviewSnapshot.reviewedContent` must come from `review_runs.journal_revision_id`, not the active editor text.
- `isStaleForCurrentJournal` compares the active journal revision hash with `review_runs.content_hash`.
- `saveReviewRun` consumes `preview_operations_json`; it must not re-derive persistence operations from renderer state.
- A correction is low confidence if either anchoring failed or the model returned `confidence: "low"`.
- Low-confidence corrections may appear in preview as `Other suggestions`, but save must not write them to `corrections`, update pattern counters, or create rewrite tasks from them.

### 4. Validation & Error Matrix

| Condition | Behavior |
| --- | --- |
| `getPreview` input fails schema | Return `null`; do not throw through IPC. |
| Review run missing, not `review_ready`, or missing preview payloads | Return `null`. |
| Focus correction missing, duplicated, or low confidence | `saveReviewRun` returns `{ success: false, error }`; transaction rolls back. |
| Review run already `review_saved` or `stale` | Return success without duplicating artifacts. |
| Active journal hash differs before save | Save historical artifacts as `stale`; do not replace `journal_entries.last_review_run_id`. |
| Insert/update fails mid-save | Roll back correction, self-repair, reference rewrite, rewrite task, run-status, and journal pointer writes. |

### 5. Good/Base/Bad Cases

- Good: `review_ready` run stores validated payloads, renderer shows reviewed-version highlights, user saves once, and artifacts are created exactly once.
- Base: `valid_with_warnings` preview contains low-confidence `Other suggestions`; save skips those rows and still saves anchored focus artifacts.
- Bad: Renderer submits derived corrections to save, causing divergence from harness-generated operations.
- Bad: Anchored `confidence: "low"` correction is saved as a normal correction because offsets exist.

### 6. Tests Required

- Validation harness test: `confidence: "low"` becomes `status: "low_confidence"` even when anchored.
- Save transaction test: first save creates correction/self-repair/reference/rewrite rows; repeated save creates no duplicates.
- Save rollback test: injected mid-transaction failure leaves no partial artifacts and keeps run status `review_ready`.
- Low-confidence test: low-confidence corrections are excluded from saved correction rows and rewrite tasks.
- Stale save test: hash-mismatched save marks the run `stale` and preserves the previous `journal_entries.last_review_run_id`.

### 7. Wrong vs Correct

#### Wrong

```typescript
const correctionsToSave = rendererPreview.corrections.filter((correction) => correction.startOffset !== null);
await window.api.review.save({ reviewRunId, corrections: correctionsToSave });
```

#### Correct

```typescript
await window.api.review.save({
  reviewRunId,
  selfRepairAttemptText,
  revealedWithoutAttempt,
});
```

The main process reads `review_runs.preview_operations_json` inside one transaction, so preview and save share the same validated contract.
