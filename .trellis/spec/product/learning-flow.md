# Learning Flow Contract

## Core Learning Principles

- Free writing comes before correction. The editor must not use realtime redlines, live suggestions, or auto-correction that pushes the user into exam mode.
- AI can design starter prompts/topics and post-writing feedback, but it must not replace the act of writing.
- Feedback should be small and stable. Each review should focus on the most transferable pattern, not exhaustively list every possible issue.
- Every review must contain exactly one focus pattern.
- The focus correction uses hint-before-answer. Show a hint first, then reveal the model answer only after user attempt or explicit reveal.
- Every review must include positive evidence through at least one concrete `What you did well` item.
- Reference rewrite must support noticing-the-gap, not just show a native version.
- D+1 rewrite practice is a core differentiator; the product must not feel like a one-off correction tool.
- The next learning-system proof is delayed pattern transfer: a learner repairs a focus pattern, then later uses the same pattern correctly in a new context.
- Task completion, evaluator outcome, and learning evidence state are separate concepts.

## Prove Pattern Transfer

Inkline's learning path should be judged by whether a focus pattern transfers, not by whether the learner merely completed activity.

Evidence semantics:

| Evidence | Meaning |
| --- | --- |
| Task `completed` | The learner submitted something; this is not learning success. |
| D+1 `correct` | The learner repaired the original sentence once. |
| D+3 `correct` | The learner transferred the pattern once in a delayed new context. |
| D+7 `correct` | The pattern is stable after spaced reuse. |
| `partly_correct` | Progress feedback only; do not advance stage. |
| `incorrect` | Unsuccessful attempt; keep retry/recovery possible without shaming copy. |
| Valid alternative | Natural expression can be praised, but target-pattern transfer is not shown. |

Recommended user-facing evidence labels:

```text
Needs repair
Repaired once
Transferred once
Stable after spaced reuse
```

Do not show `mastered` in transfer-evidence or lifecycle copy. Lifecycle labels should stay descriptive and non-gamified.

Progress derives a read model from saved patterns, D+1 repair tasks, D+3/D+7 new-context reuse tasks, and rewrite checks. It should show lifecycle as the primary current status (`repair_needed`, `repair_in_progress`, `ready_for_transfer`, `transfer_in_progress`, `stabilizing`, `stable`, or `needs_attention`), keep the evidence label visible, and show the latest D+1 repair plus latest D+3/D+7 transfer context when present. Review count remains separate from learning evidence. `skipped`, `snoozed`, `expired`, `partly_correct`, and `incorrect` are useful context, not advancement; weak latest D+3/D+7 outcomes can require attention without erasing an earlier earned transfer/stability stage.

## Drill Center Foundation

The first Drill Center is a focused entry point over existing durable learning assets, not a separate drill engine.

Contracts:

- The Drills page reads active `ErrorPatternSnapshot` data from `listErrorPatterns()` through the existing renderer query hook.
- The page reads the current actionable practice slot from `WritingAttemptSnapshot.pendingRewritePractice`; v0.1 of Drill Center must not query or render a separate drill queue.
- `Open Practice` is available only when `pendingRewritePractice.id` matches the pattern evidence task id at `evidence.latestRepair.rewriteTaskId` or `evidence.latestTransfer.rewriteTaskId`.
- `Open Progress` is the route for evidence context and merge/de-dup cleanup.
- Cards may summarize lifecycle, evidence stage, latest D+1 repair, and latest D+3/D+7 transfer context, but Practice remains the surface that owns the rewrite input and evaluator actions.
- D+3/D+7 cards should identify transfer or spaced reuse without exposing original-sentence repair UI or native reference-answer framing.
- Drill Center must not create ad-hoc rewrite tasks, add rewrite task kinds, call model providers, add database tables, or advance evidence directly.
- User-facing copy must not use scores, streaks, `mastery`, or `mastered`. `correct` is the only strong repair/transfer signal; `completed`, `partly_correct`, `incorrect`, `skipped`, `snoozed`, `expired`, `failed`, and `retryable` stay visible as context.

Sort first by current pending-practice match, then `needs_attention`, `needs_repair`, `repaired_once`, `transferred_once`, stable patterns, and finally recent update/count tie-breakers.

