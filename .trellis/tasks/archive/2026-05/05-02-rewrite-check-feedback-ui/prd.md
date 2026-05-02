# Rewrite-check feedback UI

## Goal

Update the D+1 rewrite-practice UI so users see a checking state, persisted evaluator feedback, and retryable evaluation failure after submitting a rewrite.

## Dependency / Worktree Plan

- Depends on `05-02-rewrite-check-contract-persistence` landing first for shared types/API shape.
- Suggested branch/worktree name after baseline lands: `rewrite-check-feedback-ui`.
- Can proceed in parallel with `05-02-rewrite-check-evaluator-service`; runtime integration is finalized in the integration-hardening task.

## Requirements

- Use the shared rewrite-check snapshot/result contract from the baseline task.
- Show a clear checking/submitting state while synchronous submit evaluation is running.
- Render persisted latest-check results for `correct`, `partly_correct`, and `incorrect`.
- Render retryable evaluation failure when the rewrite was saved but checking failed.
- Provide a retry action that uses the backend retry path once available.
- Keep corrections annotation-only: display feedback and native model text, but do not replace the user's rewrite.
- Preserve the current promise that the native model sentence stays hidden until after the user submits.
- Keep the visual treatment minimal and consistent with the existing writing UI; no broad layout redesign.
- Avoid treating `partly_correct` or `incorrect` as mastery success in UI copy.

## Acceptance Criteria

- [ ] The rewrite submit button/input disable while checking is in progress.
- [ ] A completed `correct` check shows encouraging concise feedback.
- [ ] A completed `partly_correct` check shows progress-oriented feedback without claiming mastery.
- [ ] A completed `incorrect` check shows actionable feedback without reopening or deleting the completed attempt.
- [ ] A failed/retryable check explains that the rewrite was saved and offers retry.
- [ ] The native model sentence remains hidden before submit and visible after a saved submit/check state.
- [ ] Renderer query/cache tests cover completion and retry result handling where practical.
- [ ] `pnpm check` passes, or any remaining failure is documented as unrelated.

## Definition of Done

- Renderer state, hooks, and components handle all check states from the shared contract.
- UI work is testable with mocked `window.api` responses even before backend work merges.
- No backend evaluator implementation is included in this task.

## Technical Approach

- Extend `src/renderer/query/writing.ts` mutation handling for latest check state and retry.
- Pass mutation/check state from `src/renderer/App.tsx` into `LearningPanel` through `src/renderer/components/types.ts`.
- Render result/failure states in `src/renderer/components/LearningPanel.tsx`, reusing existing alert/status patterns where possible.
- Keep local input state and completed rewrite snapshot handling simple; do not introduce a new independent rewrite query unless necessary.

## Out of Scope

- AI evaluator prompt/service implementation.
- Database/migration work beyond consuming shared contracts.
- Mastery/progress dashboard changes.
- D+3/D+7 spaced task UI.
- Global redesign of Practice, Feedback, Notebook, or Progress surfaces.

## Technical Notes

- Current rewrite UI state is owned by `src/renderer/App.tsx`.
- Current visible rewrite card is in `src/renderer/components/LearningPanel.tsx`.
- Current renderer API hooks are in `src/renderer/query/writing.ts`.
- Existing review failure UI in `LearningPanel.tsx` is a useful pattern, but rewrite UI should stay smaller.
