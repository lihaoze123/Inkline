# Rewrite-check integration hardening

## Goal

Merge the rewrite-check contract, backend evaluator, and feedback UI slices into one coherent first milestone, resolve cross-worktree drift, and verify the end-to-end D+1 rewrite-check flow.

## Dependency / Worktree Plan

- Depends on these child tasks being ready to merge:
  - `05-02-rewrite-check-contract-persistence`
  - `05-02-rewrite-check-evaluator-service`
  - `05-02-rewrite-check-feedback-ui`
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

- [ ] Contract, backend, and UI branches merge without unresolved schema/type drift.
- [ ] End-to-end flow works for successful check outcomes.
- [ ] End-to-end flow works for provider/check failure and retry.
- [ ] Existing review save creates D+1 rewrite tasks as before.
- [ ] Existing skip behavior remains intact.
- [ ] `pnpm check` passes.
- [ ] Relevant tests pass, including rewrite-practice service/contract/renderer coverage.
- [ ] Manual UI smoke test is performed or the reason it could not be performed is documented.

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

## Technical Notes

- Highest conflict files are likely `src/shared/types/writing.ts`, `src/main/services/writing/service.ts`, `src/renderer/App.tsx`, and `src/renderer/components/LearningPanel.tsx`.
- Manual smoke should cover at least submit success, retryable failure, and skip if test data/provider setup permits.
