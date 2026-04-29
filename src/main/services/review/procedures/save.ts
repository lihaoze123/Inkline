import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../../../db/client';
import {
  corrections,
  journalEntries,
  journalRevisions,
  referenceRewrites,
  reviewRuns,
  rewriteTasks,
  selfRepairAttempts,
  type ReviewRun,
} from '../../../db/schema';
import {
  previewOperationsSnapshotSchema,
  reviewRunSnapshotSchema,
  saveReviewInputSchema,
  type ReviewRunSnapshot,
  type SaveReviewInput,
  type SaveReviewOutput,
} from '../../../../shared/types/review';
import { getTodayJournal } from '../../journal/service';

function createId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

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

type SaveReviewOptions = {
  database?: typeof db;
  getTodayJournalSnapshot?: () => NonNullable<SaveReviewOutput['journal']>;
};

export function saveReviewRun(input: SaveReviewInput, options: SaveReviewOptions = {}): SaveReviewOutput {
  const parseResult = saveReviewInputSchema.safeParse(input);
  if (!parseResult.success) {
    return { success: false, error: parseResult.error.issues[0].message };
  }

  const database = options.database ?? db;
  const getTodayJournalSnapshot = options.getTodayJournalSnapshot ?? getTodayJournal;

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

      const operations = previewOperationsSnapshotSchema.parse(JSON.parse(reviewRun.previewOperationsJson) as unknown);
      const focusCorrectionIndex = operations.selfRepair?.correctionIndex;
      const focusCorrections = operations.corrections.filter((correction) => correction.correctionIndex === focusCorrectionIndex);
      if (focusCorrectionIndex === undefined || focusCorrections.length !== 1 || focusCorrections[0].status === 'low_confidence') {
        throw new Error('Review must contain exactly one anchored focus correction.');
      }

      const activeEntry = tx.select().from(journalEntries).where(eq(journalEntries.id, reviewRun.journalEntryId)).get();
      const activeRevision = activeEntry?.activeRevisionId
        ? tx.select().from(journalRevisions).where(eq(journalRevisions.id, activeEntry.activeRevisionId)).get()
        : undefined;
      const saveAsStaleHistory = activeRevision?.contentHash !== reviewRun.contentHash;
      const correctionIdByIndex = new Map<number, string>();

      operations.corrections.forEach((operation) => {
        if (operation.status === 'low_confidence' || operation.startOffset === null || operation.endOffset === null) {
          return;
        }

        const correctionId = createId('correction');
        correctionIdByIndex.set(operation.correctionIndex, correctionId);
        tx.insert(corrections)
          .values({
            id: correctionId,
            reviewRunId: reviewRun.id,
            pattern: patternLabelFor(operation),
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

      if (operations.selfRepair) {
        const attemptText = parseResult.data.selfRepairAttemptText?.trim() ?? '';
        tx.insert(selfRepairAttempts)
          .values({
            id: createId('self_repair'),
            reviewRunId: reviewRun.id,
            correctionId: correctionIdByIndex.get(operations.selfRepair.correctionIndex) ?? null,
            attemptText,
            result: parseResult.data.revealedWithoutAttempt && attemptText.length === 0 ? 'revealed_without_attempt' : attemptText.length > 0 ? 'partly_correct' : 'skipped',
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

      const rewritePractice = operations.rewritePractice.find((operation) => operation.kind === 'rewrite_original' && operation.dueOffsetDays === 1);
      if (rewritePractice) {
        const referencesFocusCorrection = rewritePractice.focusCorrectionIndexes.includes(focusCorrectionIndex);
        const referencesLowConfidence = rewritePractice.focusCorrectionIndexes.some((correctionIndex) => {
          const correction = operations.corrections.find((candidate) => candidate.correctionIndex === correctionIndex);
          return !correction || correction.status === 'low_confidence';
        });

        if (referencesFocusCorrection && !referencesLowConfidence) {
          tx.insert(rewriteTasks)
            .values({
              id: createId('rewrite'),
              reviewRunId: reviewRun.id,
              originalSentence: focusCorrections[0].originalText,
              focusPattern: patternLabelFor(focusCorrections[0]),
              nativeModelSentence: focusCorrections[0].correctedText,
              prompt: rewritePractice.prompt,
              kind: rewritePractice.kind,
              spacedStage: 'D+1',
              status: 'pending',
              dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            })
            .run();
        }
      }

      const finalStatus = saveAsStaleHistory ? 'stale' : 'review_saved';
      const finalRun = tx
        .update(reviewRuns)
        .set({ status: finalStatus })
        .where(eq(reviewRuns.id, reviewRun.id))
        .returning()
        .get();

      if (!saveAsStaleHistory) {
        tx
          .update(journalEntries)
          .set({ lastReviewRunId: reviewRun.id, reviewedAt: new Date() })
          .where(eq(journalEntries.id, reviewRun.journalEntryId))
          .run();
      }

      return finalRun;
    });

    return { success: true, reviewRun: reviewRunToSnapshot(savedRun), journal: getTodayJournalSnapshot() };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save review.';
    return { success: false, error: message };
  }
}

function patternLabelFor(operation: { matchedPatternId: string | null; newPatternSuggestion: unknown; explanation: string }): string {
  if (operation.matchedPatternId) {
    return operation.matchedPatternId;
  }

  if (isNewPatternSuggestion(operation.newPatternSuggestion)) {
    return operation.newPatternSuggestion.rule;
  }

  return operation.explanation;
}

function isNewPatternSuggestion(value: unknown): value is { rule: string } {
  return typeof value === 'object' && value !== null && 'rule' in value && typeof (value as { rule?: unknown }).rule === 'string';
}

function parseValidationErrors(value: string | null): string[] {
  if (!value) {
    return [];
  }

  const parsed = JSON.parse(value) as unknown;
  return Array.isArray(parsed) && parsed.every((item) => typeof item === 'string') ? parsed : [];
}