Tests required:

- Empty, loading, and error states.
- Current D+1 repair match renders `Open Practice`.
- Non-matching pending practice does not render `Open Practice`.
- D+3 and D+7 current transfer wording.
- Retryable or weak checks are context rather than success.
- Stable patterns avoid `mastery` and `mastered` wording.

## Scenario: Practice Entry and Template Flow

### 1. Scope / Trigger

- Trigger: Any task that changes the main entry page, template picker, writing editor state, starter prompt controls, review entry point, or rewrite practice panel.
- Practice is the product entry. Journal, CET-4 Writing, CET-6 Writing, and Free Writing are equal templates, not separate product modes.

### 2. Signatures

Template IDs:

```ts
type WritingTemplateId = 'journal' | 'cet4' | 'cet6' | 'free';
```

Main renderer surfaces:

```text
PracticeHeader
PracticeTemplatePicker
WritingEditorCard
LearningPanel
ReviewDisclosureDialog(mode = 'starter' | 'review')
```

Writing actions:

```ts
window.api.writing.getCurrentAttempt(): Promise<WritingAttemptSnapshot>;
window.api.writing.getWritingAttempt({ templateId }): Promise<WritingAttemptSnapshot>;
window.api.writing.saveWritingAttempt({ templateId, content, userGoal }): Promise<SaveWritingAttemptResult>;
window.api.writing.generateStarterPrompt({ templateId, userGoal }): Promise<GenerateStarterPromptResult>;
```

### 3. Contracts

- The product identity is `Inkline`; Journal, CET, and Free Writing must remain equal practice scenarios.
- A shell-level `Today` page may be the default launch surface when it routes users into writing practice instead of replacing Practice as the product identity.
- The picker shows Journal, CET-4 Writing, CET-6 Writing, and Free Writing as same-level cards.
- Template selection may primarily live on Today/Home, but the Write/Practice workbench must still show the current template and provide lightweight switching.
- Lightweight switching may be collapsed or subtle by default, but must still call `getWritingAttempt({ templateId })` when the user changes scenario.
- Before switching templates, persist the current template's unsaved content and optional goal/topic so the current draft is not lost.
- Selecting a template loads that template's current attempt and resets review preview/progress state for the previous template.
- Each template preserves one current draft.
- Every template supports starter prompt/topic generation, regenerate, retry after failure, and skip.
- Starter prompt/topic and optional goal/topic controls may be collapsed by default to protect independent writing, but generation, regenerate, retry, skip, and goal editing must remain reachable in the Practice workbench.
- Users may provide an optional goal/topic whether or not they generate a starter prompt.
- Autosave freshness includes both writing content and optional goal/topic; changing only the goal/topic must still persist the writing attempt.
- Before generating a starter prompt/topic, persist any unsaved content or goal/topic so the attempt state and provider context are fresh.
- CET editor surfaces must not show timers, word-count targets, precise scores, or mock-exam UI in v0.1.
- Review input is template-aware and includes generated prompt/topic and user goal/topic when present.
- The writing editor stays independent: no in-editor co-writing or live suggestions.
- The Write/Practice workbench must show the selected template only once near the editor chrome, not both above the prompt title and again near the editor. Preferred label order: `<template.title> Change | Draft`.
- The selected-template switcher belongs beside the editor `Draft` label as weak secondary UI. Do not place a separate `Journal Change`/template row between the prompt title and editor.
- While `reviewState === 'reviewing'`, review progress must be an always-visible inline LearningPanel section, not nested `details`, a card stack, or an alert.
- Reviewing progress shows one `Reviewing` label, the current phase, a short description, and the five compact step labels: `Read`, `Open coach`, `Find pattern`, `Check`, `Prepare`.
- Reviewing progress duration is displayed only on the active step row, updated about once per second from the latest `started` event for that phase. Do not also show total elapsed time in the section heading or current-phase title.
- Slow-provider reassurance may appear after 15 seconds, but only as muted helper text. Do not use alert styling for normal waiting.

### 4. Validation & Error Matrix

