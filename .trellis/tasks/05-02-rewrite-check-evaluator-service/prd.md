# Rewrite-check evaluator service

## Goal

Implement the backend rewrite-check evaluator and persistence flow so a submitted D+1 rewrite is saved, checked synchronously, and returned with a durable latest-check result or retryable failure.

## Dependency / Worktree Plan

- Depends on `05-02-rewrite-check-contract-persistence` landing first.
- Suggested branch/worktree name after baseline lands: `rewrite-check-evaluator-service`.
- This task can proceed in parallel with `05-02-rewrite-check-feedback-ui` after both branch from the contract baseline.

## Requirements

- Reuse the existing AI generation boundary instead of hand-writing provider HTTP calls.
- Build a focused evaluator prompt using the rewrite task's original sentence, focus pattern, native model sentence, practice prompt, and the user's submitted rewrite.
- Return a structured evaluator result with outcome `correct`, `partly_correct`, or `incorrect`, plus concise user-facing feedback.
- Save the user's rewrite text before calling the evaluator.
- Persist every evaluation attempt in `rewrite_checks`, including completed outcomes and failed/retryable attempts.
- On provider configuration, network, timeout, or invalid model-output failure, preserve the user rewrite and expose a retryable latest-check failure state.
- Treat `incorrect` as a completed practice attempt with unsuccessful learning outcome.
- Treat `partly_correct` as visible progress, not successful reuse or mastery success.
- Add a retry path that rechecks the saved rewrite without asking the user to resubmit text.
- Keep the first version synchronous during submit; do not add background workers or polling.

## Acceptance Criteria

- [ ] Completing a rewrite saves `userRewriteText` before evaluator execution.
- [ ] A successful evaluator call persists a completed `rewrite_checks` row with outcome and feedback.
- [ ] An evaluator failure persists a failed/retryable `rewrite_checks` row without losing submitted text.
- [ ] The completion IPC/service result returns the latest check state needed by the renderer.
- [ ] Retry reuses the saved rewrite text and creates a new check attempt.
- [ ] Service tests cover `correct`, `partly_correct`, `incorrect`, provider failure, invalid output, and retry.
- [ ] Existing review/save and rewrite-practice tests still pass.
- [ ] `pnpm check` passes, or any remaining failure is documented as unrelated.

## Definition of Done

- Backend service, IPC handlers, and tests are updated.
- Provider diagnostics are captured consistently with existing AI/review patterns.
- The task does not depend on renderer UI work to be testable.

## Technical Approach

- Prefer `src/main/services/ai/generate.ts` and existing review generation patterns for structured output.
- Prefer using the existing review model/runtime config for the first version unless the contract task explicitly added a dedicated rewrite-check feature key.
- Keep evaluator code small and annotation-only: it evaluates the user's rewrite, never replaces or auto-applies text.
- Preserve the distinction between task completion and learning success: `rewrite_tasks.completed` is not equivalent to `rewrite_checks.outcome === 'correct'`.

## Out of Scope

- Frontend result rendering beyond returning the needed payload.
- Separate rewrite-check settings UI or per-feature model override.
- Mastery transitions, successful reuse aggregation, D+3/D+7 task generation, or lifecycle skip/snooze/expire polish.
- Applying corrections to the user's writing.

## Technical Notes

- Current completion handler is `COMPLETE_REWRITE_PRACTICE` in `src/main/ipc/handlers.ts`.
- Current completion service is `completeRewritePractice()` in `src/main/services/writing/service.ts`.
- Existing AI call/error patterns are in `src/main/services/review/procedures/start.ts` and `src/main/services/ai/generate.ts`.
- Runtime feature keys currently include review and starter prompt; avoid expanding settings unless required by the baseline contract.
