# Data Model Contract

## Content Revision Contract

Corrections are anchored to the reviewed writing content version, not necessarily the current editor content.

- `writing_attempts` represents one current practice attempt for a `(date_key, template_id)` pair and points to the active revision.
- `writing_revisions` stores versioned writing text.
- `review_runs.input_snapshot_json` must contain the complete normalized `writingContent` used for review.
- `corrections.start_offset` and `corrections.end_offset` are relative to the content version identified by `review_runs.content_hash`.
- Editing the active writing revision makes old reviews stale but does not delete them.
- Applying a saved focus correction must create a new user-approved revision and never mutate historical writing snapshots, correction offsets, or provider output.

## Scenario: User-Approved Apply-Correction Revisions

### 1. Scope / Trigger

- Trigger: Any task that changes correction application, `window.api.review.applyCorrection`, `ApplyReviewCorrectionInput`, `writing_revisions`, correction anchor validation, review stale behavior after apply, or `learning_events.event_type = 'correction_applied'`.
- Apply-correction is a user-approved draft revision workflow. It is not an auto-correction flow, not a bulk-apply flow, and not a mutation of the reviewed historical revision.

### 2. Signatures

Preload API:

```ts
window.api.review.applyCorrection(input: ApplyReviewCorrectionInput): Promise<ApplyReviewCorrectionOutput>;
```

Shared input/output:

```ts
type ApplyReviewCorrectionInput = {
  reviewRunId: string;
  correctionIndex: number;
  writingRevisionId: string;
};

type ApplyReviewCorrectionOutput =
  | {
      success: true;
      writing: WritingAttemptSnapshot;
      reviewRun: ReviewRunSnapshot;
      appliedRevision: WritingRevisionSnapshot;
    }
  | {
      success: false;
      error: string;
    };
```

Durable writes on success:

```text
writing_revisions insert:
  id text primary key
  writing_attempt_id = review_runs.writing_attempt_id
  content = active content with the saved focus correction replacement
  content_hash = sha256(normalizeWritingContent(content))

writing_attempts update:
  active_revision_id = inserted revision id
  last_review_run_id = null
  reviewed_at = null

review_runs update:
  status = 'stale'

learning_events insert:
  event_type = 'correction_applied'
```

### 3. Contracts

- The review must already be saved. Applying corrections from `review_ready` previews is forbidden.
- Only the saved focus correction is applyable in the first version. The focus correction is identified by `previewOperations.selfRepair.correctionIndex`.
- The caller must pass the active `writingRevisionId` being approved by the user. The service must reject if the active revision changed before the mutation runs.
- The active revision `content_hash` must match `review_runs.content_hash`.
- The selected correction must be anchored, not low-confidence, and have valid `startOffset` / `endOffset`.
- The active revision content slice at `[startOffset, endOffset)` must equal `correction.originalText` before replacement.
- Successful apply creates a new writing revision and updates the active attempt pointer in the same transaction as the review-stale update and learning-event append.
- Historical rows are immutable for this workflow: do not update old `writing_revisions.content`, `review_runs.input_snapshot_json`, `review_runs.parsed_output_json`, `review_runs.preview_operations_json`, `corrections.start_offset`, `corrections.end_offset`, or provider raw output.
- `correction_applied` payloads may include correction index, previous/next content hashes, and applied revision id. They must not include full writing content, original/corrected text, provider output, or hidden prompt/fingerprint internals.

### 4. Validation & Error Matrix

| Condition | Behavior |
| --- | --- |
| `reviewRunId` is unknown | Return `{ success: false, error }`; do not write a revision or event. |
| Review status is `review_ready` | Return a save-first error; do not apply preview corrections. |
| Review status is `stale` | Ask the user to review the current draft first. |
| Review status is not `review_saved` | Reject; only saved reviews can apply corrections. |
| `correctionIndex` does not identify exactly one saved correction | Reject as not found. |
| Correction is not the saved focus correction | Reject; do not apply secondary suggestions in this flow. |
| Correction is low-confidence or unanchored | Reject as not safely anchored. |
| Caller `writingRevisionId` does not equal the active revision id | Reject as draft-changed-before-apply. |
| Active revision hash differs from `review_runs.content_hash` | Reject as stale; review current draft first. |
| Active content slice no longer equals `correction.originalText` | Reject as anchor mismatch. |
| Replacement produces the same content hash | Reject as already applied; do not create another revision. |
| Successful apply | Insert revision, update active attempt, stale review, append compact event, return fresh writing snapshot. |

### 5. Good/Base/Bad Cases

- Good: A learner saves a review, clicks `Create revised draft`, and the app inserts a new revision with the focus correction while preserving the reviewed revision.
- Good: The returned writing snapshot points at the applied revision, clears `lastReviewRunId`, and exposes the source review as stale.
- Base: The user edits the draft after review; apply rejects because the approved revision/hash no longer matches.
- Base: The saved review contains multiple corrections; only the focus correction can be applied.
- Bad: Applying a correction mutates the historical `writing_revisions.content` row that was reviewed.
- Bad: Applying from an unsaved preview creates a draft revision before the user crosses the save-review learning-history boundary.
- Bad: Event payload stores the old sentence, corrected sentence, full draft text, raw provider output, or hidden pattern fingerprint.

### 6. Tests Required

- Shared schema test: `ApplyReviewCorrectionInput` and success/failure output schemas parse expected payloads.
- Service success test: saved current focus correction creates one new revision, stales the review, clears current review pointers, and logs one compact `correction_applied` event.
- Service rejection tests: unsaved review, stale review, unknown correction, non-focus correction, low-confidence/unanchored correction, active revision mismatch, hash mismatch, text mismatch, and already-applied no-op.
- Transaction test: event append or revision/update failure rolls back the apply mutation.
- Migration/schema test: `learning_events` accepts `correction_applied` in the event-type check.
- Renderer query test: apply success updates writing/review caches and invalidates preview/event queries.
- Feedback UI test: apply is disabled before save, enabled after saved current review, and replaced by review-current-draft action for stale/mismatched reviews.

### 7. Wrong vs Correct

#### Wrong

```ts
await db.update(writingRevisions).set({ content: correctedContent }).where(eq(writingRevisions.id, reviewedRevisionId));
```

This rewrites the historical draft that review anchors, correction offsets, and provider output refer to.

#### Correct