| Condition | Behavior |
| --- | --- |
| User selects a new template | Load `getWritingAttempt({ templateId })`; clear stale review preview/progress and starter generation error. |
| User edits only optional goal/topic | Autosave `saveWritingAttempt({ templateId, content, userGoal })`; do not wait for draft text changes. |
| User starts starter generation with unsaved edits | Save the current content and user goal/topic first, then call `generateStarterPrompt({ templateId, userGoal })`. |
| Starter prompt generation is skipped | Keep editor usable; review may still include optional `userGoal`. |
| Starter prompt generation fails | Show error with Retry; do not use local fallback topics. |
| Starter prompt disclosure not accepted | Show disclosure; do not call provider. |
| User edits content after review | Mark old review stale and offer review-current-version action. |
| Review preview is ready while user is in Practice | Keep the Practice workspace editor-first; show a short ready state plus an explicit action to open the focused Feedback & Rewrite page. Do not auto-route or render a heavy inline review preview. |
| User reviews non-Journal template | Review, preview, save, and post-action refresh remain on that template. |
| Write workbench renders selected template context | Render template context once as weak editor chrome before `Draft`; do not duplicate it above the prompt title. |
| Review is in progress | Show inline progress immediately; active step duration updates once per second and appears only in the active step row. |
| Review provider takes longer than 15 seconds | Show muted helper text such as `Taking longer than usual — you can keep writing.`; do not show an alert. |

### 5. Good/Base/Bad Cases

- Good: User lands on Today, selects CET-6, enters Write/Practice, generates an English topic, writes independently, reviews, saves, and remains in CET-6 after save.
- Base: User picks Free Writing, skips generation, enters a goal, writes, and reviews with goal context.
- Base: User edits only the optional goal/topic and sees it preserved after switching away and back.
- Base: User switches from Journal to CET-4 and back; each draft is preserved.
- Good: In the Write workbench, the prompt title is followed by editor chrome reading `Journal Change | Draft`, with no second `Journal` label above or below the title.
- Good: During review, the coach panel shows compact inline progress and only the active step row displays a live duration.
- Bad: Template picker visually or structurally makes Journal or CET dominate the product identity.
- Bad: Editor says `journal entry` while the selected template is CET or Free Writing.
- Bad: Starter generation is mandatory before writing.
- Bad: The app calls starter generation using stale attempt state after the user changed the draft or goal/topic.
- Bad: The workbench shows `Journal` above the prompt title and `Journal Change` again above `Draft`.
- Bad: Review progress is hidden behind nested disclosures or shows total elapsed time plus per-step time in multiple places.

### 6. Tests Required

- Template selection test: switching templates loads distinct attempts and preserves drafts.
- Optional goal/topic autosave test: changing only `userGoal` persists through `saveWritingAttempt({ templateId, content, userGoal })`.
- Starter prompt freshness test: unsaved content/goal is saved before `generateStarterPrompt({ templateId, userGoal })` runs.
- Starter prompt state test: disclosure, generate, regenerate, retry, and skip states behave correctly.
- Review context test: non-Journal template review includes template context and stays on selected template after preview/save.
- Review progress UI test: when review starts, progress is visible without expanding disclosures; only the active step row shows a duration; after one second the active duration changes.
- Regression/manual test: Journal write -> review -> save -> D+1 rewrite remains available through the Journal template.
- Manual UI smoke: Today -> template picker -> Write, starter disclosure, generate/regenerate, skip, optional goal, editor autosave, review, save review, due D+1 rewrite practice.
- Manual UI smoke: Write workbench title area has no duplicated template label and reads `<template.title> Change | Draft` before the textarea.

### 7. Wrong vs Correct

#### Wrong

```tsx
<h1>Today's Journal</h1>
<JournalEditor />
<button>Review journal entry</button>
```

This makes Journal the product identity and leaks old assumptions into CET/Free Writing.

#### Correct

```tsx
<PracticeHeader practicePromptTitle={practicePromptTitle} />
<WritingEditorCard
  template={writing.template}
  templates={WRITING_TEMPLATES}
  selectedTemplateId={selectedTemplateId}
/>
<button>Review current writing</button>
```

Practice is the product entry, the selected template supplies scenario-specific framing, and the template switcher stays in weak editor chrome beside `Draft` instead of duplicating labels around the prompt title.

## Review Preview Flow

