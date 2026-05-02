# Rewrite-check integration hardening

## Goal

Merge the rewrite-check contract, backend evaluator, and feedback UI slices into one coherent first milestone, resolve cross-worktree drift, and verify the end-to-end D+1 rewrite-check flow.

## Dependency / Worktree Plan

- Depends on these child tasks being ready to merge:
  - `05-02-rewrite-check-contract-persistence` (already merged as PR #13)
  - `05-02-rewrite-check-evaluator-service` (merged as PR #15)
  - `05-02-rewrite-check-feedback-ui` (merged as PR #14)
- Suggested branch/worktree name after the three slices are ready: `rewrite-check-integration-hardening`.
- This is intentionally not parallel with the other slices; it is the final convergence task.

## Requirements

- Merge backend and frontend slices against the contract baseline.
- Resolve any contract drift in shared writing types, IPC channel names, preload API shape, and latest-check payload semantics.
- Verify the end-to-end submit flow: save rewrite, show checking, persist check, render result.
- Verify retry after evaluation failure uses the saved user rewrite.
- Verify existing skip behavior still works and is not conflated with check failure.
- Verify no UI or data path treats task completion as successful learning unless latest check outcome is `correct`.
- Run the project quality gates and a manual app smoke test for the rewrite-practice golden path where practical.

## Acceptance Criteria

- [x] Contract, backend, and UI branches merge without unresolved schema/type drift.
- [x] End-to-end flow works for successful check outcomes.
- [x] End-to-end flow works for provider/check failure and retry.
- [x] Existing review save creates D+1 rewrite tasks as before.
- [x] Existing skip behavior remains intact.
- [x] `pnpm check` passes.
- [x] Relevant tests pass, including rewrite-practice service/contract/renderer coverage.
- [x] Manual UI smoke test is performed or the reason it could not be performed is documented.

## Definition of Done

- First rewrite-check milestone is shippable as evaluator plus persisted feedback UI.
- Remaining work is explicitly deferred to lifecycle, mastery, spaced reuse, or later backlog tasks.
- Any new convention discovered during integration is recorded via the Trellis spec-update flow if it is reusable.

## Technical Approach

- Treat the contract task as source of truth for shared payloads.
- Prefer small compatibility edits over feature expansion.
- If integration reveals a missing product decision, update the parent roadmap PRD before changing behavior.
- Keep scope narrow: hardening means making the first milestone coherent, not adding mastery or spaced reuse.

## Out of Scope

- New product capabilities beyond rewrite-check submit/result/retry.
- Pattern mastery UI or successful reuse aggregation.
- D+3/D+7 generation.
- Rewrite task lifecycle enhancements beyond ensuring skip remains stable.
- Release packaging work.

## Verification

- PR #15 and PR #14 were merged after PR #13, with contract drift checked across shared writing schemas, IPC channels, preload API, main service handlers, renderer cache, and feedback UI.
- `pnpm check` passes, including format check, lint, typecheck, 116 Vitest tests, and review contract harness.
- Rewrite-check success outcomes are covered by rewrite-practice service tests for `correct`, `partly_correct`, and `incorrect`, plus contract and renderer-query coverage for latest-check payload handling.
- Xvfb Electron/CDP smoke passed using an isolated app profile and seeded D+1 rewrite task. It verified renderer `window.api`, due practice display, submit persistence on evaluator failure, native model reveal after submit, retry of a persisted retryable attempt without false transport error, and removal of completed rewrite practice from the pending slot.

## Technical Notes

- Highest conflict files were `src/shared/types/writing.ts`, `src/main/services/writing/service.ts`, `src/renderer/App.tsx`, and `src/renderer/components/LearningPanel.tsx`.
- Manual UI smoke covered provider/check failure and retry under Xvfb; successful evaluator outcomes are verified by automated service/contract/renderer tests because the local smoke profile has no configured AI provider.