```ts
const appliedRevision = tx.insert(writingRevisions).values({
  id: createId('revision'),
  writingAttemptId,
  content: correctedContent,
  contentHash: computeWritingContentHash(correctedContent),
});

tx.update(writingAttempts).set({
  activeRevisionId: appliedRevision.id,
  lastReviewRunId: null,
  reviewedAt: null,
});
```

The approved correction becomes a new draft revision while the reviewed version remains intact for auditability.

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
learning_events
```

The app may keep fields needed by later revisions, but it must not expose future workflows unless the task requires them.

## Scenario: Learning Event Log

### 1. Scope / Trigger

- Trigger: Any task that changes review save, rewrite submit/check/retry, rewrite skip/snooze/expiry, D+3/D+7 task generation, pattern merge, `learning_events`, or `window.api.learningAssets.listLearningEvents`.
- The learning event log is an append-only audit trail. It explains durable learning mutations but is not the source of truth for Progress, mastery, or evidence state.

### 2. Signatures

SQLite table:

```text
learning_events(
  id text primary key,
  event_type text not null,
  occurred_at integer timestamp_ms not null,
  dedupe_key text unique null,
  review_run_id text null references review_runs(id) on delete set null,
  pattern_id text null references error_patterns(id) on delete set null,
  rewrite_task_id text null references rewrite_tasks(id) on delete set null,
  rewrite_check_id text null references rewrite_checks(id) on delete set null,
  payload_json text not null default '{}',
  created_at integer timestamp_ms not null
)
```

Shared event snapshot:

```ts
type LearningEventType =
  | 'review_saved'
  | 'rewrite_task_created'
  | 'rewrite_submitted'
  | 'rewrite_check_recorded'
  | 'rewrite_retry_requested'
  | 'rewrite_skipped'
  | 'rewrite_snoozed'
  | 'rewrite_expired'
  | 'pattern_merged'
  | 'correction_applied';

type LearningEventSnapshot = {
  id: string;
  eventType: LearningEventType;
  occurredAt: number;
  dedupeKey: string | null;
  reviewRunId: string | null;
  patternId: string | null;
  rewriteTaskId: string | null;
  rewriteCheckId: string | null;
  payload: Record<string, unknown>;
  createdAt: number;
};
```

Preload API:

```ts
window.api.learningAssets.listLearningEvents(): Promise<LearningEventSnapshot[]>;
```

### 3. Contracts

- Event rows are append-only. Existing event rows must not be updated to reinterpret history.
- `occurred_at` and `created_at` use Unix milliseconds through Drizzle `timestamp_ms`; IPC snapshots expose numbers.
- `dedupe_key` is nullable and unique. Repeated idempotent calls must not create duplicate event rows.
- Parent links use `on delete set null` so historical events remain readable if a future cleanup removes a parent row.
- Payloads may contain compact metadata such as status, stage, kind, outcome, source/target pattern IDs, and due timestamps.
- Payloads must not contain raw provider output, API keys, hidden fingerprints/prompt contracts, or full user writing/rewrite text.
- `correction_applied` payloads may include correction index, previous/next content hashes, and the applied revision ID, but must not include original/corrected text or full writing content.
- Read APIs return recent events newest-first with parsed payload objects and a bounded limit.
- Progress and evidence read models remain derived from durable patterns, tasks, and checks; never derive learning success directly from event rows.

### 4. Validation & Error Matrix

| Condition | Behavior |
| --- | --- |
| Duplicate non-null `dedupe_key` | Ignore the duplicate append; keep one row for the logical mutation. |
| Payload is missing | Persist `{}`. |
| Payload is malformed in storage | Read API returns `{}` for that payload rather than exposing parse failure. |
| Review save is repeated after `review_saved` or `stale` | Return the existing save result and do not append a new event. |
| Rewrite complete/skip/snooze receives terminal no-op task | Return current snapshot and do not append a new event. |
| Retry is requested before saved rewrite text exists | Return validation error and do not append retry/check events. |
| D+3/D+7 task generation is skipped for weak outcome or missing contract | Preserve the check result and do not append a task-created event. |

### 5. Good/Base/Bad Cases

- Good: First save of a valid review appends `review_saved` and, when a D+1 task is inserted, `rewrite_task_created`.
- Good: A rewrite submit appends `rewrite_submitted`, appends `rewrite_check_recorded`, and appends `rewrite_task_created` only if a D+3/D+7 task is actually inserted.
- Base: A retryable evaluator failure still appends `rewrite_check_recorded` with `checkStatus: 'retryable'`, without treating it as a learner outcome.
- Base: Pattern merge appends one `pattern_merged` event after a successful merge and no event after rejected validation.
- Base: Applying a saved focus correction appends one `correction_applied` event after the new revision and active-attempt pointer update commit together.
- Bad: Event payload stores the submitted rewrite text, raw model JSON, hidden prompt contract, or provider key material.
- Bad: Progress uses `learning_events` counts or event types to claim repair, transfer, stability, or mastery.

### 6. Tests Required

- Migration test: `0011_learning_events.sql` creates the table, parent links, timestamp fields, dedupe index, and event-type check.
- Shared schema test: `LearningEventSnapshot` parses numeric timestamps and object payloads; event type enum contains no mastery vocabulary.
- Append helper test: duplicate dedupe keys produce one event and read snapshots parse payload JSON.
- Review save test: first save logs review/task events once; repeated save does not duplicate events; stale-history save logs `review_saved` with stale metadata.
- Rewrite lifecycle test: submit/recovery, check completion/retryable, retry, D+3/D+7 creation, skip, snooze, and expiry log only on actual mutations.
- Merge test: successful merge logs `pattern_merged`; rejected merge logs nothing.
- IPC/preload contract test or typecheck: `learningAssets.listLearningEvents` returns the shared list output schema.

### 7. Wrong vs Correct

#### Wrong

```ts
appendLearningEvent({
  eventType: 'rewrite_submitted',
  payload: { userRewriteText, rawModelOutput },
});
```

This leaks learner writing and provider output into an audit surface that future export/debug flows may expose.

#### Correct

```ts
appendLearningEvent({
  eventType: 'rewrite_submitted',
  rewriteTaskId: task.id,
  dedupeKey: `rewrite_submitted:${task.id}:${completedAt.getTime()}`,
  payload: { practiceKind: task.kind, spacedStage: task.spacedStage, submissionKind: 'recovery' },
});
```

The event links durable rows and stores compact mutation metadata while leaving writing text in the canonical tables.

## Scenario: Pattern Fingerprint Persistence

### 1. Scope / Trigger

- Trigger: Any task that changes review focus-pattern validation, pattern persistence, `error_patterns`, or future transfer prompt/evaluator inputs.
- This is a shared review-contract -> main-process save -> SQLite contract. Renderer Progress/Notebook read models must not expose fingerprint internals.

### 2. Signatures

Shared review output:

```ts
type PatternFingerprint = {
  patternType: 'grammar' | 'collocation' | 'word_choice' | 'phrase_structure' | 'register' | 'sentence_logic';
  learnerError: string;
  targetCorrection: string;
  abstractRule: string;
  positiveExamples: string[];
  negativeExample: string;
  transferBoundary: string;
  forbiddenLeakageTerms: string[];
};