Default review surfaces should stay focused on:

```text
1. Overall coach note with positive evidence
2. Exactly one focus pattern
3. Focus correction hint
4. User self-repair attempt / reveal model
5. Reference rewrite + Notice the gap when available
6. Save-review boundary
```

Secondary review details, additional corrections, technical review metadata, and scheduled rewrite-practice details should be behind a low-priority disclosure unless a task explicitly asks for a denser diagnostic view. D+1 rewrite practice remains part of the product contract, but it must not compete with independent writing in the default workspace.

The primary save button must communicate the consequence:

```text
Save review and update learning history
```

Do not use a vague `Save` label for the review-save action.

## Review Save Behavior

- Review output remains preview-only until the user saves it.
- Pattern counts, rewrite practice, reference rewrite, and self-repair attempts are persisted only after save.
- If the user edits the writing after a review is saved, the old review becomes stale relative to the active revision.
- A stale review may remain visible as history, but current highlighting must be driven only by the active saved review.
- Applying the saved focus correction is a separate user-approved action after save. It must create a new draft revision, stale the source review, and clear current-review pointers instead of mutating the reviewed revision or provider output.

Stale review copy:

```text
This review is based on an earlier version of your writing.
Review current version
```

## Correction Presentation

Each correction must show at least:

```text
Pattern: <rule>
You wrote: <original>
Try: <corrected>
Why: <explanation>
```

Correction categories in the UI:

- Fix: there is an error.
- Upgrade: not wrong, but more natural.
- Model: reference expression, not required to copy.

v0.1 does not enable upgrade opportunities. Do not mix upgrade opportunities into the correction list.

## Sorting Corrections

Sort by learning priority:

1. Recurring + high learning value.
2. Meaning-affecting errors.
3. Common grammar/collocation issues.
4. Style upgrade.
5. Spelling.

Low-confidence corrections are folded into `Other suggestions`; they do not update pattern count or generate rewrite practice.

## Rewrite Practice

v0.1 shows at most one D+1 `rewrite_original` practice from a saved review. It can appear in Practice but must not block new writing.

A rewrite practice includes:

- Original sentence.
- Focus pattern.
- Input field.
- Skip action.
- Snooze action for deferring the task by one day without changing learning evidence.

Rewrite-check is completed baseline behavior for submitted D+1 rewrites. The remaining rewrite-practice roadmap expands lifecycle and transfer semantics rather than reopening rewrite-check scope.

Lifecycle semantics:

- `pending`: the task is due or waiting.
- `in_progress`: the learner is working on the task.
- `completed`: the learner submitted; this does not imply learning success.
- `skipped`: the learner intentionally abandoned this practice opportunity; not success.
- `snoozed`: the learner deferred the task by changing `dueAt`; no mastery impact.
- `expired`: the task is too stale to keep pushing; not a language failure, but the review window was missed.

Retry semantics:

- `partly_correct` and `incorrect` do not advance spaced stage.
- Learner recovery after a completed `partly_correct` or `incorrect` outcome stays within the same rewrite task and creates additional `rewrite_checks` attempts through `completeRewritePractice` with revised text.
- Provider retry for `failed` or `retryable` evaluator attempts stays on `retryRewriteCheck` and reuses the saved rewrite text.
- The first transfer-evidence version should not create a separate retry/drill task.
- The current evidence state is derived from the latest completed check while preserving attempt history for diagnostics.

## Scenario: Rewrite-Check Evaluator, Retry, and Feedback UI

### 1. Scope / Trigger

- Trigger: Any task that changes D+1 rewrite submit, rewrite-check retry, `rewrite_checks` persistence, shared writing IPC/types, persisted rewrite-check result display, or renderer cache handling for rewrite-check responses.
- Rewrite-check is baseline behavior for the completed D+1 milestone; this scenario does not imply the full rewrite queue, mastery transitions, or D+3/D+7 reuse.
- Rewrite-check UI is a learning feedback surface, not a correction-application flow. The user's submitted rewrite remains their text.

### 2. Signatures

Renderer/main API:

