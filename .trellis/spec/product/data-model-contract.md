# Data Model Contract

## Content Revision Contract

Corrections are anchored to the reviewed writing content version, not necessarily the current editor content.

- `writing_attempts` represents one current practice attempt for a `(date_key, template_id)` pair and points to the active revision.
- `writing_revisions` stores versioned writing text.
- `review_runs.input_snapshot_json` must contain the complete normalized `writingContent` used for review.
- `corrections.start_offset` and `corrections.end_offset` are relative to the content version identified by `review_runs.content_hash`.
- Editing the active writing revision makes old reviews stale but does not delete them.
- Accepting corrections is out of scope for v0.1; future apply-correction behavior must create a new user-approved revision and never mutate historical snapshots.

## Required Tables

```text
writing_attempts
writing_revisions
review_runs
corrections
self_repair_attempts
reference_rewrites
rewrite_tasks
rewrite_checks
error_patterns
notebook_entries
```

The app may keep fields needed by later revisions, but it must not expose future workflows unless the task requires them.

## Scenario: Writing Attempt, Template, and Starter Prompt Contract

### 1. Scope / Trigger

- Trigger: Any task that changes practice templates, current draft loading, autosave, starter prompt generation, writing IPC, or `writing_attempts` / `writing_revisions` schema.
- This is a cross-layer contract: Practice UI -> preload `window.api.writing` -> main-process writing service -> SQLite tables -> review service.

### 2. Signatures

Shared template IDs:

```ts
type WritingTemplateId = 'journal' | 'cet4' | 'cet6' | 'free';
```

DB tables:

```text
writing_attempts(
  id text primary key,
  date_key text not null,
  template_id text not null default 'journal',
  generated_prompt_json text null,
  user_goal text null,
  active_revision_id text null,
  last_review_run_id text null,
  reviewed_at integer timestamp_ms null,
  created_at integer timestamp_ms not null,
  updated_at integer timestamp_ms not null,
  unique(date_key, template_id)
)

writing_revisions(
  id text primary key,
  writing_attempt_id text not null references writing_attempts(id) on delete cascade,
  content text not null,
  content_hash text not null,
  created_at integer timestamp_ms not null
)
```

Preload API:

```ts
window.api.writing.getCurrentAttempt(): Promise<WritingAttemptSnapshot>;
window.api.writing.getWritingAttempt(input: { templateId: WritingTemplateId }): Promise<WritingAttemptSnapshot>;
window.api.writing.saveWritingAttempt(input: SaveWritingAttemptInput): Promise<SaveWritingAttemptResult>;
window.api.writing.generateStarterPrompt(input: GenerateStarterPromptInput): Promise<GenerateStarterPromptResult>;
window.api.writing.acknowledgeStarterPromptDisclosure(input: { acknowledged: true }): Promise<boolean>;
```

IPC channels:

```ts
IPC_CHANNELS.WRITING.GET_CURRENT_ATTEMPT = 'practice:getCurrentAttempt';
IPC_CHANNELS.WRITING.GET_WRITING_ATTEMPT = 'practice:getWritingAttempt';
IPC_CHANNELS.WRITING.SAVE_WRITING_ATTEMPT = 'practice:saveWritingAttempt';
IPC_CHANNELS.WRITING.GENERATE_STARTER_PROMPT = 'practice:generateStarterPrompt';
IPC_CHANNELS.WRITING.ACKNOWLEDGE_STARTER_PROMPT_DISCLOSURE = 'practice:acknowledgeStarterPromptDisclosure';
```

Snapshot shape:

```ts
type WritingAttemptSnapshot = {
  attemptId: string;
  dateKey: string;
  templateId: WritingTemplateId;
  template: WritingTemplate;
  generatedPrompt: { text: string; generatedAt: number } | null;
  userGoal: string | null;
  activeRevision: WritingRevisionSnapshot | null;
  lastAutosaveAt: number | null;
  lastReviewRunId: string | null;
  staleReview: StaleReviewSnapshot | null;
  pendingRewritePractice: RewritePracticeSnapshot | null;
};

type SaveWritingAttemptInput = {
  templateId: WritingTemplateId;
  content: string;
  userGoal?: string;
};

type SaveWritingAttemptResult = WritingAttemptSnapshot & { saved: boolean };

type GenerateStarterPromptInput = {
  templateId: WritingTemplateId;
  userGoal?: string;
};

type GenerateStarterPromptResult = {
  success: boolean;
  writing?: WritingAttemptSnapshot;
  starterPrompt?: { text: string; generatedAt: number };
  disclosureRequired?: boolean;
  error?: string;
};
```

