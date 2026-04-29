import { eq } from 'drizzle-orm';
import { db } from '../../../db/client';
import { journalEntries, journalRevisions, reviewRuns, type ReviewRun } from '../../../db/schema';
import {
  getReviewPreviewInputSchema,
  previewOperationsSnapshotSchema,
  reviewPreviewSnapshotSchema,
  reviewRunSnapshotSchema,
  type GetReviewPreviewInput,
  type ReviewPreviewSnapshot,
  type ReviewRunSnapshot,
} from '../../../../shared/types/review';
import { reviewOutputSchema } from '../../../../shared/review-contract/schemas';

function reviewRunToSnapshot(reviewRun: ReviewRun): ReviewRunSnapshot {
  return reviewRunSnapshotSchema.parse({
    id: reviewRun.id,
    journalEntryId: reviewRun.journalEntryId,
    journalRevisionId: reviewRun.journalRevisionId,
    contentHash: reviewRun.contentHash,
    status: reviewRun.status,
    validationStatus: reviewRun.validationStatus,
    provider: reviewRun.provider,
    model: reviewRun.model,
    validationErrors: parseValidationErrors(reviewRun.validationErrorsJson),
    createdAt: reviewRun.createdAt.getTime(),
    updatedAt: reviewRun.updatedAt.getTime(),
  });
}

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

function parseValidationErrors(value: string | null): string[] {
  if (!value) {
    return [];
  }

  const parsed = JSON.parse(value) as unknown;
  return Array.isArray(parsed) && parsed.every((item) => typeof item === 'string') ? parsed : [];
}