```ts
window.api.writing.completeRewritePractice(input: {
  rewriteTaskId: string;
  userRewriteText: string;
}): Promise<RewritePracticeUpdateResult>;

window.api.writing.retryRewriteCheck(input: {
  rewriteTaskId: string;
}): Promise<RetryRewriteCheckResult>;
```

Renderer state/cache helpers:

```ts
updateRewritePracticeCache(
  queryClient: QueryClient,
  result: RewritePracticeUpdateResult | RetryRewriteCheckResult,
): void;
```

Shared snapshots:

```ts
type RewriteCheckStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'retryable';
type RewriteCheckOutcome = 'correct' | 'partly_correct' | 'incorrect';

type RewriteCheckSnapshot = {
  id: string;
  rewriteTaskId: string;
  status: RewriteCheckStatus;
  outcome: RewriteCheckOutcome | null;
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

Database fields:

```text
rewrite_tasks.user_rewrite_text     saved user submission
rewrite_tasks.status                completed after submit, independent of check outcome
rewrite_checks.status               pending | in_progress | completed | failed | retryable
rewrite_checks.outcome              correct | partly_correct | incorrect | null
rewrite_checks.feedback             concise user-facing feedback
rewrite_checks.provider/model       provider metadata when available
rewrite_checks.validation_errors_json bounded validation/error details
rewrite_checks.error_message        safe user-facing retry/failure copy
rewrite_checks.diagnostics_json     redacted provider diagnostics only
rewrite_checks.created_at/updated_at/completed_at Unix milliseconds
```

### 3. Contracts

- `completeRewritePractice` trims and validates non-empty `userRewriteText`.
- Submit must persist `rewrite_tasks.user_rewrite_text` and set the task status to `completed` before the evaluator call starts.
- A completed rewrite task is recoverable only when its latest completed check outcome is `partly_correct` or `incorrect`; recovery updates the saved rewrite text, refreshes `completed_at`, and appends a new `rewrite_checks` attempt on the same task.
- Completed tasks whose latest completed check outcome is `correct`, plus skipped or expired tasks, remain no-op for `completeRewritePractice`.
- The evaluator prompt includes the original sentence, focus pattern, native model sentence, practice prompt, and submitted rewrite. Treat all task/user text as delimited untrusted content and require structured JSON output.
- A successful evaluator attempt writes one `rewrite_checks` row with `status: 'completed'`, non-null `outcome`, feedback, provider/model metadata when available, and no validation errors.
- Provider configuration, network, timeout, or invalid model-output failures must still create/update a `rewrite_checks` row with `status: 'retryable'`, `outcome: null`, a safe `errorMessage`, and bounded redacted diagnostics.
- `RewritePracticeSnapshot.latestRewriteCheck` exposes the newest check state needed by the renderer after submit, skip, retry, or refresh.
- `retryRewriteCheck` must reuse saved `rewrite_tasks.user_rewrite_text`; it must not ask the renderer to resubmit text. Each retry creates a new `rewrite_checks` attempt.
- `incorrect` completes the D+1 task but records unsuccessful learning. `partly_correct` is visible progress, not mastery success. Only `correct` is the strong success signal for D+3 transfer generation.
- D+1 `correct` means original repair succeeded; it does not yet prove delayed transfer. D+3 and D+7 transfer tasks branch evaluator semantics by `rewrite_tasks.kind` and `spacedStage`; D+7 uses stage-aware spaced-reuse context and does not generate later tasks.
- First-version submit is synchronous: save rewrite, run evaluator, persist completed/retryable attempt, then return the updated snapshot. Do not add workers or polling unless a future PRD changes the contract.
- While submit or retry is pending, disable rewrite input, submit, skip, and retry controls for that card.
- A saved submitted rewrite may have `status: 'completed'` even when `latestRewriteCheck.outcome` is `partly_correct`, `incorrect`, or unavailable after evaluator failure.
- The native model sentence remains hidden before a saved submit, then becomes visible once `status === 'completed'` and `userRewriteText` exists.
- Completed check outcomes render as annotation-only feedback:
  - `correct`: encouraging concise copy.
  - `partly_correct`: progress-oriented copy; do not claim mastery.
  - `incorrect`: actionable copy; do not reopen/delete the completed attempt.
- Retryable/failed checks explain that the rewrite was saved and expose retry.
- `RetryRewriteCheckResult` handling must tolerate partial success payloads. If `writing` is absent but `rewritePractice` is present, patch cached attempts by `rewritePractice.id`. If only `rewriteCheck` is present, patch the cached pending/completed rewrite whose id matches `rewriteCheck.rewriteTaskId`.

### 4. Transfer Contracts

D+3/D+7 new-context reuse follows these staged transfer contracts:

- Review/save generates only the D+1 original-repair task.
- Generate D+3 only after D+1 rewrite-check returns `correct`.
- Generate D+7 only after D+3 new-context reuse returns `correct`.
- Do not generate any post-D+7 task.
- Do not batch-create future spaced tasks at review-save time.
- Represent D+3/D+7 as `rewrite_tasks.kind = 'new_context_reuse'` with `spacedStage = 'D+3' | 'D+7'`.
- Keep D+1 original repair as `rewrite_original`.
- New-context prompts must be short writing tasks in a new scenario, not original-sentence rewrites or mechanical fill-in drills.
- Store hidden prompt contracts for new-context tasks: `targetMeaning`, `allowedHints`, `forbiddenHints`, and `expectedPatternFamily`.
- Visible prompts must not contain target expressions, target collocations, or original-keyword leakage from `forbiddenHints`.
- Transfer evaluator internals may store `usedTargetPattern`, `preservedRequiredMeaning`, `naturalInContext`, `containsForbiddenLeakage`, `usedValidAlternative`, and `reasonCode`.
- Valid alternative wording should receive positive feedback but should not advance target-pattern transfer evidence.

### 5. Validation & Error Matrix

| Condition | Behavior |
| --- | --- |
| `userRewriteText` is empty after trim | Return `{ success: false, error }`; do not create a check attempt. |
| `rewriteTaskId` is unknown | Return `{ success: false, error: 'Rewrite practice was not found.' }`. |
| Submit receives a pending/in-progress task | Save trimmed rewrite text, mark task `completed`, then run evaluator synchronously. |
| Submit receives a completed task whose latest completed check is `partly_correct` or `incorrect` | Save the revised text on the same task, update `completed_at`, create a new check attempt, and return the updated snapshot. |
| Submit receives a completed task whose latest completed check is `correct` | Return current writing/practice snapshot; do not create another check attempt. |
| Submit receives a skipped or expired task | Return current writing/practice snapshot; do not create another check attempt. |
| Submit mutation is pending | Disable rewrite input and actions; show checking copy. |
| Persisted check status is `pending` or `in_progress` | Treat the card as checking even after renderer reload. |
| Evaluator returns `correct`, `partly_correct`, or `incorrect` with feedback | Persist `rewrite_checks.status = 'completed'`, outcome, and feedback; expose it as `latestRewriteCheck`. |
| Completed check outcome is `correct` | Show concise positive feedback without changing user rewrite text. |
| Completed check outcome is `partly_correct` | Show progress feedback without presenting it as mastery success. |
| Completed check outcome is `incorrect` | Show actionable feedback while keeping the attempt completed. |
| Provider config/key, network, or timeout failure | Preserve saved rewrite, persist `status = 'retryable'`, and expose retryable latest-check failure copy. |
| Evaluator output fails schema validation | Preserve saved rewrite, persist `status = 'retryable'` with validation errors and safe retry copy. |
| Check status is `failed` or `retryable` | Say the rewrite was saved, show safe error/fallback copy, and offer retry. |
| Retry runs before any rewrite text is saved | Return `{ success: false, error }`; do not call the evaluator. |
| Retry evaluator succeeds/fails | Create a new `rewrite_checks` row and return that row plus the updated practice snapshot. |
| Retry succeeds with only `rewriteCheck` | Update the matching cached rewrite task's `latestRewriteCheck`; do not show a false retry error. |
| Retry/submit returns `success: false` | Keep existing rewrite state visible and show the returned safe error. |

### 6. Good/Base/Bad Cases

- Good: User submits a D+1 rewrite, sees `Checking rewrite...`, then sees native model plus `correct` feedback while their rewrite text remains unchanged.
- Good: User submits `I went home.`; the app saves that text, evaluator returns `correct`, `latestRewriteCheck.outcome` is `correct`, and future mastery logic can treat it as a strong success signal.
- Base: User submits a partially repaired rewrite; the task is completed, `latestRewriteCheck.outcome` is `partly_correct`, and UI can show progress without counting mastery.
- Base: Provider times out after the rewrite is saved; `latestRewriteCheck.status` is `retryable`, the user text remains visible, and retry uses the saved text.
- Base: Retry returns only a fresh `rewriteCheck`; the renderer patches the existing rewrite card by `rewriteTaskId` and updates feedback.
- Bad: The service calls the evaluator before saving `userRewriteText`, so a provider failure loses the user's answer.
- Bad: `incorrect` leaves the task pending, reopens the task, clears the user's submitted rewrite, or hides the native model after save.
- Bad: Retry requires the renderer to send the rewrite text again, allowing UI/server state drift.
- Bad: Retry succeeds but the UI shows `Unable to retry rewrite check` because the response omitted a full writing snapshot.

### 7. Tests Required

- Service test: submit persists trimmed `userRewriteText` before the evaluator mock executes.
- Service tests: `correct`, `partly_correct`, and `incorrect` each persist a completed `rewrite_checks` row and expose `latestRewriteCheck`.
- Failure tests: provider/config/network/timeout failure preserves the rewrite and persists a retryable check with redacted diagnostics.
- Validation test: invalid evaluator output persists a retryable check with validation errors and no outcome.
- Retry test: retry after failure reuses saved `userRewriteText`, creates a second check attempt, and returns the latest check.
- Recovery tests: completed `partly_correct` and `incorrect` checks can be revised through `completeRewritePractice`, append check attempts, update saved text, and preserve the same rewrite task.
- Recovery tests: completed `correct`, skipped, and expired tasks do not create recovery checks.
- Recovery tests: D+1 and D+3 weak outcomes recovered to `correct` generate D+3/D+7 exactly once; D+7 recovery to `correct` advances evidence without creating later tasks.
- Contract test: shared schemas reject completed checks without outcomes and non-completed checks with outcomes.
- Renderer query/cache tests assert completion results write persisted `latestRewriteCheck` feedback into the template-scoped cache.
- Renderer query/cache tests assert retry results update cached rewrite feedback when the response includes `writing` and `rewritePractice`.
- Renderer query/cache tests assert retry results update cached rewrite feedback when the response includes only `rewriteCheck`.
- Regression tests: existing review save and rewrite practice tests still pass.
- UI/manual smoke should cover checking, `correct`, `partly_correct`, `incorrect`, retryable failure, and native-model reveal after submit.

### 8. Wrong vs Correct

#### Wrong

```ts
const check = await evaluateRewriteCheck(task, input.userRewriteText);
await db.update(rewriteTasks).set({ userRewriteText: input.userRewriteText }).where(eq(rewriteTasks.id, task.id));
return { success: true, rewriteCheck: check };
```

This can lose the user's answer when the provider fails and makes retry depend on renderer state.

#### Correct

```ts
const updatedTask = db
  .update(rewriteTasks)
  .set({ status: 'completed', userRewriteText: input.userRewriteText.trim(), completedAt: new Date() })
  .where(eq(rewriteTasks.id, task.id))
  .returning()
  .get();

await evaluateRewriteCheck(updatedTask, updatedTask.userRewriteText ?? input.userRewriteText.trim());
return { success: true, rewritePractice: rewriteTaskToSnapshot(updatedTask) };
```

The saved rewrite is durable before evaluation, and `rewriteTaskToSnapshot` exposes the persisted latest-check state.

#### Wrong

```tsx
if (result.success && result.writing) {
  updateWritingAttemptCache(queryClient, result.writing);
} else {
  setRewritePracticeError('Unable to retry rewrite check.');
}
```

This treats a successful partial retry response as a failure and leaves persisted feedback stale.

#### Correct

```tsx
if (result.success && result.rewriteCheck?.rewriteTaskId === rewritePractice.id) {
  setCompletedRewritePractice({
    ...rewritePractice,
    latestRewriteCheck: result.rewriteCheck,
  });
}
```

The renderer accepts the narrow successful retry payload and patches the matching rewrite card without replacing the user's rewrite.