type ReviewOutput = {
  summary: {
    focusPattern: {
      correctionIndex: number;
      reason: string;
      fingerprint: PatternFingerprint;
    };
  };
};
```

SQLite field:

```text
error_patterns.fingerprint_json text null
```

### 3. Contracts

- `summary.focusPattern.fingerprint` is required for valid review output.
- Save persists `fingerprint_json` only for the durable pattern linked to `summary.focusPattern.correctionIndex`.
- New focus pattern rows are inserted with `fingerprint_json`.
- Matched or duplicate focus pattern rows fill `fingerprint_json` only when the existing value is `null`.
- Existing non-null `fingerprint_json` is not overwritten during review save.
- Non-focus pattern operations must not receive or persist fingerprints.
- Public renderer snapshots, including `ReviewPreviewSnapshot`, `ErrorPatternSnapshot`, Notebook snapshots, and normal Progress UI responses, do not include fingerprint internals.
- Persisted review operations may keep the focus fingerprint in main-process storage so `saveReviewRun` can write `error_patterns.fingerprint_json`; public preview schemas must strip it before crossing IPC.

### 4. Validation & Error Matrix

| Condition | Behavior |
| --- | --- |
| Focus fingerprint is missing from review output | Shared schema validation fails; no preview operations are produced. |
| Fingerprint string fields are blank | Shared schema validation fails. |
| `positiveExamples` or `forbiddenLeakageTerms` is empty | Shared schema validation fails. |
| Saved focus pattern operation lacks a fingerprint | `saveReviewRun` rejects before writing durable learning assets. |
| Matched pattern has `fingerprint_json = null` | Save fills it from the focus fingerprint. |
| Matched pattern already has `fingerprint_json` | Save keeps the existing value. |

### 5. Good/Base/Bad Cases

- Good: A valid focus correction with a new pattern suggestion inserts one `error_patterns` row with `fingerprint_json`.
- Good: A valid matched focus correction fills a missing fingerprint without changing pattern de-dup behavior.
- Base: Existing historical pattern rows keep `fingerprint_json = null` until reused as a saved focus pattern.
- Bad: A review preview saves pattern counts while the focus pattern operation has no fingerprint.
- Bad: Progress exposes raw `learnerError`, `targetCorrection`, `transferBoundary`, or `forbiddenLeakageTerms`.

### 6. Tests Required

- Review contract test: valid output with `summary.focusPattern.fingerprint` passes validation and carries the fingerprint on the focus pattern operation.
- Review contract test: missing or invalid fingerprint returns `schemaValid: false` and empty operations.
- Save test: new focus pattern persists `fingerprint_json`.
- Save test: matched focus pattern fills missing `fingerprint_json`.
- Save test: matched focus pattern with existing `fingerprint_json` does not overwrite it.
- Migration test: Drizzle journal registers the migration and SQL adds `error_patterns.fingerprint_json`.
- Renderer/read-model test: public review/Progress/Notebook snapshots do not include fingerprint fields.

### 7. Wrong vs Correct

#### Wrong

```ts
patternOperations.push({ correctionIndex: nonFocusIndex, fingerprint });
```

This can persist a fingerprint for a secondary correction that was not selected as the learning focus.

#### Correct

```ts
const fingerprint = correctionIndex === summary.focusPattern.correctionIndex ? summary.focusPattern.fingerprint : undefined;
```

Only the selected focus pattern receives the hidden transfer contract.

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

## Repair-to-Transfer Evidence Semantics

The data model must keep task lifecycle, evaluator outcome, and learning evidence state separate.

- `rewrite_tasks.status` describes the practice item lifecycle only.
- `rewrite_checks.status` describes evaluator execution and retryability.
- `rewrite_checks.outcome` describes learner performance for one evaluation attempt.
- Derived Progress/evidence state must not treat `rewrite_tasks.status = 'completed'` as learning success.

Evidence stages:

| Evidence | Data interpretation |
| --- | --- |
| D+1 `correct` on `rewrite_original` | Original repair succeeded. |
| D+3 `correct` on `new_context_reuse` | Target pattern transferred once. |
| D+7 `correct` on `new_context_reuse` | Pattern is stable after spaced reuse. |
| `partly_correct` | Visible progress only; do not advance stage. |
| `incorrect` | Unsuccessful attempt; do not advance stage. |
| Valid alternative | Positive language feedback but not target-pattern transfer evidence. |

D+3/D+7 generation must be progressive:

- Review/save creates only the D+1 original-repair task.
- Create D+3 only after D+1 `correct`.
- Create D+7 only after D+3 `correct`.
- Do not create future spaced tasks before the prior success signal exists.

`partly_correct` and `incorrect` keep the learner in the same phase and allow recovery. Learner recovery remains within the same rewrite task, updates the task's saved `user_rewrite_text`, and appends a `rewrite_checks` attempt through `completeRewritePractice`. Provider retry for `failed` or `retryable` checks remains on `retryRewriteCheck` and reuses the saved rewrite text. Do not generate a separate retry task for the first transfer-evidence version.

## Scenario: D+3/D+7 New-Context Reuse

### 1. Scope / Trigger

- Trigger: Any task that changes D+3/D+7 new-context reuse generation, hidden prompt contracts, rewrite-check branching by task kind/stage, Practice rendering for new-context reuse, or Progress evidence advancement from `repaired_once` to `transferred_once` / `stable_after_spaced_reuse`.
- Transfer diagnostic persistence, fingerprint/prompt-contract UI, and `mastered`/gamified copy remain out of scope unless a future PRD explicitly asks for them.

### 2. Signatures

SQLite:

```text
rewrite_tasks.prompt_contract_json text null
rewrite_tasks.kind = 'rewrite_original' | 'new_context_reuse' | 'pattern_detection'
rewrite_tasks.spaced_stage = 'D+1' | 'D+3' | 'D+7'
```

Hidden prompt contract JSON:

```ts
type NewContextPromptContract = {
  targetMeaning: string;
  allowedHints: string[];
  forbiddenHints: string[];
  expectedPatternFamily: PatternFingerprint['patternType'];
};
```

Public practice snapshot:

```ts
type RewritePracticeSnapshot = {
  practiceKind: 'rewrite_original' | 'new_context_reuse';
  spacedStage: 'D+1' | 'D+3' | 'D+7';
  latestRewriteCheck: RewriteCheckSnapshot | null;
  // no prompt contract or fingerprint fields
};
```

### 3. Contracts

- Review/save still creates only one D+1 `rewrite_original` task for the saved focus correction.
- A D+3 task is created only after a D+1 `rewrite_original` task receives a completed rewrite-check outcome of `correct`.
- A D+7 task is created only after a D+3 `new_context_reuse` task receives a completed rewrite-check outcome of `correct`.
- D+3/D+7 creation runs after both initial submit (`completeRewritePractice`) and retry (`retryRewriteCheck`) outcomes.
- D+3/D+7 creation is idempotent per source review run and target stage; repeated terminal returns and repeated correct retries must not create duplicates.
- D+3 tasks use `kind = 'new_context_reuse'`, `spaced_stage = 'D+3'`, `status = 'pending'`, and `due_at = successful D+1 check completed_at + 3 days`.
- D+7 tasks use `kind = 'new_context_reuse'`, `spaced_stage = 'D+7'`, `status = 'pending'`, and `due_at = successful D+3 check completed_at + 7 days`.
- D+7 generation reuses the valid hidden prompt contract from D+3 when available; if the contract is missing/invalid and the saved focus fingerprint is recoverable, rebuild the same contract from that fingerprint. If neither exists, preserve the D+3 result and skip D+7.
- D+3 prompt contracts are built from the saved focus pattern fingerprint:
  - `targetMeaning` from `targetCorrection`.
  - `allowedHints` from `transferBoundary` or generic safe wording.
  - `forbiddenHints` from `forbiddenLeakageTerms`.
  - `expectedPatternFamily` from `patternType`.
- Visible D+3/D+7 prompts must be short new-context writing tasks and must not contain any forbidden leakage terms.
- Public renderer state may show D+3/D+7 kind/stage and learner-facing prompt copy, but must not expose raw fingerprint or prompt-contract JSON.
- Rewrite-check evaluator prompts branch by task kind/stage:
  - D+1 repairs the original sentence.
  - D+3 judges delayed new-context transfer using the hidden prompt contract.
  - D+7 judges spaced new-context reuse using the hidden prompt contract with stage-aware context.
- Progress records `transferred_once` when a linked D+3 `new_context_reuse` task has a completed `correct` check.
- Progress records `stable_after_spaced_reuse` when a linked D+7 `new_context_reuse` task has a completed `correct` check.
- A later completed D+3/D+7 `partly_correct` or `incorrect` check sets the derived lifecycle to `needs_attention` but must not erase the strongest valid evidence stage already earned.
- D+7 does not generate any later task.
- D+7 tasks are created seven days before they are due, so expiry/staleness must not make them expire at the moment they first become due. Keep D+1/D+3 lifecycle behavior, but make D+7 stale only after its `due_at` plus the normal stale window.

### 4. Validation & Error Matrix

| Condition | Behavior |
| --- | --- |
| D+1 check completes with `correct` and the focus pattern has a valid fingerprint | Insert exactly one pending D+3 task with hidden prompt contract JSON. |
| D+3 check completes with `correct` and has a valid prompt contract or recoverable fingerprint | Insert exactly one pending D+7 task with hidden prompt contract JSON. |
| D+1 check completes with `partly_correct` or `incorrect` | Do not create D+3; keep evidence at the current phase. |
| D+3 check completes with `partly_correct` or `incorrect` | Do not create D+7; keep evidence at `transferred_once` only if earlier D+3 evidence is still valid. |
| D+1 check is retryable, failed, pending, or in progress | Do not create D+3. |
| D+3 check is retryable, failed, pending, or in progress | Do not create D+7. |
| Source task is not D+1 `rewrite_original`, or is skipped/expired/non-completed | Do not create D+3. |
| Source task is not D+3 `new_context_reuse`, or is skipped/expired/non-completed | Do not create D+7. |
| Saved focus fingerprint is missing or invalid | Preserve the D+1 completion/retry result and skip D+3 creation. |
| A D+3 task already exists for the review run | Do not insert another D+3 task. |
| A D+7 task already exists for the review run | Do not insert another D+7 task. |
| D+3 task has missing/invalid prompt contract at evaluator time | Persist a retryable/validation-failed check; do not expose raw contract details to the learner. |
| D+3 latest completed check is `partly_correct` or `incorrect` | Do not create D+7; set lifecycle to `needs_attention`; preserve `transferred_once` only if an earlier D+3 `correct` check already earned it. |
| D+7 latest completed check is `partly_correct` or `incorrect` | Set lifecycle to `needs_attention`; preserve `stable_after_spaced_reuse` only if an earlier D+7 `correct` check already earned it. |

### 5. Good/Base/Bad Cases

- Good: A D+1 retryable check later retries as `correct`, creates one D+3 task due three days after that successful retry check, and Progress remains `repaired_once` until D+3 is checked correct.
- Good: A completed D+3 transfer check with outcome `correct` moves the pattern to `Transferred once`.
- Good: A completed D+3 retry later succeeds as `correct`, creates one D+7 task due seven days after that successful retry check, and Progress moves to `Stable after spaced reuse` only after D+7 is checked correct.
- Base: A historical D+1 task with no fingerprint can still complete and show check feedback, but it creates no D+3 task.
- Base: A D+3/D+7 task reuses skip, snooze, expire, complete, and retry-check lifecycle behavior.
- Bad: Review/save batch-creates D+3 before D+1 success.
- Bad: D+3 completion batch-creates work after D+7 or generates duplicate D+7 rows after repeated correct retries.
- Bad: A D+3 prompt asks the learner to rewrite the original sentence, fill a blank, or copy a target expression.
- Bad: Progress treats task completion, retryable checks, or `partly_correct` as transfer evidence.

### 6. Tests Required

- Migration test: `rewrite_tasks.prompt_contract_json` is added and the SQL migration is registered in the Drizzle journal.
- Shared schema test: `RewritePracticeSnapshot` accepts `new_context_reuse` / `D+3` and `D+7` without prompt-contract fields.
- Service tests:
  - D+1 `correct` completion creates one D+3 task with prompt contract and D+3 due date.
  - D+1 `correct` retry creates D+3 when absent.
  - D+3 `correct` completion creates one D+7 task with prompt contract and D+7 due date.
  - D+3 `correct` retry creates D+7 when absent.
  - `partly_correct`, `incorrect`, retryable/failed checks, non-D+1 tasks, and missing/invalid fingerprints do not create D+3.
  - `partly_correct`, `incorrect`, retryable/failed checks, non-D+3 tasks, and missing/invalid prompt contracts without recovery do not create D+7.
  - Repeated correct returns/retries do not duplicate D+3.
  - Repeated D+3 correct returns/retries do not duplicate D+7.
  - D+3/D+7 evaluator prompts use stage-aware transfer semantics and hidden contract data.
- Progress tests: latest completed D+3 `correct` advances to `transferred_once`; latest completed D+7 `correct` advances to `stable_after_spaced_reuse`; latest completed D+3/D+7 `partly_correct`/`incorrect` does not advance.
- Renderer test: D+3/D+7 copy avoids `Original` and `Reference sentence` labels and does not show fingerprint or prompt-contract internals.

### 7. Wrong vs Correct

#### Wrong

```ts
await tx.insert(rewriteTasks).values({
  reviewRunId,
  kind: 'new_context_reuse',
  spacedStage: 'D+3',
  dueAt: new Date(Date.now() + 3 * ONE_DAY_MS),
});
```

This creates D+3 from review/save timing instead of from the successful D+1 check and has no hidden prompt contract.

#### Correct

```ts
if (sourceTask.kind === 'rewrite_original' && check.status === 'completed' && check.outcome === 'correct') {
  createD3FromSavedFingerprint({
    sourceTask,
    promptContract,
    dueAt: new Date(check.completedAt.getTime() + 3 * ONE_DAY_MS),
  });
}
```

D+3 is progressive, contract-backed, and tied to the actual D+1 success signal.

## Future Pattern Transfer Data Contracts

When implemented, pattern transfer features should preserve these relationships without adding a separate `reuse_tasks` system:

```text
rewrite_tasks.kind = 'rewrite_original'     with spaced_stage = 'D+1'
rewrite_tasks.kind = 'new_context_reuse'    with spaced_stage = 'D+3' | 'D+7'
```

Future D+3/D+7 tasks should be traceable to:

- source pattern;
- source correction/review context;
- source task/check outcome that generated the next stage;
- hidden prompt contract;
- latest and historical rewrite-check attempts.

Pattern fingerprint fields should be schema-validated when saved from review and then reused by later prompt generation/evaluation:

```text
pattern_type
learner_error
target_correction
abstract_rule
positive_examples_json
negative_example
transfer_boundary
forbidden_leakage_terms_json
```

New-context prompt contract fields should stay hidden from normal learner UI:

```text
target_meaning
allowed_hints_json
forbidden_hints_json
expected_pattern_family
```

Transfer evaluator diagnostic fields may be persisted as structured JSON or normalized columns in a future PRD:

```text
used_target_pattern
preserved_required_meaning
natural_in_context
contains_forbidden_leakage
used_valid_alternative
reason_code
```

Public snapshots should keep learner-facing output simple unless a future diagnostics UI explicitly asks for internals.

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

Pattern merge is v0.2. Historical corrections keep original pattern IDs, and display follows `merged_into_pattern_id` when merge exists.

## Scenario: Pattern Merge and De-Dup Flow

### 1. Scope / Trigger

- Trigger: Any task that changes pattern merge/de-dup UI, `error_patterns` merge metadata, `learningAssets.mergeErrorPatterns`, Progress pattern listing, future review pattern selection, or evidence derivation across merged patterns.
- This is a cross-layer local-first contract: Progress UI -> preload IPC -> main learning-assets service -> SQLite merge metadata -> pattern/evidence read flows.

### 2. Signatures

DB columns:

```text
error_patterns.merged_into_pattern_id text null
error_patterns.merged_at integer timestamp_ms null
```

Preload API:

```ts
type MergeErrorPatternsInput = {
  sourcePatternId: string;
  targetPatternId: string;
};