### 3. Contracts

- `getCurrentAttempt()` returns the default Journal template attempt for today. Template switching must call `getWritingAttempt({ templateId })`.
- The app preserves one current draft per template through `unique(date_key, template_id)`.
- Saving a writing attempt normalizes content, computes `content_hash`, inserts a new `writing_revisions` row only when content changes, and updates `writing_attempts.active_revision_id`.
- Updating only `userGoal` does not need a new revision, but it must update `writing_attempts.user_goal`.
- `generated_prompt_json` stores `{ text, generatedAt }` only after successful starter generation.
- Starter prompt generation sends selected template metadata and optional `userGoal`; it must not send `content` or any writing revision text.
- CET-4 and CET-6 starter prompts/topics must be in English. Chinese helper copy is allowed around the topic.
- Starter prompt generation requires one-time starter disclosure acknowledgement before the provider call.
- Development-stage schema rebuild is allowed for this pre-production app; do not present these migrations as production-safe preservation of old journal data.
- All timestamp fields crossing IPC are Unix milliseconds numbers, not ISO strings.

### 4. Validation & Error Matrix

| Condition | Behavior |
| --- | --- |
| Unknown `templateId` at IPC boundary | Reject via Zod enum validation. |
| Saving unchanged normalized content | Return `saved: false`; preserve current active revision. |
| Saving changed normalized content | Insert a new revision, update active revision, mark saved review stale if content hash differs. |
| `userGoal` is blank or whitespace | Persist `null`. |
| Starter disclosure missing | Return `{ success: false, disclosureRequired: true, error }`; do not call provider. |
| Provider base URL/model/key missing | Return `{ success: false, error }`; do not create a starter prompt. |
| Provider timeout | Return `{ success: false, error: 'Starter prompt request timed out.' }`. |
| Provider response is not JSON `{ "prompt": string }` | Return `{ success: false, error }`; do not persist `generated_prompt_json`. |
| Prompt generation succeeds | Persist `generated_prompt_json` and normalized `user_goal`; return fresh `writing`. |

### 5. Good/Base/Bad Cases

- Good: User selects CET-4, generates a topic after disclosure, writes independently, autosaves a CET-4 revision, reviews with CET-4 context, then switches back to Journal and sees the separate Journal draft.
- Base: User skips generation, types an optional goal/topic, writes, and review input includes the goal but no generated prompt.
- Base: User regenerates before writing; the latest generated prompt replaces `generated_prompt_json` on the current template attempt.
- Bad: All templates share one active draft keyed only by date.
- Bad: Starter generation includes essay content or active revision text.
- Bad: Review/save refreshes the default Journal attempt after acting on CET-4, CET-6, or Free Writing.

### 6. Tests Required

- Service test: one attempt per `(dateKey, templateId)` and switching templates preserves separate active revisions.
- Service test: unchanged save returns `saved: false`; changed save creates a new writing revision and updates content hash.
- Starter prompt test: disclosure-required response prevents provider call; successful generation persists prompt and user goal; malformed provider JSON returns error without persistence.
- Privacy test: starter prompt provider request contains template/userGoal only and excludes writing content.
- Cross-template review test: review completion and save return the same template's `WritingAttemptSnapshot`, not the default Journal snapshot.
- IPC/schema test: all public writing responses pass shared Zod schemas and timestamps are numbers.

### 7. Wrong vs Correct

#### Wrong

```ts
await window.api.writing.generateStarterPrompt({
  templateId,
  userGoal,
  content: currentDraft,
});

const writing = await window.api.writing.getCurrentAttempt();
```

This leaks essay content to the starter prompt provider and refreshes the default Journal attempt after a non-Journal action.

#### Correct

```ts
const result = await window.api.writing.generateStarterPrompt({ templateId, userGoal });

const writing = await window.api.writing.getWritingAttempt({ templateId: result.writing.templateId });
```

Starter generation is pre-writing context only, and every post-action refresh stays bound to the selected template.

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

Rewrite check status:

```text
pending
in_progress
completed
failed
retryable
```

Rewrite check outcome:

