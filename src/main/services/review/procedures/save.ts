import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../../../db/client';
import {
  corrections,
  writingAttempts,
  writingRevisions,
  referenceRewrites,
  reviewRuns,
  rewriteTasks,
  selfRepairAttempts,
} from '../../../db/schema';
import {
  persistedPreviewOperationsSnapshotSchema,
  saveReviewInputSchema,
  type SaveReviewInput,
  type SaveReviewOutput,
} from '../../../../shared/types/review';
import { appendLearningEvent, persistNotebookEntries, persistPatternOperations } from '../../learning-assets/service';
import { getWritingAttempt } from '../../writing/service';
import { shouldForceE2eRewritePracticeDueNow } from '../../ai/e2e-mock';
import { reviewRunToSnapshot } from '../lib/snapshots';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function createId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

type SaveReviewOptions = {
  database?: typeof db;
  getWritingAttemptSnapshot?: () => NonNullable<SaveReviewOutput['writing']>;
};

function getWritingSnapshotForReviewRun(
  reviewRun: typeof reviewRuns.$inferSelect,
  database: typeof db,
): NonNullable<SaveReviewOutput['writing']> {
  const entry = database.select().from(writingAttempts).where(eq(writingAttempts.id, reviewRun.writingAttemptId)).get();
  return entry ? getWritingAttempt({ templateId: entry.templateId }) : getWritingAttempt();
}

