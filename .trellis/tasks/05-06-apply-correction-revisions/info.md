# Apply-Correction Revision Technical Decisions

## Focused Grill-Me Pass

Question resolved from existing contracts:

Should the first version let users apply any preview correction before saving the review, or only apply the saved focus correction?

Recommended answer adopted: only apply the saved focus correction.

Why:

- Review output is preview-only until saved.
- Pattern counts, rewrite practice, reference rewrite, and self-repair history are persisted at the save-review boundary.
- Applying a preview correction would immediately create a new active revision, making the preview stale before its learning-history boundary is clear.
- The product is focused on one transferable pattern, so the focus correction is the correct first visible apply target.

## API Shape

Recommended shared shape:

```ts
type ApplyReviewCorrectionInput = {
  reviewRunId: string;
  correctionIndex: number;
  writingRevisionId: string;
};

type ApplyReviewCorrectionOutput =
  | {
      success: true;
      writing: WritingAttemptSnapshot;
      reviewRun: ReviewRunSnapshot;
      appliedRevision: WritingRevisionSnapshot;
    }
  | {
      success: false;
      error: string;
    };
```

The `writingRevisionId` is the explicit user-approved revision boundary. The service should reject if it no longer matches the active revision.

## Service Placement

Prefer a new review procedure such as:

```text
src/main/services/review/procedures/apply-correction.ts
```

Reason: the operation is review-anchored, even though it writes a new writing revision.

## Safe Replacement Algorithm

1. Parse input.
2. Load `review_runs` by `reviewRunId`.
3. Require `status === 'review_saved'`.
4. Parse `preview_operations_json` with `persistedPreviewOperationsSnapshotSchema`.
5. Find exactly one correction by `correctionIndex`.
6. Reject low-confidence or unanchored corrections.
7. Load the writing attempt and active writing revision.
8. Require `activeRevision.id === input.writingRevisionId`.
9. Require `activeRevision.contentHash === reviewRun.contentHash`.
10. Require `activeRevision.content.slice(startOffset, endOffset) === correction.originalText`.
11. Build `nextContent` by replacing the anchored slice with `correctedText`.
12. Insert a new `writing_revisions` row and update `writing_attempts.active_revision_id`.
13. Mark the review stale and clear current review pointers on the attempt.
14. Append `learning_events.eventType = 'correction_applied'` with compact metadata.
15. Return fresh writing and review snapshots.

## Event Logging

Add `correction_applied` to the learning event vocabulary. Because `learning_events.event_type` has a SQLite `CHECK`, the migration must update the table contract safely.

Event payload should stay compact:

```ts
{
  correctionIndex,
  previousContentHash,
  nextContentHash,
  appliedRevisionId,
}
```

Do not store `originalText`, `correctedText`, full content, provider output, or hidden prompt contracts in the event payload.

## UI Behavior

First-version UI belongs in `FeedbackRewritePage` near the focus correction / reference answer area.

States:

- Unsaved review: communicate "Save review before applying to draft" or disable the action.
- Saved and current review: show explicit action like `Create revised draft`.
- Stale review: do not apply; show review-current-draft action.
- Applying: disable the action.
- Applied: update editor content/cache and return to draft or show success state with the old review no longer current.

## Testing Focus

- Service fake DB tests should mirror existing `review-save` / `writing` fake patterns.
- Renderer tests should verify control visibility/disabled copy and cache/content updates.
- Migration test must verify the event enum accepts `correction_applied`.
- Review harness should remain unchanged and pass.