```text
correct
partly_correct
incorrect
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
- Editing the active writing revision marks the old active review as `stale`.
- Discarding preview transitions to `discarded`.
- `writing_attempts.last_review_run_id` is the current active saved review pointer for that attempt. Do not add a separate `review_runs.is_active` flag.

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

`saveReviewRun(input: { reviewRunId: string; selfRepairAttemptText?: string; revealedWithoutAttempt?: boolean })` is atomic and idempotent.

Transaction order:

```text
1. Confirm review_run is review_ready.
2. Confirm current writing hash matches, or save as historical stale review if allowed.
3. Read preview operations from review_runs.preview_operations_json.
4. Write corrections with exactly one focus correction.
5. Write self_repair_attempts.
6. Write reference_rewrites.
7. Write rewrite_tasks.
8. Mark current run review_saved or stale.
9. Update writing_attempts.last_review_run_id and reviewed_at only for non-stale saves.
10. Return the WritingAttemptSnapshot for the reviewed run's template.
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
- `unique(pattern_key)` is required when error-pattern persistence exists. De-dup cannot rely on application logic alone.
- Do not send all patterns to the review agent. v0.1 limit is 30.
- Default pattern selection excludes spelling.

Pattern merge is v0.2+. Historical corrections keep original pattern IDs, and display follows `merged_into_pattern_id` only when merge exists.

## Scenario: Learning Assets Persistence

### 1. Scope / Trigger

- Trigger: Any task that changes `error_patterns`, `notebook_entries`, review input pattern selection, review save persistence, or Notebook/Progress IPC.
- This is a cross-layer contract: validated review operations -> save transaction -> SQLite learning assets -> preload IPC -> renderer queries -> Notebook/Progress UI.

### 2. Signatures

DB tables:

```text
error_patterns(
  id text primary key,
  pattern_key text not null unique,
  category text not null,
  rule text not null,
  canonical_example text not null,
  count integer not null default 0,
  first_seen_date_key text not null,
  last_seen_date_key text not null,
  recent_examples_json text not null default '[]',
  active integer boolean not null default true,
  created_at integer timestamp_ms not null,
  updated_at integer timestamp_ms not null
)

corrections.pattern_id text null references error_patterns(id) on delete set null

notebook_entries(
  id text primary key,
  review_run_id text not null references review_runs(id) on delete cascade,
  date_key text not null,
  template_id text not null,
  source_text text not null,
  suggested_alternatives_json text not null,
  reason text null,
  created_at integer timestamp_ms not null
)
```

Preload API:

```ts
window.api.learningAssets.listErrorPatterns(): Promise<ErrorPatternSnapshot[]>;
window.api.learningAssets.listNotebookEntries(): Promise<NotebookEntrySnapshot[]>;
```

### 3. Contracts

- `validateReviewResult` produces preview-only `patternOperations` and `upgradeOpportunities`; every operation must keep `updatesLongTermStats: false`.
- `saveReviewRun` is the only place that turns preview learning operations into durable learning assets.
- Saving a matched pattern increments `error_patterns.count`, updates `last_seen_date_key`, prepends the recent example, and links the saved correction through `corrections.pattern_id`.
- Saving a new pattern suggestion normalizes `pattern_key`, checks exact-key and same-category rule similarity, and reuses an existing similar pattern before inserting.
- `selectActiveReviewPatterns` reads active non-spelling `error_patterns`, sorts by count and recency, and respects `existingPatternsLimit`.
- Upgrade opportunities must store the reviewed source phrase, 1-3 suggested alternatives, optional reason, date key, template, and review run ID.
- Invalid review output and unsaved review previews must not update `error_patterns`, `notebook_entries`, or correction links.

### 4. Validation & Error Matrix

| Condition | Behavior |
| --- | --- |
| `matchedPatternId` not found during save | Roll back save transaction and return an error. |
| New suggestion has a duplicate `pattern_key` | Reuse the existing pattern and increment it. |
| New suggestion is same-category and rule-similar to an existing pattern | Reuse the existing pattern and increment it. |
| Upgrade `sourceText` is not in reviewed writing | Validation is invalid; save never receives notebook operation. |
| Save transaction fails after pattern/notebook writes begin | Roll back all review save side effects. |

### 5. Good/Base/Bad Cases

