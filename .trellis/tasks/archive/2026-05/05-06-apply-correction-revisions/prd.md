# Implement User-Approved Apply-Correction Revisions

## Goal

Let the learner explicitly apply the saved focus correction to the current draft by creating a new writing revision. The feature must make correction application user-approved, local, reversible through revision history, and safe against stale review anchors.

## What I Already Know

- Roadmap Horizon 2 lists "Safer apply-correction through explicit user-approved revisions" after pattern merge, richer lifecycle, and learning event log.
- The content revision contract says corrections are anchored to the reviewed writing content version, and apply-correction must create a new user-approved revision without mutating historical snapshots.
- Existing `writing_revisions` already stores full versioned writing text and `writing_attempts.active_revision_id` points to the active draft.
- Existing `saveWritingAttempt` creates new revisions and marks saved reviews stale when content changes.
- Existing `FeedbackRewritePage` shows the focused correction, reviewed content, self-repair field, and save-review button, but there is no apply-to-draft action.
- Existing review preview operations include `correctionIndex`, `originalText`, `correctedText`, `startOffset`, `endOffset`, and `contentHash`, which are enough to validate a single anchored replacement.
- Current learning event log has a restricted event-type vocabulary. Applying a correction is a durable user action and should be auditable without storing full writing text in the event payload.

## Assumptions

- The phrase "continue next step" means continue the roadmap sequence with the next Horizon 2 item.
- MVP should prioritize safety and trust over convenience.
- Applying a correction before saving the review would blur the preview-only boundary, so first version should require the review to be saved first.
- The first visible action should apply only the focus correction. Bulk application and secondary suggestions can come later after the focused flow is proven.

## Requirements

- Add a review-layer mutation API for applying one review correction to the current active writing revision.
- Shared input should include:
  - `reviewRunId`
  - `correctionIndex`
  - the active `writingRevisionId` the user is approving
- The service must load the review, preview operations, writing attempt, and active revision, then validate:
  - review is saved before apply
  - active revision id matches the user-approved input revision id
  - active revision content hash matches the review content hash
  - correction is anchored, not low-confidence, and has valid offsets
  - the active revision slice at the offsets still equals `originalText`
- On success, create a new `writing_revisions` row with the corrected text replacement and update `writing_attempts.active_revision_id`.
- Mark the saved review stale and clear `writing_attempts.last_review_run_id` / `reviewed_at` when the new revision changes the content hash.
- Preserve historical review, correction, and revision rows. Do not mutate old writing content, review snapshots, correction offsets, or provider output.
- Add a `correction_applied` learning event type and record one compact event after a successful apply. Payload may include correction index and before/after hashes but must not include full writing text or raw provider output.
- Expose the mutation through IPC/preload and renderer query hooks.
- Add a Feedback page control for the focus correction:
  - Before the review is saved, show that applying requires saving the review first or keep the control disabled.
  - After the review is saved and the review is still current, let the user explicitly apply the correction to the draft.
  - The action copy must make the consequence clear: a revised draft will be created.
  - If the review is stale for the current draft, direct the user to review the current draft instead of applying.
- After a successful apply, update the writing cache and editor content to the new active revision. The old review should no longer be treated as current.

## Acceptance Criteria

- [ ] Shared schemas/types define `ApplyReviewCorrectionInput` and `ApplyReviewCorrectionOutput`.
- [ ] IPC/preload exposes `window.api.review.applyCorrection(input)`.
- [ ] Service creates a new `writing_revisions` row and updates the active revision only after validating saved-review status, active revision identity, content hash, correction offsets, and original text.
- [ ] Applying a correction marks the source saved review stale and clears current review pointers on the writing attempt.
- [ ] Service returns clear safe errors for unsaved review, stale active draft, unknown correction, low-confidence/unanchored correction, and text mismatch.
- [ ] Applying the same saved correction again after the first revision is a no-op/error that does not create another revision.
- [ ] `learning_events` supports and records `correction_applied` with compact metadata and no full writing text.
- [ ] Feedback UI makes application explicit and does not offer stale apply behavior.
- [ ] Tests cover service success, stale/review-status/text-mismatch failures, event logging, IPC/shared schema parsing, renderer cache update, and Feedback page control states.

## Definition Of Done

- Tests added or updated for changed behavior.
- `pnpm typecheck`, `pnpm lint`, and relevant Vitest targets pass.
- `pnpm test` is run if practical.
- `pnpm review:harness` is run because review flow contracts are touched.
- Trellis task validates.
- Spec contract is updated if the implementation adds a durable API/DB/event contract.
- Work is committed in a code commit plus task-context commit before finish-work.

## Out Of Scope

- No bulk "apply all corrections".
- No applying low-confidence corrections.
- No applying upgrade/model suggestions as draft edits.
- No applying corrections from unsaved review previews.
- No accepting corrections by mutating the existing writing revision.
- No automatic apply on save review.
- No live editor redlines or inline suggestion mode.
- No undo UI beyond preserving the previous writing revision.
- No import/export changes in this task.

## Technical Notes

- Relevant specs:
  - `.trellis/spec/product/roadmap.md`
  - `.trellis/spec/product/data-model-contract.md`
  - `.trellis/spec/product/learning-flow.md`
  - `.trellis/spec/product/validation-and-testing.md`
  - `.trellis/spec/backend/database.md`
  - `.trellis/spec/backend/api-module.md`
  - `.trellis/spec/backend/error-handling.md`
  - `.trellis/spec/backend/type-safety.md`
  - `.trellis/spec/frontend/ipc-electron.md`
  - `.trellis/spec/frontend/hooks.md`
  - `.trellis/spec/frontend/quality.md`
  - `.trellis/spec/shared/timestamp.md`
- Relevant code discovered:
  - `src/main/services/writing/service.ts` has revision creation and stale-review behavior.
  - `src/shared/types/review.ts` owns review IPC schemas.
  - `src/main/ipc/handlers.ts`, `src/preload/index.ts`, and `src/shared/constants/channels.ts` expose review APIs.
  - `src/renderer/App.tsx` owns Feedback page state and writing cache updates.
  - `src/renderer/query/review.ts` owns review mutations.
  - `src/renderer/components/review-utils.tsx` exposes focus-correction helpers.