type MergeErrorPatternsResult =
  | { success: true; targetPattern: ErrorPatternSnapshot }
  | { success: false; error: string };

window.api.learningAssets.mergeErrorPatterns(input: MergeErrorPatternsInput): Promise<MergeErrorPatternsResult>;
```

`ErrorPatternSnapshot` includes:

```ts
mergedIntoPatternId: string | null;
mergedAt: number | null;
```

### 3. Contracts

- Merge is explicit and user initiated; save-time de-dup may still reuse exact-key or same-category rule-similar patterns before inserting.
- `sourcePatternId` and `targetPatternId` must be distinct, active, unmerged patterns in the same category.
- Merge preserves the source row for traceability: set `source.active = false`, `source.merged_into_pattern_id = target.id`, and `source.merged_at = now`.
- Merge does not rewrite `corrections.pattern_id`; historical corrections keep the original source ID.
- Target aggregate fields are updated at merge time:
  - `count = target.count + source.count`
  - `first_seen_date_key = min(target.first_seen_date_key, source.first_seen_date_key)`
  - `last_seen_date_key = max(target.last_seen_date_key, source.last_seen_date_key)`
  - `recent_examples_json` is target examples followed by source examples, de-duped and capped
  - `fingerprint_json` keeps target value; if target is `null`, fill from source
- `listErrorPatterns` hides merged-away inactive sources by default and rolls source evidence rows up to the target pattern.
- `selectActiveReviewPatterns` excludes inactive or merged-away source rows.
- Save-time exact-key de-dup must resolve a merged source pattern to its active target instead of reactivating the source.
- Renderer merge mutations invalidate `learningAssets.errorPatterns` after success.

### 4. Validation & Error Matrix

| Condition | Behavior |
| --- | --- |
| Source or target ID is blank | Reject via Zod; do not mutate. |
| Source and target IDs are identical | Reject via Zod; do not mutate. |
| Source row is missing | Return `{ success: false, error }`; do not mutate. |
| Target row is missing | Return `{ success: false, error }`; do not mutate. |
| Source is inactive or already merged | Return `{ success: false, error }`; do not mutate. |
| Target is inactive or already merged | Return `{ success: false, error }`; do not mutate. |
| Categories differ | Return `{ success: false, error }`; do not mutate. |
| Merge write fails after target/source update starts | Roll back the transaction. |

### 5. Good/Base/Bad Cases

- Good: Two active tense patterns are merged, source becomes inactive, target count/dates/examples update, historical source correction evidence appears under the target in Progress.
- Good: Target already has a fingerprint, so source fingerprint is not allowed to overwrite it.
- Good: A future new-pattern suggestion with the source's old `pattern_key` increments the active target and links the saved correction to the target.
- Base: Source has no rewrite evidence; merge still hides the source and updates target aggregate fields.
- Base: Source has a fingerprint and target does not; target receives the source fingerprint.
- Bad: Merge reassigns old `corrections.pattern_id` rows and destroys the historical trail.
- Bad: Future review input includes a merged-away inactive source pattern.
- Bad: Progress displays both source and target after a successful merge.

### 6. Tests Required

- Migration test: `0010_pattern_merge.sql` is registered and adds both merge columns.
- Service test: successful merge marks source inactive, stores merge metadata, updates target aggregates, and preserves correction links.
- Service test: evidence from source corrections rolls up to target after merge.
- Save-review test: exact-key duplicate suggestions for a merged source increment/link the active target and do not reactivate the source.
- Service test: invalid, missing, inactive, already-merged, same-ID, and cross-category requests return errors without partial writes.
- Query test: merge mutation invalidates `learningAssets.errorPatterns`.
- Render test: Progress can render merge controls for same-category active patterns without breaking existing evidence display.

### 7. Wrong vs Correct

#### Wrong

```ts
tx.update(corrections).set({ patternId: targetPattern.id }).where(eq(corrections.patternId, sourcePattern.id));
tx.delete(errorPatterns).where(eq(errorPatterns.id, sourcePattern.id));
```

#### Correct

```ts
tx.update(errorPatterns)
  .set({
    active: false,
    mergedIntoPatternId: targetPattern.id,
    mergedAt: now,
  })
  .where(eq(errorPatterns.id, sourcePattern.id));