- Good: A saved review reuses `tense_past_narrative`, increments its count, links the correction, and shows the pattern in Progress.
- Good: A valid upgrade for `very good` persists as a Notebook entry only when `very good` appears in the reviewed writing.
- Base: A spelling correction can persist as a correction without becoming an active review pattern.
- Bad: Future review input is built from recent correction row IDs instead of semantic `error_patterns`.
- Bad: A review preview updates counts before the user explicitly saves.

### 6. Tests Required

- Save-review test: matched pattern increments once and repeated save remains idempotent.
- Save-review test: new pattern suggestion creates one semantic pattern and links the correction.
- Save-review test: near-duplicate same-category rule reuses an existing pattern.
- Validation test: upgrade source must appear in writing content.
- Validation test: upgrade cap violations return invalid and empty operations.
- Service/API test: active review patterns exclude spelling and respect the cap.

### 7. Wrong vs Correct

#### Wrong

```ts
const existingPatterns = db.select().from(corrections).all();
```

This treats individual corrections as reusable patterns, which creates unstable IDs and noisy future review input.

#### Correct

```ts
const existingPatterns = selectActiveReviewPatterns(db, existingPatternsLimit);
```

Future review input comes from the semantic pattern archive owned by the app.

## Scenario: D+1 Rewrite Practice Slot

### 1. Scope / Trigger

- Trigger: Any task that changes saved-review rewrite task creation, `WritingAttemptSnapshot.pendingRewritePractice`, rewrite practice IPC, or rewrite task completion/skip persistence.
- v0.1 supports one due D+1 `rewrite_original` practice surfaced in Practice; this is not the full rewrite queue.

### 2. Signatures

- DB table: `rewrite_tasks`
  - `native_model_sentence: text not null default ''`
  - `spaced_stage: text not null default 'D+1'`
  - `user_rewrite_text: text | null`
  - `completed_at: integer timestamp_ms | null`
  - `skipped_at: integer timestamp_ms | null`
- Writing snapshot field:
  - `pendingRewritePractice: RewritePracticeSnapshot | null`
- `RewritePracticeSnapshot`:
  - `id`, `reviewRunId`, `originalSentence`, `focusPattern`, `nativeModelSentence`, `prompt`
  - `practiceKind: 'rewrite_original'`
  - `spacedStage: 'D+1'`
  - `status: pending | in_progress | completed | skipped | snoozed | expired`
  - `userRewriteText: string | null`
  - `dueAt: number | null`, `createdAt: number`, `isOlderThanSevenDays: boolean`
- IPC/API:
  - `window.api.writing.completeRewritePractice({ rewriteTaskId: string, userRewriteText: string }): RewritePracticeUpdateResult`
  - `window.api.writing.skipRewritePractice({ rewriteTaskId: string }): RewritePracticeUpdateResult`
  - `RewritePracticeUpdateResult = { success: boolean; writing?: WritingAttemptSnapshot; rewritePractice?: RewritePracticeSnapshot | null; error?: string }`

### 3. Contracts

- `saveReviewRun` may create at most one pending rewrite task per saved review.
- The saved task must be `kind = 'rewrite_original'`, `spaced_stage = 'D+1'`, `status = 'pending'`, and `due_at = saved_at + 1 day`.
- The task must practice the single focus correction only. It must not be generated from a low-confidence correction or a non-focus correction.
- Practice selects one pending due rewrite task where `kind = 'rewrite_original'`, `spaced_stage = 'D+1'`, `due_at <= now`, and `created_at >= now - 7 days`.
- Rewrite practice must not block writing editor use or autosave.
- The native model sentence stays hidden while the task is pending and is revealed only after the user submits a rewrite, or in a future flow that explicitly supports reveal.
- Completing a task stores trimmed `user_rewrite_text`, sets `status = 'completed'`, sets `completed_at`, returns a fresh writing snapshot, and still returns the completed `rewritePractice` so the renderer can reveal the native model after the pending slot is empty.
- Skipping a task sets `status = 'skipped'`, sets `skipped_at`, returns a fresh writing snapshot, and removes the card from the pending Practice slot.
- All timestamp fields crossing IPC are Unix milliseconds numbers, not ISO strings.

### 4. Validation & Error Matrix

