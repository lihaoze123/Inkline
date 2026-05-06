# Implement D+7 New-Context Reuse Tasks

## Goal

Implement the second PR #25 Milestone 5 slice: after a learner gets a D+3 `new_context_reuse` rewrite-check outcome of `correct`, create one delayed D+7 `new_context_reuse` task using the same hidden transfer contract. When the D+7 task is later checked as `correct`, Progress should advance from `Transferred once` to `Stable after spaced reuse`.

## Source

- GitHub PR #25: `Refresh roadmap evidence semantics`, merged as `809b080`.
- Completed prerequisites:
  - `2eabcd5` rewrite task lifecycle.
  - `c5a0989` derived pattern evidence Progress.
  - `a76a917` pattern fingerprint persistence.
  - `9a001a6` D+3 new-context reuse tasks.
- Roadmap milestone: `Milestone 5: D+3/D+7 New-Context Reuse`.

## What I Already Know

- Review/save still creates only D+1 `rewrite_original`.
- D+3 generation now happens only after a completed D+1 `rewrite_original` check with outcome `correct`.
- D+3 tasks are `rewrite_tasks.kind = 'new_context_reuse'`, `spaced_stage = 'D+3'`, and carry hidden `prompt_contract_json`.
- D+3 evaluator prompts branch to transfer semantics using the hidden prompt contract.
- Shared writing schemas currently allow `spacedStage = 'D+1' | 'D+3'`; D+7 needs to be added.
- Progress currently advances to `transferred_once` after D+3 `new_context_reuse` latest completed outcome `correct`.

## Assumptions

- The user’s “continue” means continue the PR #25 roadmap in order.
- D+7 should reuse the D+3 hidden prompt contract or rebuild the same contract from the saved focus fingerprint; it must not reinterpret the pattern ad hoc.
- D+7 due date should be seven days after the successful D+3 check completes.
- If a D+3 task has no valid hidden prompt contract and no recoverable saved fingerprint, completing D+3 as `correct` should still succeed but should not generate D+7.

## Requirements

- Generate one D+7 `rewrite_tasks` row after a completed D+3 `new_context_reuse` check returns `correct`.
- Also generate D+7 when `retryRewriteCheck` produces the first D+3 `correct` outcome.
- Do not generate D+7 for D+3 `partly_correct`, `incorrect`, retryable/failed checks, skipped tasks, expired tasks, D+1 tasks, or unrelated task kinds.
- Make D+7 generation idempotent; repeated terminal returns and repeated correct retries must not duplicate the D+7 task.
- D+7 tasks must use:
  - `kind = 'new_context_reuse'`
  - `spacedStage = 'D+7'`
  - `status = 'pending'`
  - hidden `prompt_contract_json`
  - visible prompt copy that avoids hidden contract/fingerprint leakage.
- D+7 visible prompt must be a short new-context writing task, not an original-sentence rewrite, blank-fill drill, or copied target expression.
- D+7 visible prompt must not contain any forbidden hints/leakage terms from the hidden prompt contract.
- D+7 evaluator prompt should use the same transfer semantics branch as D+3, with stage-aware copy.
- D+7 task lifecycle should reuse existing skip/snooze/expire/complete/retry behavior.
- Shared writing schemas/types must allow `spacedStage: 'D+7'`.
- Renderer copy should distinguish D+7 new-context reuse from D+1 original rewrite and avoid showing “Original” / “Reference sentence” for D+7.
- Progress evidence should advance to `stable_after_spaced_reuse` only after a completed D+7 `new_context_reuse` check has outcome `correct`.
- Do not generate any later task after D+7.

## Acceptance Criteria

- [x] Shared writing schemas/types allow `spacedStage: 'D+7'`.
- [x] Completing a D+3 `new_context_reuse` task with latest check outcome `correct` creates exactly one pending D+7 task due in seven days.
- [x] Retrying a D+3 check and receiving `correct` creates the D+7 task when it does not already exist.
- [x] D+7 generation reuses a valid hidden prompt contract and does not expose contract/fingerprint fields in public snapshots or UI.
- [x] `partly_correct`, `incorrect`, retryable/failed checks, D+1 checks, non-D+3 checks, skipped tasks, and expired tasks do not create D+7.
- [x] Missing/invalid prompt contract or unrecoverable fingerprint prevents D+7 creation without failing the original D+3 completion/retry result.
- [x] D+7 task generation is idempotent and does not duplicate tasks.
- [x] D+7 visible prompt excludes forbidden leakage terms and does not ask the learner to rewrite the original sentence.
- [x] D+7 evaluator prompt branches to transfer semantics and includes stage-aware D+7 context.
- [x] D+7 task lifecycle reuses existing skip/snooze/expire/complete/retry behavior.
- [x] Renderer practice copy distinguishes D+7 from D+1 rewrite and does not expose hidden prompt contracts.
- [x] Progress evidence advances to `stable_after_spaced_reuse` only after D+7 `new_context_reuse` latest completed outcome is `correct`.
- [x] No post-D+7 task generation, transfer diagnostic persistence, gamified/mastered copy, or fingerprint/prompt-contract UI is implemented.

## Out of Scope

- Transfer evaluator diagnostic fields/reason-code persistence.
- New tasks after D+7.
- A separate `reuse_tasks` table.
- AI-generated D+7 prompt text.
- New task queue/calendar UI.
- Fingerprint or prompt-contract display/editing in normal learner UI.
- Backfilling D+7 for old completed D+3 tasks.

## Definition of Done

- Implementation follows PR #25 product specs.
- Focused service, schema, renderer, and Progress tests cover D+7 behavior.
- Existing D+1 and D+3 rewrite practice/check behavior remains compatible.
- `pnpm check` passes.
- Spec update judgment is completed after implementation.

## Verification Notes

- Implement/check agents completed and independently verified the D+7 slice.
- Final local quality gate passed: `pnpm check`, Trellis context validation, and `git diff --check`.
- Spec update judgment completed: `data-model-contract.md` now describes the full D+3/D+7 contract, and `learning-flow.md` now treats D+7 as implemented with no post-D+7 generation.

## Technical Notes

- Likely touchpoints:
  - `src/shared/types/writing.ts`
  - `src/main/services/writing/service.ts`
  - `src/main/services/learning-assets/service.ts`
  - `src/renderer/components/LearningPanel.tsx`
  - `src/renderer/components/ProgressPage.tsx`
  - D+3/D+7 rewrite service, Progress evidence, renderer, and schema tests.
- Relevant specs:
  - `.trellis/spec/product/roadmap.md`
  - `.trellis/spec/product/learning-flow.md`
  - `.trellis/spec/product/data-model-contract.md`
  - `.trellis/spec/product/review-agent-contract.md`
  - `.trellis/spec/product/validation-and-testing.md`