```

## Scenario: Learning Assets Persistence

### 1. Scope / Trigger

- Trigger: Any task that changes `error_patterns`, `notebook_entries`, review input pattern selection, review save persistence, derived pattern evidence, or Notebook/Progress IPC.
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
  merged_into_pattern_id text null,
  merged_at integer timestamp_ms null,
  active integer boolean not null default true,
  created_at integer timestamp_ms not null,
  updated_at integer timestamp_ms not null
)

corrections.pattern_id text null references error_patterns(id) on delete set null

rewrite_tasks.review_run_id text not null references review_runs(id) on delete cascade
rewrite_checks.rewrite_task_id text not null references rewrite_tasks(id) on delete cascade

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
type PatternEvidenceStage =
  | 'needs_repair'
  | 'repaired_once'
  | 'transferred_once'
  | 'stable_after_spaced_reuse';

type PatternLifecycleStatus =
  | 'repair_needed'
  | 'repair_in_progress'
  | 'ready_for_transfer'
  | 'transfer_in_progress'
  | 'stabilizing'
  | 'stable'
  | 'needs_attention';

type PatternEvidenceCheckSummary = {
  id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'retryable';
  outcome: 'correct' | 'partly_correct' | 'incorrect' | null;
  completedAt: number | null;
  updatedAt: number;
};

type PatternEvidenceSummary = {
  stage: PatternEvidenceStage;
  latestRepair: {
    rewriteTaskId: string;
    practiceKind: 'rewrite_original';
    spacedStage: 'D+1';
    status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'snoozed' | 'expired';
    dueAt: number | null;
    completedAt: number | null;
    createdAt: number;
    latestCheck: PatternEvidenceCheckSummary | null;
  } | null;
  latestTransfer: {
    rewriteTaskId: string;
    practiceKind: 'new_context_reuse';
    spacedStage: 'D+3' | 'D+7';
    status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'snoozed' | 'expired';
    dueAt: number | null;
    completedAt: number | null;
    createdAt: number;
    latestCheck: PatternEvidenceCheckSummary | null;
  } | null;
};

type PatternLifecycleSummary = {
  status: PatternLifecycleStatus;
  label: string;
  description: string;
  blockingReason?: string;
};

type ErrorPatternSnapshot = {
  // existing pattern fields
  evidence?: PatternEvidenceSummary;
  lifecycle: PatternLifecycleSummary;
};

window.api.learningAssets.listErrorPatterns(): Promise<ErrorPatternSnapshot[]>;
window.api.learningAssets.listNotebookEntries(): Promise<NotebookEntrySnapshot[]>;
window.api.learningAssets.mergeErrorPatterns(input: MergeErrorPatternsInput): Promise<MergeErrorPatternsResult>;
```