| Condition | Behavior |
| --- | --- |
| Save review has no D+1 `rewrite_original` operation | Save review succeeds without creating a rewrite task. |
| Rewrite operation references missing or low-confidence corrections | Do not create a rewrite task. |
| Rewrite operation does not reference the focus correction | Do not create a rewrite task. |
| Multiple D+1 rewrite operations exist | Create at most the first valid focus rewrite task. |
| Pending task is not due yet | Do not surface it in `pendingRewritePractice`. |
| Pending task is older than 7 days | Do not occupy the main Practice rewrite slot. |
| Complete input has blank `userRewriteText` | Return `{ success: false, error }`; do not update the task. |
| Complete/skip task ID is missing | Return `{ success: false, error: 'Rewrite practice was not found.' }`. |
| Complete/skip task is already terminal | Return success with the current task snapshot and no duplicate status transition. |

### 5. Good/Base/Bad Cases

- Good: A saved valid review creates one D+1 focus rewrite task; next day Practice shows it, writing still works, submitting reveals the native model and stores the trimmed rewrite.
- Base: The user skips the due practice; Practice removes the card and still allows normal writing/review.
- Base: A task older than 7 days remains in storage/history but no longer occupies the main Practice slot.
- Bad: A low-confidence or non-focus correction generates rewrite practice.
- Bad: The renderer derives the post-submit reveal card only from `writing.pendingRewritePractice`, so completion removes the card before the native model can be shown.
- Bad: Date fields return ISO strings over IPC or compare seconds to milliseconds.

### 6. Tests Required

- Save transaction test:
  - Assert saved review creates one pending `rewrite_original` task with `spacedStage = 'D+1'`, D+1 `dueAt`, focus original sentence, focus pattern, and native model sentence.
  - Assert multiple rewrite operations still create at most one task.
  - Assert low-confidence or non-focus referenced rewrite operations do not create tasks.
- Service test:
  - Assert Practice returns one due pending D+1 task and excludes not-due, non-D+1, terminal, and older-than-7-days tasks.
  - Assert complete stores trimmed `userRewriteText`, sets `completedAt`, removes pending Practice task, and returns completed `rewritePractice` for UI reveal.
  - Assert skip sets `skippedAt` and removes pending Practice task.
- UI smoke/manual test:
  - Pending card shows original sentence, focus pattern, input, and Skip.
  - Native model is hidden before submit and visible after submit.
  - Writing editor remains editable/autosaves while the rewrite card is present.

### 7. Wrong vs Correct

#### Wrong

```typescript
if (result.success && result.writing) {
  setWriting(result.writing);
}

const practice = writing.pendingRewritePractice;
```

After completion, the fresh writing snapshot has no pending practice, so the UI loses the card before revealing the native model.

#### Correct

```typescript
if (result.success && result.writing && result.rewritePractice) {
  setWriting(result.writing);
  setCompletedRewritePractice(result.rewritePractice);
}

const practice = completedRewritePractice ?? writing.pendingRewritePractice;
```

The pending Practice slot stays empty after completion, while the completed task remains available long enough to show the native model result.

## Scenario: Rewrite Check Attempt Baseline

### 1. Scope / Trigger

- Trigger: Any task that changes rewrite-check persistence, `RewritePracticeSnapshot.latestRewriteCheck`, rewrite-check retry IPC, or shared rewrite-check contracts.
- This is a cross-layer contract: rewrite task completion -> SQLite `rewrite_checks` attempts -> shared Zod schemas -> preload IPC -> renderer state.

### 2. Signatures

DB table:

```text
rewrite_checks(
  id text primary key,
  rewrite_task_id text not null references rewrite_tasks(id) on delete cascade,
  status text not null default 'pending',
  outcome text null,
  feedback text null,
  provider text null,
  model text null,
  validation_errors_json text null,
  error_message text null,
  diagnostics_json text null,
  created_at integer timestamp_ms not null,
  updated_at integer timestamp_ms not null,
  completed_at integer timestamp_ms null,
  check status in ('pending', 'in_progress', 'completed', 'failed', 'retryable'),
  check outcome is null or outcome in ('correct', 'partly_correct', 'incorrect'),
  check completed rows have an outcome and non-completed rows do not
)
```

Shared snapshot:

```ts
type RewriteCheckSnapshot = {
  id: string;
  rewriteTaskId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'retryable';
  outcome: 'correct' | 'partly_correct' | 'incorrect' | null;
  feedback: { message: string; nextStep?: string } | null;
  provider: string | null;
  model: string | null;
  validationErrors: string[] | null;
  errorMessage: string | null;
  diagnostics: Record<string, unknown> | null;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
};
```

