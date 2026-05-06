# Implement Evidence Model and Mastery-Aware Progress

## Goal

Implement the next PR #25 roadmap slice after rewrite lifecycle: derive lightweight learning-evidence states for saved patterns and show the evidence chain in Progress so learners can see whether a pattern still needs repair or has been repaired once, without claiming mastery or introducing D+3/D+7 generation.

## Source

- GitHub PR #25: `Refresh roadmap evidence semantics`, merged as `809b080`.
- Completed prerequisite: `05-06-rewrite-task-lifecycle`, committed as `2eabcd5`.
- Roadmap milestone: `Milestone 3: Evidence Model and Mastery-Aware Progress`.

## What I Already Know

- Existing `error_patterns` power the Progress page through `window.api.learningAssets.listErrorPatterns()`.
- Existing `corrections.pattern_id` links saved corrections back to durable `error_patterns`.
- Existing D+1 rewrite tasks link to review runs through `rewrite_tasks.review_run_id`, but do not store `pattern_id` directly.
- Existing rewrite-check attempts link to rewrite tasks through `rewrite_checks.rewrite_task_id`.
- Existing code can derive D+1 evidence by joining saved pattern corrections for a review run to D+1 rewrite tasks and their latest completed check.
- The current Progress page shows counts, recent examples, and last seen date, but not learning evidence stage.
- D+3/D+7 tasks do not exist yet, so this milestone should usually display only `Needs repair` or `Repaired once` from current data.

## Requirements

- Extend the learning-assets pattern snapshot with derived evidence fields.
- Derive evidence from existing local SQLite data; do not add migrations or stored evidence columns in this first version.
- Keep task lifecycle, evaluator outcome, and evidence stage separate.
- Show learner-facing evidence chain in Progress.
- Keep `partly_correct`, `incorrect`, skip, snooze, and expiry visible as context but not advancement.
- Preserve existing pattern count and recent example behavior.

## Evidence Semantics

- `Needs repair`: no relevant latest completed D+1 `correct` check exists for the pattern.
- `Repaired once`: at least one D+1 `rewrite_original` task tied to the pattern has a latest completed check with `outcome = 'correct'`.
- `Transferred once`: reserved for future D+3 `new_context_reuse` correct evidence.
- `Stable after spaced reuse`: reserved for future D+7 `new_context_reuse` correct evidence.
- `partly_correct` and `incorrect` remain visible feedback/context and do not advance the stage.
- `completed`, `skipped`, `snoozed`, and `expired` rewrite task statuses are lifecycle context only.

## Product Decisions

- This task derives a read model at query time inside `listErrorPatterns`; it does not persist an evidence state column.
- Because rewrite tasks currently lack `pattern_id`, the first implementation links pattern evidence through `corrections.pattern_id` for the same `review_run_id` as a D+1 rewrite task.
- If a review run has multiple saved corrections linked to patterns, only the focus D+1 rewrite task should count for the pattern associated with that review's focus correction where derivable from existing saved data.
- Progress copy must avoid words such as `mastered`, score, streak, level, or success count.
- The UI can show a compact evidence label, current stage explanation, and latest relevant task/check context.

## API / Contract Requirements

- Add shared Zod schemas/types for pattern evidence stage and optional evidence summary on `ErrorPatternSnapshot`.
- Preserve backwards-compatible list behavior: existing consumers still receive all previous fields.
- `listErrorPatterns()` should return patterns sorted as today unless a clearer local convention already exists.
- Timestamps crossing IPC stay Unix milliseconds.

## UI Requirements

- Progress cards show the evidence label prominently enough to explain current learning state.
- Progress should distinguish `seen count` from learning evidence; count is not success.
- Progress should show learner-friendly context for the most recent relevant D+1 lifecycle/check state when available.
- Empty/loading/error states remain unchanged.
- The page must remain quiet, scannable, and not gamified.

## Acceptance Criteria

- [x] `ErrorPatternSnapshot` includes a typed evidence summary.
- [x] `listErrorPatterns()` derives `Needs repair` for patterns with no D+1 `correct` latest completed check.
- [x] `listErrorPatterns()` derives `Repaired once` for patterns with D+1 latest completed `correct` evidence.
- [x] `partly_correct`, `incorrect`, `skipped`, `snoozed`, and `expired` do not advance the evidence stage.
- [x] Progress UI displays the evidence label and separates it from count/recency.
- [x] No D+3/D+7 tasks are generated.
- [x] No pattern fingerprint, hidden prompt contract, or transfer evaluator work is implemented.
- [x] Focused service/shared/UI tests cover the new read model and rendering-facing contract.

## Out of Scope

- D+3/D+7 `new_context_reuse` generation.
- Pattern fingerprint persistence.
- Hidden transfer prompt contracts.
- Transfer evaluator diagnostics.
- Full mastery lifecycle or `mastered` wording.
- Gamified scores, streaks, levels, or badges.
- Database migrations unless implementation discovers a hard blocker.

## Definition of Done

- Implementation follows PR #25 product specs.
- Evidence derivation is covered by tests.
- Existing Progress and learning-assets behavior remains compatible.
- `pnpm check` passes.
- Spec update judgment is completed after implementation.

## Technical Notes

- Likely touchpoints:
  - `src/shared/types/learning-assets.ts`
  - `src/main/services/learning-assets/service.ts`
  - `src/renderer/App.tsx`
  - learning-assets / renderer tests, likely existing `test/review-integration.test.ts` or a new focused test.
- Relevant existing specs:
  - `.trellis/spec/product/roadmap.md`
  - `.trellis/spec/product/learning-flow.md`
  - `.trellis/spec/product/data-model-contract.md`
  - `.trellis/spec/product/validation-and-testing.md`
- Final automated verification passed with `pnpm check`: format, lint, typecheck, unit tests, and review harness.
- Spec update completed: `.trellis/spec/product/data-model-contract.md` records the concrete derived evidence read model and cache invalidation requirement.