### 3. Contracts

- `validateReviewResult` produces preview-only `patternOperations` and `upgradeOpportunities`; every operation must keep `updatesLongTermStats: false`.
- `saveReviewRun` is the only place that turns preview learning operations into durable learning assets.
- Saving a matched pattern increments `error_patterns.count`, updates `last_seen_date_key`, prepends the recent example, and links the saved correction through `corrections.pattern_id`.
- Saving a new pattern suggestion normalizes `pattern_key`, checks exact-key and same-category rule similarity, and reuses an existing similar pattern before inserting.
- `selectActiveReviewPatterns` reads active non-spelling `error_patterns`, sorts by count and recency, and respects `existingPatternsLimit`.
- Merged-away source patterns are inactive and excluded from review input; list/evidence display follows `merged_into_pattern_id` without rewriting historical corrections.
- Upgrade opportunities must store the reviewed source phrase, 1-3 suggested alternatives, optional reason, date key, template, and review run ID.
- Invalid review output and unsaved review previews must not update `error_patterns`, `notebook_entries`, or correction links.
- `listErrorPatterns` derives `evidence` and `lifecycle` at query time; do not add a stored evidence-state/status column in this version.
- D+1 repair evidence links an `error_patterns` row to rewrite practice through saved focus corrections: `corrections.pattern_id` plus `corrections.category = 'fix'`, joined to D+1 `rewrite_tasks` by `review_run_id`.
- Evidence derivation must filter repair context to `kind = 'rewrite_original'` and `spaced_stage = 'D+1'`.
- Transfer context derives from linked `new_context_reuse` tasks with `spaced_stage = 'D+3' | 'D+7'` and is exposed as `evidence.latestTransfer`.
- For one rewrite task, the latest completed check is decisive: latest completed `correct` advances to `repaired_once`; latest completed `partly_correct` or `incorrect` remains `needs_repair`.
- Retryable/failed/in-progress check state is visible context but does not remove prior correct evidence for another D+1 task already counted for that pattern.
- D+3/D+7 `correct` checks contribute to the strongest earned evidence stage. A later weak D+3/D+7 check changes lifecycle to `needs_attention` without erasing that earned stage.
- Lifecycle status is a derived read model with labels and non-gamified descriptions: `repair_needed`, `repair_in_progress`, `ready_for_transfer`, `transfer_in_progress`, `stabilizing`, `stable`, or `needs_attention`.
- `skipped`, `snoozed`, and `expired` repair tasks are lifecycle context only; they must not advance evidence stage.
- Progress must invalidate pattern evidence after rewrite practice/check mutations because evidence is derived from `rewrite_tasks` and `rewrite_checks`, not only from `error_patterns`.