API shape:

```ts
type RewritePracticeSnapshot = {
  latestRewriteCheck: RewriteCheckSnapshot | null;
};

type CompleteRewritePracticeResult = RewritePracticeUpdateResult;

window.api.writing.retryRewriteCheck({ rewriteTaskId: string }): Promise<RetryRewriteCheckResult>;

type RetryRewriteCheckResult = {
  success: boolean;
  writing?: WritingAttemptSnapshot;
  rewritePractice?: RewritePracticeSnapshot | null;
  rewriteCheck?: RewriteCheckSnapshot | null;
  error?: string;
};
```

### 3. Contracts

- Each evaluation attempt is a separate `rewrite_checks` row. Do not overwrite `rewrite_tasks` with evaluation outcome or feedback.
- `rewrite_tasks.status` remains the practice lifecycle; `rewrite_checks.status` is the evaluator lifecycle.
- `latestRewriteCheck` is nullable and derived from the latest check row for the task, ordered by creation/update time.
- `completed` checks must carry exactly one outcome: `correct`, `partly_correct`, or `incorrect`.
- Non-completed checks must keep `outcome = null`; retryable/failure explanation belongs in `errorMessage`, `validationErrors`, or `diagnostics`.
- Baseline contract work may expose retry channel/preload/result shapes, but it must not call an evaluator or render feedback UI unless the task PRD says so.
- All timestamp fields crossing IPC are Unix milliseconds numbers, not ISO strings.

### 4. Validation & Error Matrix

| Condition | Behavior |
| --- | --- |
| `rewriteTaskId` is blank at IPC/service boundary | Reject through shared Zod validation; do not create a check row. |
| No check row exists for a rewrite task | Expose `latestRewriteCheck: null`; keep rewrite practice completion/skip behavior unchanged. |
| Check status is `completed` with `outcome = null` | Reject through shared Zod validation and SQL check constraint. |
| Check status is not `completed` with a non-null outcome | Reject through shared Zod validation and SQL check constraint. |
| Persisted `validation_errors_json` is malformed | Expose `validationErrors: null` rather than leaking parse failure to renderer state. |
| Persisted `diagnostics_json` is malformed or not an object | Expose `diagnostics: null`. |
| Retry endpoint exists before evaluator implementation | Return `{ success: false, error }`; do not create a fake evaluator result. |

### 5. Good/Base/Bad Cases

- Good: Completing rewrite practice returns the completed practice snapshot and, when a completed check row exists, `latestRewriteCheck` with outcome, concise feedback, provider, model, and millisecond timestamps.
- Base: A rewrite task with no checks still completes/skips exactly as before and exposes `latestRewriteCheck: null`.
- Base: A retryable check stores `status = 'retryable'`, `outcome = null`, and diagnostic/error metadata for later retry/debugging.
- Bad: Adding `check_outcome` or feedback columns directly to `rewrite_tasks`, so repeated attempts overwrite history.
- Bad: Treating a `retryable` check as `incorrect`; evaluator failure and learner outcome are different states.

### 6. Tests Required

- Migration/schema test:
  - Assert `rewrite_checks` exists, references `rewrite_tasks`, cascades on delete, and has status/outcome check constraints.
  - Assert provider/model, validation error, error message, diagnostics, and timestamp columns exist.
- Shared contract test:
  - Assert all baseline check statuses parse.
  - Assert completed checks require an outcome.
  - Assert non-completed checks reject outcomes.
  - Assert retry input/result payloads parse without evaluator behavior.
- Service test:
  - Assert rewrite practice snapshots include `latestRewriteCheck: null` when no row exists.
  - Assert the latest existing check maps database strings/JSON/timestamps into `RewriteCheckSnapshot`.
  - Assert complete/skip behavior is unchanged except for nullable latest-check exposure.
- IPC/preload contract test:
  - Assert retry channel/preload signatures use shared input/result schemas and do not call an evaluator in the baseline task.

### 7. Wrong vs Correct

#### Wrong

```typescript
await db.update(rewriteTasks).set({
  status: 'completed',
  checkOutcome: 'incorrect',
  checkFeedback: 'Try again.',
});
```

This collapses practice lifecycle and evaluator lifecycle into one row and loses attempt history.

