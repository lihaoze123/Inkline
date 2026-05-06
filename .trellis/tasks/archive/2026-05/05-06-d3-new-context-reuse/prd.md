# Implement D+3 New-Context Reuse Tasks

## Goal

Implement the first PR #25 Milestone 5 slice: after a learner gets a D+1 `rewrite_original` rewrite-check outcome of `correct`, create one delayed D+3 `new_context_reuse` task that asks for a new-context sentence using the saved focus pattern fingerprint. This lets Progress move from `Repaired once` to `Transferred once` when the D+3 task is later checked as `correct`, without implementing D+7 or transfer evaluator diagnostics yet.

## Source

- GitHub PR #25: `Refresh roadmap evidence semantics`, merged as `809b080`.
- Completed prerequisites:
  - `2eabcd5` rewrite task lifecycle.
  - `c5a0989` derived pattern evidence Progress.
  - `a76a917` pattern fingerprint persistence.
- Roadmap milestone: `Milestone 5: D+3/D+7 New-Context Reuse`.

## What I Already Know

- `rewrite_tasks` already has `kind = 'new_context_reuse'` and `spaced_stage` columns, but shared snapshots currently expose only `rewrite_original` / `D+1`.
- `completeRewritePractice` persists the submitted rewrite, runs the evaluator, writes a `rewrite_checks` attempt, and returns the updated practice snapshot.
- `retryRewriteCheck` can turn a retryable/failed D+1 check into a later completed `correct` attempt.
- Progress evidence currently derives `repaired_once` only from D+1 `rewrite_original` checks.
- Pattern fingerprints are now saved on `error_patterns.fingerprint_json` for the saved focus pattern.
- Current UI copy assumes every practice is a rewrite of the original sentence and reveals a reference sentence after submit.

## Assumptions

- The user’s “continue” means continue the PR #25 roadmap in order.
- This task should implement D+3 only. D+7 stays deferred so the D+3 task contract can be verified first.
- D+3 prompt creation can be deterministic/local in this slice; no separate AI prompt-generation call is required.
- If a historical D+1 task has no saved fingerprint, completing it as `correct` should still succeed but should not generate D+3.

## Requirements

- Generate one D+3 `rewrite_tasks` row after a completed D+1 `rewrite_original` check returns `correct`.
- Also generate D+3 when `retryRewriteCheck` produces the first D+1 `correct` outcome.
- Do not generate D+3 for `partly_correct`, `incorrect`, retryable/failed checks, skipped tasks, expired tasks, or non-D+1 tasks.
- Make D+3 generation idempotent; repeated saves, repeated terminal returns, and retries must not duplicate the D+3 task.
- Use the saved focus pattern fingerprint to build a hidden prompt contract for the D+3 task.
- Persist the hidden prompt contract on the rewrite task; keep it out of normal renderer-facing UI.
- Visible D+3 prompt must be a short new-context writing task, not an original-sentence rewrite, blank-fill drill, or copied target expression.
- Visible D+3 prompt must not contain any `forbiddenLeakageTerms` from the fingerprint.
- D+3 due date should be three days after the successful D+1 check is created/completed.
- D+3 tasks should use the existing lifecycle: pending, snooze, skip, complete, expire, retry-check.
- Branch rewrite-check evaluator semantics:
  - D+1 `rewrite_original`: repair original sentence.
  - D+3 `new_context_reuse`: judge transfer in a new context using the hidden prompt contract.
- Keep the public outcome vocabulary unchanged: `correct | partly_correct | incorrect`.
- Update shared writing schemas/types so pending practice snapshots can represent `new_context_reuse` / `D+3`.
- Update renderer copy to avoid showing “Original” and “Reference sentence” for D+3 tasks.
- Update Progress evidence derivation so a completed D+3 `new_context_reuse` check with outcome `correct` advances the pattern to `transferred_once`.
- Do not generate D+7 in this task.

## D+3 Prompt Contract