### 4. Validation & Error Matrix

| Condition | Behavior |
| --- | --- |
| `matchedPatternId` not found during save | Roll back save transaction and return an error. |
| New suggestion has a duplicate `pattern_key` | Reuse the existing pattern and increment it. |
| New suggestion is same-category and rule-similar to an existing pattern | Reuse the existing pattern and increment it. |
| Pattern is merged into another pattern | Hide the source by default; roll source evidence into the target. |
| Upgrade `sourceText` is not in reviewed writing | Validation is invalid; save never receives notebook operation. |
| Save transaction fails after pattern/notebook writes begin | Roll back all review save side effects. |
| Pattern has no linked D+1 rewrite task | Return `evidence.stage = 'needs_repair'` and `latestRepair = null`. |
| Linked D+1 task has latest completed check `correct` | Return `evidence.stage = 'repaired_once'`. |
| Linked D+1 task has latest completed check `partly_correct` or `incorrect` | Keep `evidence.stage = 'needs_repair'` for that task. |
| Linked D+1 task has completed `correct` and no D+3 transfer context | Return lifecycle `ready_for_transfer`. |
| Linked D+3 task is pending, in progress, snoozed, retryable, or failed | Return `evidence.latestTransfer` and lifecycle `transfer_in_progress` or `needs_attention` as appropriate. |
| Linked D+3 task has completed `correct` and no D+7 `correct` | Return `evidence.stage = 'transferred_once'` and lifecycle `stabilizing`. |
| Linked D+7 task has completed `correct` | Return `evidence.stage = 'stable_after_spaced_reuse'` and lifecycle `stable`. |
| Latest D+3/D+7 completed check is `partly_correct` or `incorrect` | Return lifecycle `needs_attention` and preserve the strongest valid evidence stage already earned. |
| Linked D+1 task is `skipped`, `snoozed`, or `expired` | Show lifecycle context without advancing evidence. |
| Rewrite check mutation completes/retries | Invalidate `learningAssets.errorPatterns` in the renderer query cache. |

### 5. Good/Base/Bad Cases

- Good: A saved review reuses `tense_past_narrative`, increments its count, links the correction, and shows the pattern in Progress.
- Good: A D+1 rewrite with latest completed `correct` check shows `Repaired once` in Progress.
- Good: A D+3 or D+7 task appears as `latestTransfer` in Progress without exposing fingerprint or prompt-contract internals.
- Good: A later weak D+3/D+7 check shows `needs_attention` while preserving previously earned transfer/stability evidence.
- Good: A valid upgrade for `very good` persists as a Notebook entry only when `very good` appears in the reviewed writing.
- Base: A spelling correction can persist as a correction without becoming an active review pattern.
- Base: A pattern with a skipped, snoozed, expired, partly-correct, or incorrect D+1 repair stays `Needs repair` while showing the latest context.
- Bad: Future review input is built from recent correction row IDs instead of semantic `error_patterns`.
- Bad: A review preview updates counts before the user explicitly saves.
- Bad: Progress derives evidence from task `completed` status instead of latest completed rewrite-check outcome.
- Bad: Progress query stays fresh after a rewrite-check mutation and displays stale evidence.

### 6. Tests Required

- Save-review test: matched pattern increments once and repeated save remains idempotent.
- Save-review test: new pattern suggestion creates one semantic pattern and links the correction.
- Save-review test: near-duplicate same-category rule reuses an existing pattern.
- Validation test: upgrade source must appear in writing content.
- Validation test: upgrade cap violations return invalid and empty operations.
- Service/API test: active review patterns exclude spelling and respect the cap.
- Service/API test: pattern evidence derives `needs_repair` and `repaired_once` from linked D+1 tasks and latest completed checks.
- Service/API test: `partly_correct`, `incorrect`, skipped, snoozed, and expired context does not advance evidence.
- Service/API test: lifecycle derivation covers every lifecycle status and weak D+3/D+7 outcomes preserve earned evidence while returning `needs_attention`.
- Service/API test: merged source D+3/D+7 transfer context rolls up to the active target pattern.
- Renderer query test: rewrite practice/check mutation invalidates `learningAssets.errorPatterns`.
- Progress render test: lifecycle is shown as primary current status; evidence label/copy and latest repair/transfer contexts are separate from review count and do not use `mastered` or gamified wording.

### 7. Wrong vs Correct

#### Wrong

```ts
const existingPatterns = db.select().from(corrections).all();
```

This treats individual corrections as reusable patterns, which creates unstable IDs and noisy future review input.

#### Wrong

```ts
const stage = task.status === 'completed' ? 'repaired_once' : 'needs_repair';
```

This treats activity completion as learning success.

#### Correct

```ts
const stage = latestCompletedCheck?.outcome === 'correct' ? 'repaired_once' : 'needs_repair';
```

Only rewrite-check outcome advances the first evidence stage.

#### Correct

```ts
const existingPatterns = selectActiveReviewPatterns(db, existingPatternsLimit);
```

Future review input comes from the semantic pattern archive owned by the app.