export function saveReviewRun(input: SaveReviewInput, options: SaveReviewOptions = {}): SaveReviewOutput {
  const parseResult = saveReviewInputSchema.safeParse(input);
  if (!parseResult.success) {
    return { success: false, error: parseResult.error.issues[0].message };
  }

  const database = options.database ?? db;
  const getWritingAttemptSnapshot = options.getWritingAttemptSnapshot ?? getWritingAttempt;

  try {
    const savedRun = database.transaction((tx) => {
      const reviewRun = tx.select().from(reviewRuns).where(eq(reviewRuns.id, parseResult.data.reviewRunId)).get();
      if (!reviewRun) {
        throw new Error('Review run was not found.');
      }

      if (reviewRun.status === 'review_saved' || reviewRun.status === 'stale') {
        return reviewRun;
      }

      if (reviewRun.status !== 'review_ready') {
        throw new Error('Only ready review previews can be saved.');
      }

      if (!reviewRun.previewOperationsJson) {
        throw new Error('Review preview operations are missing.');
      }

      const operations = persistedPreviewOperationsSnapshotSchema.parse(
        JSON.parse(reviewRun.previewOperationsJson) as unknown,
      );
      const focusCorrectionIndex = operations.selfRepair?.correctionIndex;
      const focusCorrections = operations.corrections.filter(
        (correction) => correction.correctionIndex === focusCorrectionIndex,
      );
      if (
        focusCorrectionIndex === undefined ||
        focusCorrections.length !== 1 ||
        focusCorrections[0].status === 'low_confidence'
      ) {
        throw new Error('Review must contain exactly one anchored focus correction.');
      }

      const focusPatternOperations = operations.patternOperations.filter(
        (operation) => operation.correctionIndex === focusCorrectionIndex,
      );
      if (focusPatternOperations.length !== 1 || !focusPatternOperations[0].fingerprint) {
        throw new Error('Review focus pattern fingerprint is missing.');
      }

      const activeEntry = tx
        .select()
        .from(writingAttempts)
        .where(eq(writingAttempts.id, reviewRun.writingAttemptId))
        .get();
      if (!activeEntry) {
        throw new Error('Writing attempt for review run was not found.');
      }

      const activeRevision = activeEntry.activeRevisionId
        ? tx.select().from(writingRevisions).where(eq(writingRevisions.id, activeEntry.activeRevisionId)).get()
        : undefined;
      const saveAsStaleHistory = activeRevision?.contentHash !== reviewRun.contentHash;
      const correctionIdByIndex = new Map<number, string>();
      const patternLinks = persistPatternOperations({
        tx,
        operations,
        reviewRunId: reviewRun.id,
        dateKey: activeEntry.dateKey,
      });
      const focusPatternLink = patternLinks.get(focusCorrectionIndex);

      operations.corrections.forEach((operation) => {
        if (operation.status === 'low_confidence' || operation.startOffset === null || operation.endOffset === null) {
          return;
        }

        const correctionId = createId('correction');
        const patternLink = patternLinks.get(operation.correctionIndex);
        correctionIdByIndex.set(operation.correctionIndex, correctionId);
        tx.insert(corrections)
          .values({
            id: correctionId,
            reviewRunId: reviewRun.id,
            patternId: patternLink?.patternId ?? null,
            pattern: patternLink?.rule ?? patternLabelFor(operation),
            originalText: operation.originalText,
            correctedText: operation.correctedText,
            explanation: operation.explanation,
            category: operation.correctionIndex === focusCorrectionIndex ? 'fix' : 'model',
            status: operation.status,
            startOffset: operation.startOffset,
            endOffset: operation.endOffset,
          })
          .run();
      });

      persistNotebookEntries({
        tx,
        operations,
        reviewRunId: reviewRun.id,
        dateKey: activeEntry.dateKey,
        templateId: activeEntry.templateId,
      });

      if (operations.selfRepair) {
        const attemptText = parseResult.data.selfRepairAttemptText?.trim() ?? '';
        tx.insert(selfRepairAttempts)
          .values({
            id: createId('self_repair'),
            reviewRunId: reviewRun.id,
            correctionId: correctionIdByIndex.get(operations.selfRepair.correctionIndex) ?? null,
            attemptText,
            result:
              parseResult.data.revealedWithoutAttempt && attemptText.length === 0
                ? 'revealed_without_attempt'
                : attemptText.length > 0
                  ? 'partly_correct'
                  : 'skipped',
          })
          .run();
      }

      operations.referenceRewrites.forEach((operation) => {
        tx.insert(referenceRewrites)
          .values({
            id: createId('reference'),
            reviewRunId: reviewRun.id,
            rewriteText: operation.text,
            noticeTheGap: operation.noticeTheGap,
          })
          .run();
      });

      const rewritePractice = operations.rewritePractice.find(
        (operation) => operation.kind === 'rewrite_original' && operation.dueOffsetDays === 1,
      );
      let rewriteTaskCreated = false;
      if (rewritePractice) {
        const referencesFocusCorrection = rewritePractice.focusCorrectionIndexes.includes(focusCorrectionIndex);
        const referencesLowConfidence = rewritePractice.focusCorrectionIndexes.some((correctionIndex) => {
          const correction = operations.corrections.find((candidate) => candidate.correctionIndex === correctionIndex);
          return !correction || correction.status === 'low_confidence';
        });

        if (referencesFocusCorrection && !referencesLowConfidence) {
          const rewriteTaskId = createId('rewrite');
          const dueAt = shouldForceE2eRewritePracticeDueNow() ? new Date() : new Date(Date.now() + ONE_DAY_MS);
          const rewriteTask = tx
            .insert(rewriteTasks)
            .values({
              id: rewriteTaskId,
              reviewRunId: reviewRun.id,
              originalSentence: focusCorrections[0].originalText,
              focusPattern: patternLabelFor(focusCorrections[0]),
              nativeModelSentence: focusCorrections[0].correctedText,
              prompt: rewritePractice.prompt,
              kind: rewritePractice.kind,
              spacedStage: 'D+1',
              status: 'pending',
              dueAt,
            })
            .returning()
            .get();

          appendLearningEvent(
            {
              eventType: 'rewrite_task_created',
              occurredAt: rewriteTask.createdAt,
              dedupeKey: `rewrite_task_created:${rewriteTask.id}`,
              reviewRunId: reviewRun.id,
              patternId: focusPatternLink?.patternId ?? null,
              rewriteTaskId: rewriteTask.id,
              payload: {
                source: 'review_save',
                practiceKind: rewriteTask.kind,
                spacedStage: rewriteTask.spacedStage,
                dueAt: dueAt.getTime(),
              },
            },
            tx,
          );
          rewriteTaskCreated = true;
        }
      }

      const finalStatus = saveAsStaleHistory ? 'stale' : 'review_saved';
      const finalRun = tx
        .update(reviewRuns)
        .set({ status: finalStatus })
        .where(eq(reviewRuns.id, reviewRun.id))
        .returning()
        .get();

      if (!finalRun) {
        throw new Error('Saved review run was not returned.');
      }

      appendLearningEvent(
        {
          eventType: 'review_saved',
          occurredAt: finalRun.updatedAt,
          dedupeKey: `review_saved:${reviewRun.id}:${finalStatus}`,
          reviewRunId: reviewRun.id,
          patternId: focusPatternLink?.patternId ?? null,
          payload: {
            finalStatus,
            saveAsStaleHistory,
            templateId: activeEntry.templateId,
            savedCorrectionCount: correctionIdByIndex.size,
            rewriteTaskCreated,
          },
        },
        tx,
      );

      if (!saveAsStaleHistory) {
        tx.update(writingAttempts)
          .set({ lastReviewRunId: reviewRun.id, reviewedAt: new Date() })
          .where(eq(writingAttempts.id, reviewRun.writingAttemptId))
          .run();
      }

      return finalRun;
    });

    return {
      success: true,
      reviewRun: reviewRunToSnapshot(savedRun),
      writing: options.getWritingAttemptSnapshot
        ? getWritingAttemptSnapshot()
        : getWritingSnapshotForReviewRun(savedRun, database),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save review.';
    return { success: false, error: message };
  }
}

function patternLabelFor(operation: {
  matchedPatternId: string | null;
  newPatternSuggestion: unknown;
  explanation: string;
}): string {
  if (operation.matchedPatternId) {
    return operation.matchedPatternId;
  }

  if (isNewPatternSuggestion(operation.newPatternSuggestion)) {
    return operation.newPatternSuggestion.rule;
  }

  return operation.explanation;
}

function isNewPatternSuggestion(value: unknown): value is { rule: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'rule' in value &&
    typeof (value as { rule?: unknown }).rule === 'string'
  );
}