Persist hidden contract JSON on `rewrite_tasks`:

```ts
type NewContextPromptContract = {
  targetMeaning: string;
  allowedHints: string[];
  forbiddenHints: string[];
  expectedPatternFamily: PatternFingerprint['patternType'];
};
```

Suggested mapping from `PatternFingerprint`:

- `targetMeaning`: `targetCorrection`
- `allowedHints`: generic learning-safe hints derived from `transferBoundary` or fallback generic wording
- `forbiddenHints`: `forbiddenLeakageTerms`
- `expectedPatternFamily`: `patternType`

The visible prompt should stay generic enough to avoid leakage, for example asking for one or two new English sentences in a different everyday situation while applying the saved focus pattern naturally.

## Acceptance Criteria

- [x] A migration adds hidden prompt-contract storage for rewrite tasks and is registered in the Drizzle journal.
- [x] Shared writing schemas/types allow `practiceKind: 'new_context_reuse'` and `spacedStage: 'D+3'`.
- [x] Completing a D+1 `rewrite_original` task with latest check outcome `correct` creates exactly one pending D+3 task due in three days.
- [x] Retrying a D+1 check and receiving `correct` creates the D+3 task when it does not already exist.
- [x] `partly_correct`, `incorrect`, retryable/failed checks, and non-D+1 checks do not create D+3.
- [x] Missing/invalid fingerprint prevents D+3 creation without failing the original D+1 completion/retry result.
- [x] D+3 task generation is idempotent and does not duplicate tasks.
- [x] D+3 visible prompt excludes fingerprint leakage terms and does not ask the learner to rewrite the original sentence.
- [x] D+3 evaluator prompt branches to transfer semantics and uses the hidden prompt contract.
- [x] D+3 task lifecycle reuses existing skip/snooze/expire/complete/retry behavior.
- [x] Renderer practice copy distinguishes D+1 rewrite from D+3 new-context reuse and does not expose hidden prompt contracts.
- [x] Progress evidence advances to `transferred_once` only after D+3 `new_context_reuse` latest completed outcome is `correct`.
- [x] No D+7 task generation, transfer evaluator diagnostic persistence, gamified/mastered copy, or fingerprint editing UI is implemented.

## Out of Scope

- D+7 generation and `stable_after_spaced_reuse` advancement.
- Transfer evaluator diagnostic fields/reason-code persistence.
- A separate `reuse_tasks` table.
- AI-generated D+3 prompt text.
- New task queue UI or calendar UI.
- Fingerprint or prompt-contract display/editing in normal learner UI.
- Backfilling D+3 for old completed D+1 tasks.

## Definition of Done

- Implementation follows PR #25 product specs.
- Focused service, schema, migration, renderer, and Progress tests cover D+3 behavior.
- Existing D+1 rewrite practice/check behavior remains compatible.
- `pnpm check` passes.
- Spec update judgment is completed after implementation.

## Verification Notes

- Implement/check agents completed and independently verified the D+3 slice.
- Final local quality gate passed: `pnpm check`, Trellis context validation, and `git diff --check`.
- Spec update judgment completed: `data-model-contract.md` contains the D+3 code-spec contract and `learning-flow.md` now reflects D+3 as implemented while D+7 remains future work.

## Technical Notes

- Likely touchpoints:
  - `src/main/db/schema.ts`
  - `drizzle/0009_*`
  - `src/shared/types/writing.ts`
  - `src/main/services/writing/service.ts`
  - `src/main/services/learning-assets/service.ts`
  - `src/renderer/components/LearningPanel.tsx`
  - `src/renderer/query/writing.ts`
  - rewrite practice, renderer, database, and Progress evidence tests.
- Relevant specs:
  - `.trellis/spec/product/roadmap.md`
  - `.trellis/spec/product/learning-flow.md`
  - `.trellis/spec/product/data-model-contract.md`
  - `.trellis/spec/product/review-agent-contract.md`
  - `.trellis/spec/product/validation-and-testing.md`