## Scenario: D+1 Rewrite Practice Slot

### 1. Scope / Trigger

- Trigger: Any task that changes saved-review rewrite task creation, `WritingAttemptSnapshot.pendingRewritePractice`, rewrite practice IPC, or rewrite task complete/skip/snooze/expire persistence.
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
  - `window.api.writing.snoozeRewritePractice({ rewriteTaskId: string }): RewritePracticeUpdateResult`
  - `RewritePracticeUpdateResult = { success: boolean; writing?: WritingAttemptSnapshot; rewritePractice?: RewritePracticeSnapshot | null; error?: string }`

### 3. Contracts

- `saveReviewRun` may create at most one pending rewrite task per saved review.
- The saved task must be `kind = 'rewrite_original'`, `spaced_stage = 'D+1'`, `status = 'pending'`, and `due_at = saved_at + 1 day`.
- The task must practice the single focus correction only. It must not be generated from a low-confidence correction or a non-focus correction.
- Before selecting the Practice rewrite slot, stale actionable D+1 tasks older than 7 days must be marked `expired`.
- Practice selects one actionable due rewrite task where `kind = 'rewrite_original'`, `spaced_stage = 'D+1'`, `status in ('pending', 'in_progress', 'snoozed')`, `due_at <= now`, and `created_at >= now - 7 days`.
- Rewrite practice must not block writing editor use or autosave.
- The native model sentence stays hidden while the task is pending and is revealed only after the user submits a rewrite, or in a future flow that explicitly supports reveal.
- Completing a task stores trimmed `user_rewrite_text`, sets `status = 'completed'`, sets `completed_at`, returns a fresh writing snapshot, and still returns the completed `rewritePractice` so the renderer can reveal the native model after the pending slot is empty.
- Skipping a task sets `status = 'skipped'`, sets `skipped_at`, returns a fresh writing snapshot, and removes the card from the pending Practice slot.
- Snoozing a task sets `status = 'snoozed'`, moves `due_at` one day forward from the current time, returns a fresh writing snapshot, removes the card from the pending Practice slot, and creates no `rewrite_checks` row.
- Due snoozed tasks may return to the Practice slot when `due_at <= now`; they remain lifecycle state only and do not advance learning evidence.
- Terminal `skipped` and `expired` tasks are no-op for complete/skip/snooze requests: return success with the current task snapshot and do not duplicate transitions or create check attempts.
- Terminal `completed` tasks are no-op for skip/snooze. For complete, a completed task is a learner-recovery target only when its latest completed `rewrite_checks.outcome` is `partly_correct` or `incorrect`; recovery updates `user_rewrite_text`, refreshes `completed_at`, and appends a new check attempt on the same task.
- All timestamp fields crossing IPC are Unix milliseconds numbers, not ISO strings.

### 4. Validation & Error Matrix

| Condition | Behavior |
| --- | --- |
| Save review has no D+1 `rewrite_original` operation | Save review succeeds without creating a rewrite task. |
| Rewrite operation references missing or low-confidence corrections | Do not create a rewrite task. |
| Rewrite operation does not reference the focus correction | Do not create a rewrite task. |
| Multiple D+1 rewrite operations exist | Create at most the first valid focus rewrite task. |
| Pending task is not due yet | Do not surface it in `pendingRewritePractice`. |
| Pending/in-progress/snoozed task is older than 7 days | Mark `expired`; do not occupy the main Practice rewrite slot. |
| Complete input has blank `userRewriteText` | Return `{ success: false, error }`; do not update the task. |
| Complete/skip/snooze task ID is missing | Return `{ success: false, error: 'Rewrite practice was not found.' }`. |
| Complete task is completed with latest completed check `partly_correct` or `incorrect` | Save revised text, refresh `completed_at`, append one `rewrite_checks` attempt, and keep task status `completed`. |
| Complete task is completed with latest completed check `correct` | Return success with the current task snapshot and no duplicate check attempt. |
| Complete/skip/snooze task is skipped or expired | Return success with the current task snapshot and no duplicate status transition. |
| Snooze request succeeds | Set status `snoozed`, set `due_at = now + 1 day`, return fresh writing snapshot, and do not create rewrite-check rows. |
| Snoozed task is not due yet | Do not surface it in `pendingRewritePractice`. |
| Snoozed task is due | It may occupy the Practice rewrite slot like other actionable D+1 work. |

### 5. Good/Base/Bad Cases

- Good: A saved valid review creates one D+1 focus rewrite task; next day Practice shows it, writing still works, submitting reveals the native model and stores the trimmed rewrite.
- Base: The user skips the due practice; Practice removes the card and still allows normal writing/review.
- Base: The user snoozes the due practice; Practice removes the card, stores a one-day-later `dueAt`, and records no rewrite-check attempt.
- Base: A due snoozed task returns to the Practice slot without changing learning evidence.
- Base: A task older than 7 days remains in storage/history but no longer occupies the main Practice slot.
- Bad: A low-confidence or non-focus correction generates rewrite practice.
- Bad: The renderer derives the post-submit reveal card only from `writing.pendingRewritePractice`, so completion removes the card before the native model can be shown.
- Bad: A terminal skipped or expired snapshot remains rendered with submit, snooze, or skip actions.
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
  - Assert snooze sets `status = 'snoozed'`, advances `dueAt` by one day, removes pending Practice task, and creates no `rewrite_checks`.
  - Assert due snoozed tasks can return to the Practice slot.
  - Assert stale actionable tasks are marked `expired` before slot selection.
  - Assert complete/skip/snooze are no-op for terminal tasks.
- UI smoke/manual test:
  - Pending card shows original sentence, focus pattern, input, Skip, and Snooze.
  - Native model is hidden before submit and visible after submit.
  - Snooze removes the card from the current Practice slot without showing success/failure learning copy.
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

#### Wrong

```typescript
const canSubmit = practice.status !== 'completed';
```

This leaves skipped or expired snapshots actionable if they are returned after a no-op lifecycle request.

#### Correct

```typescript
const isTerminal = practice.status === 'completed' || practice.status === 'skipped' || practice.status === 'expired';
const canSubmit = !isTerminal && inputValue.trim().length > 0;
```

Terminal lifecycle states are visible history only; they must not expose submit, skip, or snooze actions.

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
- Base: A completed weak outcome can be followed by a revised learner submission on the same rewrite task, producing a later completed check that becomes decisive for evidence.
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
