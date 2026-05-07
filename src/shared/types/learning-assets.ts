import { z } from 'zod';
import { correctionCategorySchema } from '../review-contract/schemas';
import { rewriteCheckOutcomeSchema, rewriteCheckStatusSchema, rewritePracticeStatusSchema } from './writing';

export const learningEventTypeSchema = z.enum([
  'review_saved',
  'rewrite_task_created',
  'rewrite_submitted',
  'rewrite_check_recorded',
  'rewrite_retry_requested',
  'rewrite_skipped',
  'rewrite_snoozed',
  'rewrite_expired',
  'pattern_merged',
  'correction_applied',
]);

export const learningEventPayloadSchema = z.record(z.string(), z.unknown());

export const learningEventSnapshotSchema = z.object({
  id: z.string().min(1),
  eventType: learningEventTypeSchema,
  occurredAt: z.number(),
  dedupeKey: z.string().min(1).nullable(),
  reviewRunId: z.string().min(1).nullable(),
  patternId: z.string().min(1).nullable(),
  rewriteTaskId: z.string().min(1).nullable(),
  rewriteCheckId: z.string().min(1).nullable(),
  payload: learningEventPayloadSchema,
  createdAt: z.number(),
});

export const patternEvidenceStageSchema = z.enum([
  'needs_repair',
  'repaired_once',
  'transferred_once',
  'stable_after_spaced_reuse',
]);

export const patternLifecycleStatusSchema = z.enum([
  'repair_needed',
  'repair_in_progress',
  'ready_for_transfer',
  'transfer_in_progress',
  'stabilizing',
  'stable',
  'needs_attention',
]);

export const patternEvidenceCheckSummarySchema = z
  .object({
    id: z.string().min(1),
    status: rewriteCheckStatusSchema,
    outcome: rewriteCheckOutcomeSchema.nullable(),
    completedAt: z.number().nullable(),
    updatedAt: z.number(),
  })
  .superRefine((check, context) => {
    if (check.status === 'completed' && check.outcome === null) {
      context.addIssue({
        code: 'custom',
        path: ['outcome'],
        message: 'Completed rewrite checks require an outcome.',
      });
    }

    if (check.status !== 'completed' && check.outcome !== null) {
      context.addIssue({
        code: 'custom',
        path: ['outcome'],
        message: 'Rewrite check outcome is only valid when status is completed.',
      });
    }
  });

export const patternEvidenceRepairSummarySchema = z.object({
  rewriteTaskId: z.string().min(1),
  practiceKind: z.literal('rewrite_original'),
  spacedStage: z.literal('D+1'),
  status: rewritePracticeStatusSchema,
  dueAt: z.number().nullable(),
  completedAt: z.number().nullable(),
  createdAt: z.number(),
  latestCheck: patternEvidenceCheckSummarySchema.nullable(),
});

export const patternEvidenceTransferSummarySchema = z.object({
  rewriteTaskId: z.string().min(1),
  practiceKind: z.literal('new_context_reuse'),
  spacedStage: z.enum(['D+3', 'D+7']),
  status: rewritePracticeStatusSchema,
  dueAt: z.number().nullable(),
  completedAt: z.number().nullable(),
  createdAt: z.number(),
  latestCheck: patternEvidenceCheckSummarySchema.nullable(),
});

export const patternEvidenceSummarySchema = z.object({
  stage: patternEvidenceStageSchema,
  latestRepair: patternEvidenceRepairSummarySchema.nullable(),
  latestTransfer: patternEvidenceTransferSummarySchema.nullable(),
});

export const patternLifecycleSummarySchema = z.object({
  status: patternLifecycleStatusSchema,
  label: z.string().min(1),
  description: z.string().min(1),
  blockingReason: z.string().min(1).optional(),
});

export const errorPatternSnapshotSchema = z.object({
  id: z.string().min(1),
  patternKey: z.string().min(1),
  category: correctionCategorySchema,
  rule: z.string().min(1),
  canonicalExample: z.string().min(1),
  count: z.number().int().nonnegative(),
  firstSeenDateKey: z.string().min(1),
  lastSeenDateKey: z.string().min(1),
  recentExamples: z.array(z.string().min(1)),
  mergedIntoPatternId: z.string().min(1).nullable(),
  mergedAt: z.number().nullable(),
  active: z.boolean(),
  createdAt: z.number(),
  updatedAt: z.number(),
  evidence: patternEvidenceSummarySchema.optional(),
  lifecycle: patternLifecycleSummarySchema,
});

