# Implement Weak Outcome Rewrite Recovery

## Goal

Implement the remaining PR #25 Horizon 1 recovery slice: when a rewrite or new-context reuse check returns `partly_correct` or `incorrect`, let the learner revise their answer and check again within the same `rewrite_tasks` row. Each recovery attempt should append a new `rewrite_checks` record, preserve history, and only advance D+3/D+7/Progress evidence when a later check returns `correct`.

## Source

- GitHub PR #25: `Refresh roadmap evidence semantics`, merged as `809b080`.
- Completed prerequisites:
  - `2eabcd5` rewrite task lifecycle.
  - `c5a0989` derived pattern evidence Progress.
  - `a76a917` pattern fingerprint persistence.
  - `9a001a6` D+3 new-context reuse tasks.
  - `0738a93` D+7 new-context reuse tasks.
- Roadmap horizon: `Horizon 1: Complete the Learning Loop`, item `Basic recovery/retry semantics for partly_correct and incorrect attempts`.

## What I Already Know

- `retryRewriteCheck` already exists, but it re-checks saved `rewrite_tasks.user_rewrite_text`; it is suited to provider/retryable failures, not learner revision after a weak answer.
- `completeRewritePractice` currently treats completed rewrite tasks as terminal and returns the current snapshot without creating another check.
- Renderer copy shows completed `partly_correct` / `incorrect` feedback, but does not expose a revision path.
- Current App state clears `completedRewritePractice` on rewrite input changes, which would hide a completed card if we allow revision editing from that card.
- D+3/D+7 generation already runs from check results after submit/retry, so a corrected recovery attempt should be able to trigger the next staged task.

## Assumptions

- Recovery should reuse the existing `completeRewritePractice` input/result surface instead of adding a new IPC command.
- Provider retry stays separate: `retryRewriteCheck` remains the path for retryable/failed evaluator calls using saved text.
- Learner recovery should update the task’s saved `userRewriteText` to the latest submitted revision while preserving old check rows for history.
- We do not need a normalized attempt-version table in this first slice; `rewrite_checks` history plus latest saved text is enough.

## Requirements

- Treat a completed task with latest completed outcome `partly_correct` or `incorrect` as recoverable.
- Allow `completeRewritePractice` to accept a revised non-empty `userRewriteText` for recoverable tasks and create a new `rewrite_checks` attempt.
- Do not allow revision resubmit after latest completed outcome `correct`.
- Do not allow revision resubmit for skipped or expired tasks.
- Preserve existing provider retry behavior for `failed` / `retryable` checks via `retryRewriteCheck`; do not force users to edit text for provider failures.
- A recovery submit should:
  - trim and persist the new `userRewriteText`;
  - keep task status `completed`;
  - update `completedAt` to the latest submit time;
  - append a new rewrite-check attempt;
  - return the updated practice snapshot with the latest check.
- If a recovery check returns `correct`, reuse the existing staged generation rules:
  - D+1 recovery `correct` may create D+3.
  - D+3 recovery `correct` may create D+7.
  - D+7 recovery `correct` advances evidence but does not generate later tasks.
- If recovery returns `partly_correct` or `incorrect`, stay in the same task and keep revision available.
- Renderer should keep the completed/recoverable card visible while the learner edits a revised answer.
- Renderer should expose clear action copy for recoverable outcomes:
  - D+1: revise and check again.
  - D+3/D+7: revise new-context answer and check again.
- Recovery UI must not show mastery/gamified copy, hidden prompt contracts, fingerprint internals, or raw diagnostics.
- Progress evidence must continue to derive only from latest completed `correct` outcomes for each stage; weak recovery attempts must not advance evidence.

## Acceptance Criteria

- [x] `completeRewritePractice` appends a new check for completed tasks whose latest completed outcome is `partly_correct`.
- [x] `completeRewritePractice` appends a new check for completed tasks whose latest completed outcome is `incorrect`.
- [x] Revision recovery updates `rewrite_tasks.user_rewrite_text` to the latest submitted text and keeps check history.
- [x] Completed `correct`, skipped, and expired tasks do not create recovery checks.
- [x] Retryable/failed provider checks continue to use `retryRewriteCheck` with saved text.
- [x] A D+1 weak outcome recovered to `correct` can create D+3 exactly once.
- [x] A D+3 weak outcome recovered to `correct` can create D+7 exactly once.
- [x] A D+7 weak outcome recovered to `correct` can advance Progress to `stable_after_spaced_reuse` without creating later tasks.
- [x] Renderer keeps the recoverable completed card visible while editing a revised answer.
- [x] Renderer copy distinguishes learner revision from provider retry and avoids mastery/gamified language.
- [x] Hidden prompt contracts, fingerprints, and diagnostics are not exposed in renderer UI or public snapshots.

## Out of Scope

- Separate rewrite-attempt or answer-version table.
- Creating retry tasks after weak outcomes.
- Automatic remediation prompts, hints, or AI coaching beyond existing feedback.
- Post-D+7 task generation.
- Transfer diagnostic persistence.
- Mastery lifecycle, scoring, streaks, or gamified UI.
- Editing original writing content or applying corrections automatically.

## Definition of Done

- Implementation follows PR #25 product specs.
- Focused service, renderer, query-cache, and Progress tests cover weak-outcome recovery.
- Existing D+1/D+3/D+7 generation and provider retry behavior remain compatible.
- `pnpm check` passes.
- Spec update judgment is completed after implementation.

## Verification Notes

- Implement/check agents completed and independently verified the weak-outcome recovery slice.
- Final local quality gate passed: `pnpm check`, Trellis context validation, and `git diff --check`.
- Spec update judgment completed: `learning-flow.md` and `data-model-contract.md` now define learner recovery through `completeRewritePractice` and provider retry through `retryRewriteCheck`.

## Technical Notes

- Likely touchpoints:
  - `src/main/services/writing/service.ts`
  - `src/renderer/App.tsx`
  - `src/renderer/components/LearningPanel.tsx`
  - `src/renderer/query/writing.ts`
  - `src/shared/types/writing.ts` if response shape needs clarifying
  - rewrite practice service tests, renderer/query tests, learning evidence tests.
- Relevant specs:
  - `.trellis/spec/product/roadmap.md`
  - `.trellis/spec/product/learning-flow.md`
  - `.trellis/spec/product/data-model-contract.md`
  - `.trellis/spec/product/review-agent-contract.md`
  - `.trellis/spec/product/validation-and-testing.md`
