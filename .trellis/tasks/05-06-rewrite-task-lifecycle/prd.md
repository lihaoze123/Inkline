# Implement Rewrite Task Lifecycle

## Goal

Implement the first execution slice from PR #25, `Refresh roadmap evidence semantics`: make D+1 rewrite task lifecycle behavior explicit in service contracts and UI so stale practice does not crowd Practice and lifecycle status remains separate from rewrite-check learning outcomes.

## Source

- GitHub PR #25: `Refresh roadmap evidence semantics`, merged as `809b080`.
- PR #25 changed the product specs to make rewrite-check completed baseline behavior and define the next axis as Prove Pattern Transfer.
- The first implementation milestone in the refreshed roadmap is `Milestone 2: Rewrite Task Lifecycle`.

## What I Already Know

- Existing schema and shared types already include rewrite task statuses `pending`, `in_progress`, `completed`, `skipped`, `snoozed`, and `expired`.
- Existing service/UI already support submit/check/retry and `skipRewritePractice`.
- Existing Practice selection hides pending D+1 tasks older than 7 days by filtering `createdAt`, but it does not explicitly persist `expired`.
- Existing shared IPC exposes complete/skip/retry only; there is no snooze API yet.
- PR #25 explicitly says task lifecycle is not learning success. Rewrite-check outcome remains the source of repair/transfer evidence.
- PR #25 defers Progress evidence labels, fingerprints, hidden transfer prompt contracts, and D+3/D+7 new-context reuse to later milestones.

## Requirements

- Add explicit snooze behavior for D+1 `rewrite_original` tasks.
- Add explicit expiry behavior for stale D+1 rewrite tasks.
- Preserve existing skip behavior and rewrite-check result behavior.
- Keep lifecycle status separate from `rewrite_checks.outcome`; do not make `completed`, `skipped`, `snoozed`, or `expired` imply learning success or failure.
- Keep the first version constrained to the current single due D+1 Practice slot.

## Lifecycle Semantics

- `pending`: task is due or waiting.
- `in_progress`: learner is working on the task.
- `completed`: learner submitted; this does not imply learning success.
- `skipped`: learner intentionally abandoned the practice opportunity; not success.
- `snoozed`: learner deferred the task by changing `dueAt`; no mastery impact.
- `expired`: task is too stale to keep pushing; not a language failure, but the review window was missed.

## Product Decisions

- Snooze is a fixed one-day deferral in this first version.
- Snoozing sets `status = 'snoozed'` and advances `dueAt` by one day from the current time.
- Practice should re-activate due snoozed tasks by returning them to the main slot when `dueAt <= now`.
- Expiry is explicit and opportunistic: before selecting the Practice rewrite slot, mark stale pending/in-progress D+1 tasks older than 7 days as `expired`.
- Expiry uses the existing 7-day freshness boundary from the data-model contract.
- A terminal task (`completed`, `skipped`, `expired`) should not be mutated by complete/skip/snooze.
- A snoozed task that is not yet due should not occupy the main Practice rewrite slot.

## UI Requirements

- The rewrite practice card should expose `Snooze` alongside the existing `Skip` action while a task can still be acted on.
- Snooze should be disabled while rewrite-check is running.
- Snoozing should remove the card from the current Practice slot and clear local rewrite input/error state.
- Copy should be learner-facing and avoid suggesting snooze, skip, or expiry is learning success or failure.
- Existing submitted rewrite feedback, native-model reveal, and retry UI should remain unchanged.

## API / Contract Requirements

- Add a shared input schema/type for snoozing a rewrite practice task.
- Add an IPC channel and preload API for `snoozeRewritePractice`.
- Add a main-process handler that validates input and delegates to the writing service.
- Add a renderer query mutation that updates the same writing/rewrite-practice cache path as complete/skip/retry.
- Return `RewritePracticeUpdateResult` from snooze, matching complete/skip behavior.

## Acceptance Criteria

- [x] Due pending D+1 rewrite tasks still appear in Practice.
- [x] Skipped tasks still disappear from the pending Practice slot and persist `skippedAt`.
- [x] Snoozed tasks persist `status = 'snoozed'`, update `dueAt`, disappear from the current Practice slot, and do not create rewrite-check rows.
- [x] Due snoozed tasks can appear again in the Practice slot without changing learning evidence.
- [x] D+1 tasks older than 7 days are explicitly marked `expired` and do not appear in the Practice slot.
- [x] Completing, skipping, or snoozing terminal tasks returns success with the current snapshot and does not duplicate transitions.
- [x] Existing rewrite-check submit/retry behavior and outcome semantics remain unchanged.
- [x] Shared schema, IPC/preload, service tests, renderer query tests, and UI behavior are updated where needed.

## Out of Scope

- D+3/D+7 `new_context_reuse` task generation.
- Pattern fingerprints or hidden transfer prompt contracts.
- Evidence-model or Progress UI labels.
- Full rewrite queue management beyond the single due Practice slot.
- Configurable/custom snooze duration.
- Append-only learning event log.
- New mastery/streak/score behavior.

## Definition of Done

- Implementation follows PR #25 product specs.
- Focused tests cover snooze and explicit expiry behavior.
- Existing rewrite-check contract and service tests still pass.
- Lint and typecheck pass.
- No unrelated product roadmap milestones are implemented.

## Technical Notes

- Existing likely touchpoints:
  - `src/shared/types/writing.ts`
  - `src/shared/constants/channels.ts`
  - `src/preload/index.ts`
  - `src/main/ipc/handlers.ts`
  - `src/main/services/writing/service.ts`
  - `src/renderer/query/writing.ts`
  - `src/renderer/App.tsx`
  - `src/renderer/components/LearningPanel.tsx`
  - `test/rewrite-practice-service.test.ts`
  - `test/renderer-query.test.ts`
- Existing status enum and DB schema already include `snoozed` and `expired`; migration work should not be needed unless implementation discovers a missing persisted timestamp requirement.
- Final automated verification passed with `pnpm check`: format, lint, typecheck, unit tests, and review harness.
- Spec update completed: `.trellis/spec/product/data-model-contract.md` now records the concrete `snoozeRewritePractice` cross-layer contract and expiry behavior.
