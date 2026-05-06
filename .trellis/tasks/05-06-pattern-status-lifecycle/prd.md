# Implement richer pattern status lifecycle

## Goal

Add a richer, derived pattern lifecycle read model so Progress can explain where each pattern is in the repair -> transfer -> stability path, including current blockers and latest delayed-transfer context, without introducing gamified mastery or a stored status column.

## What I already know

- Horizon 2 lists "Richer pattern status lifecycle after enough transfer evidence exists" immediately after pattern merge/de-dup.
- The app already persists D+1, D+3, and D+7 rewrite/check data and derives evidence stages:
  - `needs_repair`
  - `repaired_once`
  - `transferred_once`
  - `stable_after_spaced_reuse`
- Current Progress shows the evidence label and latest D+1 repair context, but it does not expose latest D+3/D+7 transfer context.
- Existing specs still prohibit premature `mastered` claims and gamified scoring.
- `listErrorPatterns` already derives evidence at query time and rolls merged source evidence into the target.

## Assumptions

- This task is v0.2/Horizon 2 and should remain a read-model/UI improvement.
- Do not add a persisted lifecycle/status column in this slice.
- Do not introduce a full learning event log or irreversible mastery transitions yet.
- Lifecycle should be deterministic from existing local SQLite data.

## Requirements

- Extend the shared learning-assets types with a derived lifecycle summary:
  - `PatternLifecycleStatus`:
    - `repair_needed`
    - `repair_in_progress`
    - `ready_for_transfer`
    - `transfer_in_progress`
    - `stabilizing`
    - `stable`
    - `needs_attention`
  - `PatternLifecycleSummary` includes `status`, `label`, `description`, and optional `blockingReason`.
- Extend `PatternEvidenceSummary` with latest delayed-transfer context:
  - `latestTransfer` summarizing the latest relevant D+3/D+7 `new_context_reuse` task and latest check.
  - Continue to include `latestRepair` for D+1 context.
- Derive lifecycle in `listErrorPatterns` from existing evidence rows:
  - No D+1 correct and no active repair context -> `repair_needed`.
  - D+1 pending/in-progress/snoozed/retryable/failed/weak latest check -> `repair_in_progress` or `needs_attention` where appropriate.
  - D+1 correct and no D+3 context -> `ready_for_transfer`.
  - D+3 pending/in-progress/snoozed/retryable/failed -> `transfer_in_progress` or `needs_attention`.
  - D+3 correct and no D+7 correct -> `stabilizing`.
  - D+7 correct -> `stable`.
  - Latest D+3/D+7 completed `partly_correct` or `incorrect` -> `needs_attention` while preserving the strongest valid evidence stage already earned.
- Update Progress UI:
  - Show lifecycle label/copy as the primary "Current status" for each pattern.
  - Keep evidence stage visible and separate from review count.
  - Show latest transfer context when present.
  - Do not use `mastered`, points, streaks, or score-style wording.
- Preserve existing merge behavior:
  - Merged source evidence and transfer context roll up to the target pattern.
- Tests:
  - Shared schema accepts lifecycle and latestTransfer.
  - Service derivation covers every lifecycle status and weak transfer outcomes.
  - Progress render shows lifecycle and latest transfer context without mastery wording.

## Acceptance Criteria

- [x] `ErrorPatternSnapshot` exposes a typed `lifecycle` summary and `evidence.latestTransfer`.
- [x] Lifecycle derivation is deterministic and read-only; no DB migration or stored status column is added.
- [x] Weak D+3/D+7 outcomes produce `needs_attention` without erasing previously earned evidence stage.
- [x] D+7 correct produces `stable` but still avoids `mastered` wording.
- [x] Progress renders lifecycle, evidence, latest repair context, and latest transfer context clearly.
- [x] Existing pattern merge rollup still works with lifecycle and transfer context.
- [x] `pnpm check`, task context validation, and `git diff --check` pass.

## Definition of Done

- Tests added/updated.
- Specs updated if the lifecycle contract changes.
- `pnpm check` passes.
- Task PRD acceptance criteria are updated before finish.

## Out of Scope

- Persisted pattern status columns.
- Learning event log.
- User-facing mastery transitions.
- Drill Center, Anki, import/export, or gamified dashboards.
- New task generation logic beyond existing D+3/D+7 behavior.

## Technical Notes

- Likely files:
  - `src/shared/types/learning-assets.ts`
  - `src/main/services/learning-assets/service.ts`
  - `src/renderer/components/ProgressPage.tsx`
  - `test/learning-assets-evidence.test.ts`
  - `test/progress-page-render.test.tsx`
- Relevant specs:
  - `.trellis/spec/product/roadmap.md`
  - `.trellis/spec/product/mvp-scope.md`
  - `.trellis/spec/product/learning-flow.md`
  - `.trellis/spec/product/data-model-contract.md`
  - `.trellis/spec/product/validation-and-testing.md`
