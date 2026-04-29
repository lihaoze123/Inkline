import { eq } from 'drizzle-orm';
import { db } from '../../../db/client';
import { journalEntries, journalRevisions, reviewRuns } from '../../../db/schema';
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

  const revision = reviewRun.journalRevisionId
    ? db.select().from(journalRevisions).where(eq(journalRevisions.id, reviewRun.journalRevisionId)).get()
    : undefined;
  const entry = db.select().from(journalEntries).where(eq(journalEntries.id, reviewRun.journalEntryId)).get();
  const activeRevision = entry?.activeRevisionId
    ? db.select().from(journalRevisions).where(eq(journalRevisions.id, entry.activeRevisionId)).get()
    : undefined;

  if (!revision || !entry) {
    return null;
  }

  return reviewPreviewSnapshotSchema.parse({
    reviewRun: reviewRunToSnapshot(reviewRun),
    reviewedContent: revision.content,
    parsedOutput: reviewOutputSchema.parse(JSON.parse(reviewRun.parsedOutputJson) as unknown),
    operations: previewOperationsSnapshotSchema.parse(JSON.parse(reviewRun.previewOperationsJson) as unknown),
    currentJournalContentHash: activeRevision?.contentHash ?? null,
    isStaleForCurrentJournal: activeRevision?.contentHash !== reviewRun.contentHash,
  });
}
