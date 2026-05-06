import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../../../db/client';
import { reviewRuns, writingAttempts, writingRevisions, type WritingRevision } from '../../../db/schema';
import { computeWritingContentHash, normalizeWritingContent } from '../../../../shared/writing/content';
import {
  applyReviewCorrectionInputSchema,
  persistedPreviewOperationsSnapshotSchema,
  type ApplyReviewCorrectionInput,
  type ApplyReviewCorrectionOutput,
} from '../../../../shared/types/review';
import type {
  WritingAttemptSnapshot,
  WritingRevisionSnapshot,
  WritingTemplateId,
} from '../../../../shared/types/writing';
import { appendLearningEvent } from '../../learning-assets/service';
import { getWritingAttempt } from '../../writing/service';
import { reviewRunToSnapshot } from '../lib/snapshots';

function createId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

function revisionToSnapshot(revision: WritingRevision): WritingRevisionSnapshot {
  return {
    id: revision.id,
    writingAttemptId: revision.writingAttemptId,
    content: revision.content,
    contentHash: revision.contentHash,
    createdAt: revision.createdAt.getTime(),
  };
}

type ApplyReviewCorrectionOptions = {
  database?: typeof db;
  getWritingAttemptSnapshot?: (input: { templateId: WritingTemplateId }) => WritingAttemptSnapshot;
};

type ApplyMutationResult = {
  templateId: WritingTemplateId;
  reviewRun: typeof reviewRuns.$inferSelect;
  appliedRevision: WritingRevision;
};

export function applyReviewCorrection(
  input: ApplyReviewCorrectionInput,
  options: ApplyReviewCorrectionOptions = {},
): ApplyReviewCorrectionOutput {
  const parseResult = applyReviewCorrectionInputSchema.safeParse(input);
  if (!parseResult.success) {
    return { success: false, error: parseResult.error.issues[0]?.message ?? 'Invalid correction apply request.' };
  }

  const database = options.database ?? db;

  try {
    const mutation = database.transaction((tx): ApplyMutationResult => {
      const reviewRun = tx.select().from(reviewRuns).where(eq(reviewRuns.id, parseResult.data.reviewRunId)).get();
      if (!reviewRun) {
        throw new Error('Review run was not found.');
      }

      if (reviewRun.status === 'review_ready') {
        throw new Error('Save this review before applying a correction.');
      }

      if (reviewRun.status === 'stale') {
        throw new Error('Review current draft before applying this correction.');
      }

      if (reviewRun.status !== 'review_saved') {
        throw new Error('Only saved reviews can apply corrections to the draft.');
      }

      if (!reviewRun.previewOperationsJson) {
        throw new Error('Saved review correction data is unavailable.');
      }

      const operations = persistedPreviewOperationsSnapshotSchema.parse(
        JSON.parse(reviewRun.previewOperationsJson) as unknown,
      );
      const matchingCorrections = operations.corrections.filter(
        (correction) => correction.correctionIndex === parseResult.data.correctionIndex,
      );
      if (matchingCorrections.length !== 1) {
        throw new Error('Saved correction was not found.');
      }

      const correction = matchingCorrections[0];
      if (operations.selfRepair?.correctionIndex !== correction.correctionIndex) {
        throw new Error('Only the saved focus correction can be applied to the draft.');
      }

      if (
        correction.status === 'low_confidence' ||
        correction.startOffset === null ||
        correction.endOffset === null ||
        correction.endOffset <= correction.startOffset
      ) {
        throw new Error('This correction cannot be applied because it is not safely anchored.');
      }

      if (correction.contentHash !== reviewRun.contentHash) {
        throw new Error('This correction does not match the saved review version.');
      }

      const writingAttempt = tx
        .select()
        .from(writingAttempts)
        .where(eq(writingAttempts.id, reviewRun.writingAttemptId))
        .get();
      if (!writingAttempt) {
        throw new Error('Writing attempt for review run was not found.');
      }

      if (!writingAttempt.activeRevisionId) {
        throw new Error('No active draft revision is available.');
      }

      const activeRevision = tx
        .select()
        .from(writingRevisions)
        .where(eq(writingRevisions.id, writingAttempt.activeRevisionId))
        .get();
      if (!activeRevision) {
        throw new Error('Active draft revision was not found.');
      }

      if (
        activeRevision.id !== parseResult.data.writingRevisionId ||
        activeRevision.contentHash !== reviewRun.contentHash
      ) {
        throw new Error('This draft changed before the correction could be applied. Review the current draft first.');
      }

      if (correction.endOffset > activeRevision.content.length) {
        throw new Error('This correction anchor is no longer valid for the draft.');
      }

      const anchoredText = activeRevision.content.slice(correction.startOffset, correction.endOffset);
      if (anchoredText !== correction.originalText) {
        throw new Error('The draft text no longer matches this saved correction.');
      }

      const nextContent = normalizeWritingContent(
        `${activeRevision.content.slice(0, correction.startOffset)}${correction.correctedText}${activeRevision.content.slice(correction.endOffset)}`,
      );
      const nextContentHash = computeWritingContentHash(nextContent);
      if (nextContentHash === activeRevision.contentHash) {
        throw new Error('This correction is already applied to the draft.');
      }

      const appliedRevision = tx
        .insert(writingRevisions)
        .values({
          id: createId('revision'),
          writingAttemptId: writingAttempt.id,
          content: nextContent,
          contentHash: nextContentHash,
        })
        .returning()
        .get();

      if (!appliedRevision) {
        throw new Error('Applied writing revision was not returned.');
      }

      tx.update(writingAttempts)
        .set({
          activeRevisionId: appliedRevision.id,
          lastReviewRunId: null,
          reviewedAt: null,
        })
        .where(eq(writingAttempts.id, writingAttempt.id))
        .run();

      const staleReviewRun = tx
        .update(reviewRuns)
        .set({ status: 'stale' })
        .where(eq(reviewRuns.id, reviewRun.id))
        .returning()
        .get();
      if (!staleReviewRun) {
        throw new Error('Applied review run was not returned.');
      }

      appendLearningEvent(
        {
          eventType: 'correction_applied',
          occurredAt: appliedRevision.createdAt,
          dedupeKey: `correction_applied:${reviewRun.id}:${correction.correctionIndex}:${activeRevision.id}`,
          reviewRunId: reviewRun.id,
          payload: {
            correctionIndex: correction.correctionIndex,
            previousContentHash: activeRevision.contentHash,
            nextContentHash,
            appliedRevisionId: appliedRevision.id,
          },
        },
        tx,
      );

      return {
        templateId: writingAttempt.templateId,
        reviewRun: staleReviewRun,
        appliedRevision,
      };
    });

    const writing =
      options.getWritingAttemptSnapshot?.({ templateId: mutation.templateId }) ??
      getWritingAttempt({ templateId: mutation.templateId });

    return {
      success: true,
      writing,
      reviewRun: reviewRunToSnapshot(mutation.reviewRun),
      appliedRevision: revisionToSnapshot(mutation.appliedRevision),
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unable to apply correction.' };
  }
}
