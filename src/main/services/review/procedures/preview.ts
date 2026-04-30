import { eq } from 'drizzle-orm';
import { db } from '../../../db/client';
import { writingAttempts, writingRevisions, reviewRuns } from '../../../db/schema';
import {
  getReviewPreviewInputSchema,
  previewOperationsSnapshotSchema,
  reviewPreviewSnapshotSchema,
  type GetReviewPreviewInput,
  type ReviewPreviewSnapshot,
} from '../../../../shared/types/review';
import { reviewOutputSchema } from '../../../../shared/review-contract/schemas';
import { reviewRunToSnapshot } from '../lib/snapshots';

export function getReviewPreview(input: GetReviewPreviewInput): ReviewPreviewSnapshot | null {
  const parseResult = getReviewPreviewInputSchema.safeParse(input);
  if (!parseResult.success) {
    return null;
  }

  const reviewRun = db.select().from(reviewRuns).where(eq(reviewRuns.id, parseResult.data.reviewRunId)).get();
  if (!reviewRun || reviewRun.status !== 'review_ready' || !reviewRun.parsedOutputJson || !reviewRun.previewOperationsJson) {
    return null;
  }

  const revision = reviewRun.writingRevisionId
    ? db.select().from(writingRevisions).where(eq(writingRevisions.id, reviewRun.writingRevisionId)).get()
    : undefined;
  const entry = db.select().from(writingAttempts).where(eq(writingAttempts.id, reviewRun.writingAttemptId)).get();
  const activeRevision = entry?.activeRevisionId
    ? db.select().from(writingRevisions).where(eq(writingRevisions.id, entry.activeRevisionId)).get()
    : undefined;

  if (!revision || !entry) {
    return null;
  }

  return reviewPreviewSnapshotSchema.parse({
    reviewRun: reviewRunToSnapshot(reviewRun),
    reviewedContent: revision.content,
    parsedOutput: reviewOutputSchema.parse(JSON.parse(reviewRun.parsedOutputJson) as unknown),
    operations: previewOperationsSnapshotSchema.parse(JSON.parse(reviewRun.previewOperationsJson) as unknown),
    currentWritingContentHash: activeRevision?.contentHash ?? null,
    isStaleForCurrentWriting: activeRevision?.contentHash !== reviewRun.contentHash,
  });
}