export const mergeErrorPatternsInputSchema = z
  .object({
    sourcePatternId: z.string().min(1),
    targetPatternId: z.string().min(1),
  })
  .superRefine((input, context) => {
    if (input.sourcePatternId === input.targetPatternId) {
      context.addIssue({
        code: 'custom',
        path: ['targetPatternId'],
        message: 'Choose two different patterns to merge.',
      });
    }
  });

export const mergeErrorPatternsResultSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    targetPattern: errorPatternSnapshotSchema,
  }),
  z.object({
    success: z.literal(false),
    error: z.string().min(1),
  }),
]);

export const notebookEntrySnapshotSchema = z.object({
  id: z.string().min(1),
  reviewRunId: z.string().min(1),
  dateKey: z.string().min(1),
  templateId: z.enum(['journal', 'cet4', 'cet6', 'free']),
  sourceText: z.string().min(1),
  suggestedAlternatives: z.array(z.string().min(1)),
  reason: z.string().nullable(),
  createdAt: z.number(),
});

export const listErrorPatternsOutputSchema = z.array(errorPatternSnapshotSchema);
export const listNotebookEntriesOutputSchema = z.array(notebookEntrySnapshotSchema);
export const listLearningEventsOutputSchema = z.array(learningEventSnapshotSchema);

export const LEARNING_HISTORY_FORMAT = 'inkline-learning-history' as const;
export const LEARNING_HISTORY_FORMAT_VERSION = 1 as const;
export const RESET_LEARNING_HISTORY_CONFIRMATION_TEXT = 'RESET' as const;

export const learningHistoryTableCountsSchema = z.object({
  writingAttempts: z.number().int().nonnegative(),
  writingRevisions: z.number().int().nonnegative(),
  reviewRuns: z.number().int().nonnegative(),
  errorPatterns: z.number().int().nonnegative(),
  corrections: z.number().int().nonnegative(),
  notebookEntries: z.number().int().nonnegative(),
  selfRepairAttempts: z.number().int().nonnegative(),
  referenceRewrites: z.number().int().nonnegative(),
  rewriteTasks: z.number().int().nonnegative(),
  rewriteChecks: z.number().int().nonnegative(),
  learningEvents: z.number().int().nonnegative(),
});

const nullableStringSchema = z.string().nullable();
const nullableTimestampSchema = z.number().nullable();