#### Correct

```typescript
await db.insert(rewriteChecks).values({
  id: checkId,
  rewriteTaskId,
  status: 'completed',
  outcome: 'partly_correct',
  feedback: 'The tense is repaired, but article use still needs attention.',
  provider,
  model,
});
```

The rewrite task remains the durable practice item, and each evaluator attempt becomes auditable retry/debug history.

## Scenario: Review Preview Payload and Save Boundary

### 1. Scope / Trigger

- Trigger: Any task that changes review preview rendering, review save IPC, persisted preview payload fields, or low-confidence correction handling.
- Preview is a cross-layer contract: validation harness -> `review_runs` preview payload columns -> main-process IPC -> renderer preview UI -> save transaction.

### 2. Signatures

- DB columns on `review_runs`:
  - `writing_attempt_id: text not null references writing_attempts(id)`
  - `writing_revision_id: text | null references writing_revisions(id)`
  - `parsed_output_json: text | null` — validated `ReviewOutput` stored only for `review_ready` previews.
  - `preview_operations_json: text | null` — validated preview operations generated by the app-side validation harness.
- IPC/API:
  - `review.getPreview({ reviewRunId: string }): ReviewPreviewSnapshot | null`
  - `review.save({ reviewRunId: string, selfRepairAttemptText?: string, revealedWithoutAttempt?: boolean }): SaveReviewOutput`
- Save result:
  - `{ success: true, reviewRun: ReviewRunSnapshot, writing: WritingAttemptSnapshot }`
  - `{ success: false, error: string }`

### 3. Contracts

- `getPreview` returns data only for `review_runs.status = "review_ready"` with both preview payload columns present.
- `ReviewPreviewSnapshot.reviewedContent` must come from `review_runs.writing_revision_id`, not the active editor text.
- `isStaleForCurrentWriting` compares the active writing revision hash with `review_runs.content_hash`.
- `saveReviewRun` consumes `preview_operations_json`; it must not re-derive persistence operations from renderer state.
- `saveReviewRun` must return the `WritingAttemptSnapshot` for the saved review run's `writing_attempt_id` / template, not the default Journal attempt.
- A correction is low confidence if either anchoring failed or the model returned `confidence: "low"`.
- Low-confidence corrections may appear in preview as `Other suggestions`, but save must not write them to `corrections`, update pattern counters, or create rewrite tasks from them.

### 4. Validation & Error Matrix

| Condition | Behavior |
| --- | --- |
| `getPreview` input fails schema | Return `null`; do not throw through IPC. |
| Review run missing, not `review_ready`, or missing preview payloads | Return `null`. |
| Focus correction missing, duplicated, or low confidence | `saveReviewRun` returns `{ success: false, error }`; transaction rolls back. |
| Review run already `review_saved` or `stale` | Return success without duplicating artifacts. |
| Active writing hash differs before save | Save historical artifacts as `stale`; do not replace `writing_attempts.last_review_run_id`. |
| Insert/update fails mid-save | Roll back correction, self-repair, reference rewrite, rewrite task, run-status, and writing pointer writes. |

### 5. Good/Base/Bad Cases

- Good: `review_ready` run stores validated payloads, renderer shows reviewed-version highlights, user saves once, and artifacts are created exactly once.
- Base: `valid_with_warnings` preview contains low-confidence `Other suggestions`; save skips those rows and still saves anchored focus artifacts.
- Bad: Renderer submits derived corrections to save, causing divergence from harness-generated operations.
- Bad: Anchored `confidence: "low"` correction is saved as a normal correction because offsets exist.
- Bad: Saving a CET-4 review returns a default Journal snapshot and switches the UI out of the selected template.

### 6. Tests Required

- Validation harness test: `confidence: "low"` becomes `status: "low_confidence"` even when anchored.
- Save transaction test: first save creates correction/self-repair/reference/rewrite rows; repeated save creates no duplicates.
- Save rollback test: injected mid-transaction failure leaves no partial artifacts and keeps run status `review_ready`.
- Low-confidence test: low-confidence corrections are excluded from saved correction rows and rewrite tasks.
- Stale save test: hash-mismatched save marks the run `stale` and preserves the previous `writing_attempts.last_review_run_id`.
- Cross-template save test: saving review for CET-4/CET-6/Free Writing returns `writing.templateId` matching the reviewed attempt.

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
