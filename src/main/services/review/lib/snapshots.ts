import {
  reviewRunSnapshotSchema,
  reviewRunSummarySchema,
  type ReviewRunSnapshot,
  type ReviewRunSummary,
} from '../../../../shared/types/review';
import type { ReviewRun } from '../../../db/schema';

export function reviewRunToSnapshot(reviewRun: ReviewRun): ReviewRunSnapshot {
  return reviewRunSnapshotSchema.parse({
    id: reviewRun.id,
    writingAttemptId: reviewRun.writingAttemptId,
    writingRevisionId: reviewRun.writingRevisionId,
    contentHash: reviewRun.contentHash,
    status: reviewRun.status,
    validationStatus: reviewRun.validationStatus,
    provider: reviewRun.provider,
    model: reviewRun.model,
    validationErrors: parseValidationErrors(reviewRun.validationErrorsJson),
    summary: parseReviewRunSummary(reviewRun.summaryJson),
    createdAt: reviewRun.createdAt.getTime(),
    updatedAt: reviewRun.updatedAt.getTime(),
  });
}

export function parseReviewRunSummary(value: string | null): ReviewRunSummary | null {
  if (!value) {
    return null;
  }

  return reviewRunSummarySchema.parse(JSON.parse(value) as unknown);
}

function parseValidationErrors(value: string | null): string[] {
  if (!value) {
    return [];
  }

  const parsed = JSON.parse(value) as unknown;
  return Array.isArray(parsed) && parsed.every((item) => typeof item === 'string') ? parsed : [];
}