export const learningHistoryWritingAttemptRowSchema = z.object({
  id: z.string().min(1),
  dateKey: z.string().min(1),
  templateId: z.enum(['journal', 'cet4', 'cet6', 'free']),
  generatedPromptJson: nullableStringSchema,
  userGoal: nullableStringSchema,
  activeRevisionId: nullableStringSchema,
  lastReviewRunId: nullableStringSchema,
  reviewedAt: nullableTimestampSchema,
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const learningHistoryWritingRevisionRowSchema = z.object({
  id: z.string().min(1),
  writingAttemptId: z.string().min(1),
  content: z.string(),
  contentHash: z.string().min(1),
  createdAt: z.number(),
});

export const learningHistoryReviewRunRowSchema = z.object({
  id: z.string().min(1),
  writingAttemptId: z.string().min(1),
  writingRevisionId: nullableStringSchema,
  contentHash: z.string().min(1),
  status: z.enum(['draft', 'reviewing', 'review_ready', 'review_saved', 'review_failed', 'stale', 'discarded']),
  validationStatus: z.enum(['valid', 'valid_with_warnings', 'invalid']).nullable(),
  provider: z.string(),
  model: z.string(),
  inputSnapshotJson: nullableStringSchema,
  rawOutputJson: z.string().nullable().optional(),
  parsedOutputJson: nullableStringSchema,
  previewOperationsJson: nullableStringSchema,
  validationErrorsJson: nullableStringSchema,
  summaryJson: nullableStringSchema,
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const learningHistoryErrorPatternRowSchema = z.object({
  id: z.string().min(1),
  patternKey: z.string().min(1),
  category: correctionCategorySchema,
  rule: z.string(),
  canonicalExample: z.string(),
  count: z.number().int().nonnegative(),
  firstSeenDateKey: z.string().min(1),
  lastSeenDateKey: z.string().min(1),
  recentExamplesJson: z.string(),
  fingerprintJson: nullableStringSchema,
  mergedIntoPatternId: nullableStringSchema,
  mergedAt: nullableTimestampSchema,
  active: z.boolean(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const learningHistoryCorrectionRowSchema = z.object({
  id: z.string().min(1),
  reviewRunId: z.string().min(1),
  patternId: nullableStringSchema,
  pattern: z.string(),
  originalText: z.string(),
  correctedText: z.string(),
  explanation: z.string(),
  category: z.enum(['fix', 'upgrade', 'model']),
  status: z.enum(['suggested', 'kept', 'dismissed', 'stale', 'low_confidence']),
  startOffset: z.number().int(),
  endOffset: z.number().int(),
});

export const learningHistoryNotebookEntryRowSchema = z.object({
  id: z.string().min(1),
  reviewRunId: z.string().min(1),
  dateKey: z.string().min(1),
  templateId: z.enum(['journal', 'cet4', 'cet6', 'free']),
  sourceText: z.string(),
  suggestedAlternativesJson: z.string(),
  reason: nullableStringSchema,
  createdAt: z.number(),
});

export const learningHistorySelfRepairAttemptRowSchema = z.object({
  id: z.string().min(1),
  reviewRunId: z.string().min(1),
  correctionId: nullableStringSchema,
  attemptText: z.string(),
  result: z.enum(['correct', 'partly_correct', 'incorrect', 'skipped', 'revealed_without_attempt']),
  createdAt: z.number(),
});

export const learningHistoryReferenceRewriteRowSchema = z.object({
  id: z.string().min(1),
  reviewRunId: z.string().min(1),
  rewriteText: z.string(),
  noticeTheGap: z.string(),
  createdAt: z.number(),
});

export const learningHistoryRewriteTaskRowSchema = z.object({
  id: z.string().min(1),
  reviewRunId: z.string().min(1),
  originalSentence: z.string(),
  focusPattern: z.string(),
  nativeModelSentence: z.string(),
  prompt: z.string(),
  promptContractJson: nullableStringSchema,
  kind: z.enum(['rewrite_original', 'new_context_reuse', 'pattern_detection']),
  spacedStage: z.string(),
  status: rewritePracticeStatusSchema,
  userRewriteText: nullableStringSchema,
  dueAt: nullableTimestampSchema,
  completedAt: nullableTimestampSchema,
  skippedAt: nullableTimestampSchema,
  createdAt: z.number(),
});

export const learningHistoryRewriteCheckRowSchema = z
  .object({
    id: z.string().min(1),
    rewriteTaskId: z.string().min(1),
    status: rewriteCheckStatusSchema,
    outcome: rewriteCheckOutcomeSchema.nullable(),
    feedback: nullableStringSchema,
    provider: nullableStringSchema,
    model: nullableStringSchema,
    validationErrorsJson: nullableStringSchema,
    errorMessage: nullableStringSchema,
    diagnosticsJson: nullableStringSchema,
    createdAt: z.number(),
    updatedAt: z.number(),
    completedAt: nullableTimestampSchema,
  })
  .superRefine((check, context) => {
    if (check.status === 'completed' && check.outcome === null) {
      context.addIssue({
        code: 'custom',
        path: ['outcome'],
        message: 'Completed rewrite checks require an outcome.',
      });
    }

    if (check.status !== 'completed' && check.outcome !== null) {
      context.addIssue({
        code: 'custom',
        path: ['outcome'],
        message: 'Rewrite check outcome is only valid when status is completed.',
      });
    }
  });

export const learningHistoryLearningEventRowSchema = z.object({
  id: z.string().min(1),
  eventType: learningEventTypeSchema,
  occurredAt: z.number(),
  dedupeKey: nullableStringSchema,
  reviewRunId: nullableStringSchema,
  patternId: nullableStringSchema,
  rewriteTaskId: nullableStringSchema,
  rewriteCheckId: nullableStringSchema,
  payloadJson: z.string(),
  createdAt: z.number(),
});

export const learningHistoryExportTablesSchema = z.object({
  writingAttempts: z.array(learningHistoryWritingAttemptRowSchema),
  writingRevisions: z.array(learningHistoryWritingRevisionRowSchema),
  reviewRuns: z.array(learningHistoryReviewRunRowSchema),
  errorPatterns: z.array(learningHistoryErrorPatternRowSchema),
  corrections: z.array(learningHistoryCorrectionRowSchema),
  notebookEntries: z.array(learningHistoryNotebookEntryRowSchema),
  selfRepairAttempts: z.array(learningHistorySelfRepairAttemptRowSchema),
  referenceRewrites: z.array(learningHistoryReferenceRewriteRowSchema),
  rewriteTasks: z.array(learningHistoryRewriteTaskRowSchema),
  rewriteChecks: z.array(learningHistoryRewriteCheckRowSchema),
  learningEvents: z.array(learningHistoryLearningEventRowSchema),
});

export const learningHistoryExportManifestSchema = z.object({
  formatVersion: z.literal(LEARNING_HISTORY_FORMAT_VERSION),
  exportedAt: z.number(),
  includeRawProviderOutput: z.boolean(),
  counts: learningHistoryTableCountsSchema,
  tablesChecksum: z.string().regex(/^sha256:[a-f0-9]{64}$/),
});

export const learningHistoryExportDocumentSchema = z
  .object({
    format: z.literal(LEARNING_HISTORY_FORMAT),
    formatVersion: z.literal(LEARNING_HISTORY_FORMAT_VERSION),
    appName: z.literal('Inkline'),
    appVersion: z.string().min(1),
    exportedAt: z.number(),
    tables: learningHistoryExportTablesSchema,
    manifest: learningHistoryExportManifestSchema,
  })
  .superRefine((document, context) => {
    if (document.manifest.exportedAt !== document.exportedAt) {
      context.addIssue({
        code: 'custom',
        path: ['manifest', 'exportedAt'],
        message: 'Manifest exportedAt must match the export document.',
      });
    }

    const counts = countLearningHistoryTables(document.tables);
    const countKeys = Object.keys(counts) as Array<keyof LearningHistoryTableCounts>;
    countKeys.forEach((key) => {
      if (document.manifest.counts[key] !== counts[key]) {
        context.addIssue({
          code: 'custom',
          path: ['manifest', 'counts', key],
          message: `Manifest count for ${key} does not match the table payload.`,
        });
      }
    });
  });

export const exportLearningHistoryInputSchema = z
  .object({
    includeRawProviderOutput: z.boolean().optional(),
  })
  .default({});

export const learningHistoryExportSuccessResultSchema = z.object({
  success: z.literal(true),
  canceled: z.literal(false),
  filePath: z.string().min(1),
  manifest: learningHistoryExportManifestSchema,
  includeRawProviderOutput: z.boolean(),
  byteSize: z.number().int().nonnegative(),
});

export const learningHistoryExportCanceledResultSchema = z.object({
  success: z.literal(true),
  canceled: z.literal(true),
});

export const learningHistoryExportFailureResultSchema = z.object({
  success: z.literal(false),
  error: z.string().min(1),
});

export const learningHistoryExportResultSchema = z.union([
  learningHistoryExportSuccessResultSchema,
  learningHistoryExportCanceledResultSchema,
  learningHistoryExportFailureResultSchema,
]);

export const resetLearningHistoryInputSchema = z.object({
  confirmationText: z.string().optional().default(''),
  includeRawProviderOutput: z.boolean().optional(),
});

export const resetLearningHistorySuccessResultSchema = z.object({
  success: z.literal(true),
  backupFilePath: z.string().min(1),
  backupManifest: learningHistoryExportManifestSchema,
  includeRawProviderOutput: z.boolean(),
  resetCounts: learningHistoryTableCountsSchema,
});

export const resetLearningHistoryFailureResultSchema = z.object({
  success: z.literal(false),
  error: z.string().min(1),
});

export const resetLearningHistoryResultSchema = z.discriminatedUnion('success', [
  resetLearningHistorySuccessResultSchema,
  resetLearningHistoryFailureResultSchema,
]);

export const previewLearningHistoryImportSuccessResultSchema = z.object({
  success: z.literal(true),
  canceled: z.literal(false),
  filePath: z.string().min(1),
  manifest: learningHistoryExportManifestSchema,
  counts: learningHistoryTableCountsSchema,
  formatVersion: z.literal(LEARNING_HISTORY_FORMAT_VERSION),
});

export const previewLearningHistoryImportCanceledResultSchema = z.object({
  success: z.literal(true),
  canceled: z.literal(true),
});

export const previewLearningHistoryImportFailureResultSchema = z.object({
  success: z.literal(false),
  error: z.string().min(1),
});

export const previewLearningHistoryImportResultSchema = z.union([
  previewLearningHistoryImportSuccessResultSchema,
  previewLearningHistoryImportCanceledResultSchema,
  previewLearningHistoryImportFailureResultSchema,
]);

export function countLearningHistoryTables(tables: LearningHistoryExportTables): LearningHistoryTableCounts {
  return {
    writingAttempts: tables.writingAttempts.length,
    writingRevisions: tables.writingRevisions.length,
    reviewRuns: tables.reviewRuns.length,
    errorPatterns: tables.errorPatterns.length,
    corrections: tables.corrections.length,
    notebookEntries: tables.notebookEntries.length,
    selfRepairAttempts: tables.selfRepairAttempts.length,
    referenceRewrites: tables.referenceRewrites.length,
    rewriteTasks: tables.rewriteTasks.length,
    rewriteChecks: tables.rewriteChecks.length,
    learningEvents: tables.learningEvents.length,
  };
}

export type LearningEventType = z.infer<typeof learningEventTypeSchema>;
export type LearningEventSnapshot = z.infer<typeof learningEventSnapshotSchema>;
export type ErrorPatternSnapshot = z.infer<typeof errorPatternSnapshotSchema>;
export type MergeErrorPatternsInput = z.infer<typeof mergeErrorPatternsInputSchema>;
export type MergeErrorPatternsResult = z.infer<typeof mergeErrorPatternsResultSchema>;
export type NotebookEntrySnapshot = z.infer<typeof notebookEntrySnapshotSchema>;
export type PatternEvidenceStage = z.infer<typeof patternEvidenceStageSchema>;
export type PatternLifecycleStatus = z.infer<typeof patternLifecycleStatusSchema>;
export type PatternEvidenceCheckSummary = z.infer<typeof patternEvidenceCheckSummarySchema>;
export type PatternEvidenceRepairSummary = z.infer<typeof patternEvidenceRepairSummarySchema>;
export type PatternEvidenceTransferSummary = z.infer<typeof patternEvidenceTransferSummarySchema>;
export type PatternEvidenceSummary = z.infer<typeof patternEvidenceSummarySchema>;
export type PatternLifecycleSummary = z.infer<typeof patternLifecycleSummarySchema>;
export type ListErrorPatternsOutput = z.infer<typeof listErrorPatternsOutputSchema>;
export type ListNotebookEntriesOutput = z.infer<typeof listNotebookEntriesOutputSchema>;
export type ListLearningEventsOutput = z.infer<typeof listLearningEventsOutputSchema>;
export type LearningHistoryTableCounts = z.infer<typeof learningHistoryTableCountsSchema>;
export type LearningHistoryExportTables = z.infer<typeof learningHistoryExportTablesSchema>;
export type LearningHistoryExportManifest = z.infer<typeof learningHistoryExportManifestSchema>;
export type LearningHistoryExportDocument = z.infer<typeof learningHistoryExportDocumentSchema>;
export type ExportLearningHistoryInput = z.infer<typeof exportLearningHistoryInputSchema>;
export type LearningHistoryExportResult = z.infer<typeof learningHistoryExportResultSchema>;
export type ResetLearningHistoryInput = z.infer<typeof resetLearningHistoryInputSchema>;
export type ResetLearningHistoryResult = z.infer<typeof resetLearningHistoryResultSchema>;
export type PreviewLearningHistoryImportResult = z.infer<typeof previewLearningHistoryImportResultSchema>;
