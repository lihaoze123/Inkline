import { z } from 'zod';
import {
  validationStatusSchema,
  reviewOutputSchema,
  correctionCategorySchema,
  confidenceSchema,
  correctionStatusSchema,
  newPatternSuggestionSchema,
} from '../review-contract/schemas';
import { aiProviderDiagnosticsSchema } from './ai';
import { writingAttemptSnapshotSchema } from './writing';

export const acknowledgeReviewDisclosureInputSchema = z.object({
  acknowledged: z.literal(true),
});

export const startReviewInputSchema = z.object({
  writingAttemptId: z.string().min(1),
  writingRevisionId: z.string().min(1),
});

export const reviewProgressPhaseSchema = z.enum(['preparing', 'requesting', 'waiting', 'checking', 'building_preview']);
export const reviewProgressEventKindSchema = z.enum(['started', 'completed', 'failed']);
export const reviewErrorCategorySchema = z.enum([
  'missing_config',
  'provider_error',
  'timeout',
  'invalid_json',
  'validation_failed',
  'stale_content',
]);
export const reviewRunResultKindSchema = z.enum(['ready', 'ready_with_warnings', 'failed', 'stale', 'saved']);

export const reviewPhaseTimingsSchema = z.object({
  preparing: z.number().int().nonnegative().nullable(),
  requesting: z.number().int().nonnegative().nullable(),
  waiting: z.number().int().nonnegative().nullable(),
  checking: z.number().int().nonnegative().nullable(),
  building_preview: z.number().int().nonnegative().nullable(),
});

export const reviewStatsSchema = z.object({
  anchoredCorrections: z.number().int().nonnegative(),
  lowConfidenceCorrections: z.number().int().nonnegative(),
  generatedRewriteTasks: z.number().int().nonnegative(),
  generatedSelfRepairAttempts: z.number().int().nonnegative(),
  generatedReferenceRewrites: z.number().int().nonnegative(),
});

export const reviewRunSummarySchema = z.object({
  startedAt: z.number(),
  completedAt: z.number().nullable(),
  durationMs: z.number().int().nonnegative().nullable(),
  phaseTimings: reviewPhaseTimingsSchema,
  resultKind: reviewRunResultKindSchema,
  errorCategory: reviewErrorCategorySchema.nullable(),
  providerStatus: z.string().nullable(),
  providerDiagnostics: aiProviderDiagnosticsSchema.nullable().default(null),
  reviewStats: reviewStatsSchema,
  warningCount: z.number().int().nonnegative(),
  rawSaved: z.boolean(),
});

export const reviewProgressEventSchema = z.object({
  runId: z.string().min(1),
  phase: reviewProgressPhaseSchema,
  event: reviewProgressEventKindSchema,
  at: z.number(),
  elapsedMs: z.number().int().nonnegative(),
  message: z.string().optional(),
  errorCategory: reviewErrorCategorySchema.optional(),
});

export const reviewRunSnapshotSchema = z.object({
  id: z.string().min(1),
  writingAttemptId: z.string().min(1),
  writingRevisionId: z.string().min(1).nullable(),
  contentHash: z.string().min(1),
  status: z.enum(['draft', 'reviewing', 'review_ready', 'review_saved', 'review_failed', 'stale', 'discarded']),
  validationStatus: validationStatusSchema.nullable(),
  provider: z.string().min(1),
  model: z.string().min(1),
  validationErrors: z.array(z.string()),
  summary: reviewRunSummarySchema.nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const anchoredCorrectionOperationSchema = z.object({
  correctionIndex: z.number().int().nonnegative(),
  originalText: z.string().min(1),
  correctedText: z.string().min(1),
  explanation: z.string().min(1),
  category: correctionCategorySchema,
  confidence: confidenceSchema,
  status: correctionStatusSchema,
  startOffset: z.number().int().nonnegative().nullable(),
  endOffset: z.number().int().nonnegative().nullable(),
  contentHash: z.string().min(1),
  matchedPatternId: z.string().min(1).nullable(),
  newPatternSuggestion: newPatternSuggestionSchema.nullable(),
  lowConfidenceReason: z.string().optional(),
});

export const patternOperationSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('reuse_pattern'),
    correctionIndex: z.number().int().nonnegative(),
    patternId: z.string().min(1),
    updatesLongTermStats: z.literal(false),
  }),
  z.object({
    kind: z.literal('suggest_new_pattern'),
    correctionIndex: z.number().int().nonnegative(),
    category: correctionCategorySchema,
    rule: z.string().min(1),
    canonicalExample: z.string().min(1),
    patternKey: z.string().min(1),
    duplicateOfPatternId: z.string().min(1).optional(),
    updatesLongTermStats: z.literal(false),
  }),
]);

export const previewOperationsSnapshotSchema = z.object({
  corrections: z.array(anchoredCorrectionOperationSchema),
  patternOperations: z.array(patternOperationSchema),
  referenceRewrites: z.array(
    z.object({
      rewriteIndex: z.number().int().nonnegative(),
      text: z.string().min(1),
      noticeTheGap: z.string().min(1),
      updatesLongTermStats: z.literal(false),
    }),
  ),
  selfRepair: z
    .object({
      correctionIndex: z.number().int().nonnegative(),
      prompt: z.string().min(1),
      hint: z.string().min(1),
      updatesLongTermStats: z.literal(false),
    })
    .nullable(),
  rewritePractice: z.array(
    z.object({
      taskIndex: z.number().int().nonnegative(),
      kind: z.literal('rewrite_original'),
      prompt: z.string().min(1),
      focusCorrectionIndexes: z.array(z.number().int().nonnegative()),
      dueOffsetDays: z.number().int().positive(),
      revealNativeModelAfterSubmit: z.boolean(),
      updatesLongTermStats: z.literal(false),
    }),
  ),
  upgradeOpportunities: z.array(
    z.object({
      opportunityIndex: z.number().int().nonnegative(),
      sourceText: z.string().min(1),
      suggestedAlternatives: z.array(z.string().min(1)).min(1).max(3),
      reason: z.string().nullable(),
      updatesLongTermStats: z.literal(false),
    }),
  ),
  inputBridge: z
    .object({
      correctionIndex: z.number().int().nonnegative(),
      examples: z.array(z.string().min(1)),
      updatesLongTermStats: z.literal(false),
    })
    .nullable(),
});

export const reviewPreviewSnapshotSchema = z.object({
  reviewRun: reviewRunSnapshotSchema,
  reviewedContent: z.string(),
  parsedOutput: reviewOutputSchema,
  operations: previewOperationsSnapshotSchema,
  currentWritingContentHash: z.string().min(1).nullable(),
  isStaleForCurrentWriting: z.boolean(),
});

export const getReviewPreviewInputSchema = z.object({
  reviewRunId: z.string().min(1),
});

export const saveReviewInputSchema = z.object({
  reviewRunId: z.string().min(1),
  selfRepairAttemptText: z.string().optional(),
  revealedWithoutAttempt: z.boolean().optional(),
});

export const saveReviewOutputSchema = z.object({
  success: z.boolean(),
  reviewRun: reviewRunSnapshotSchema.optional(),
  writing: writingAttemptSnapshotSchema.optional(),
  error: z.string().optional(),
});

export const startReviewOutputSchema = z.object({
  success: z.boolean(),
  reviewRun: reviewRunSnapshotSchema.optional(),
  preview: reviewPreviewSnapshotSchema.optional(),
  disclosureRequired: z.boolean().optional(),
  error: z.string().optional(),
});

export type AcknowledgeReviewDisclosureInput = z.infer<typeof acknowledgeReviewDisclosureInputSchema>;
export type StartReviewInput = z.infer<typeof startReviewInputSchema>;
export type ReviewProgressPhase = z.infer<typeof reviewProgressPhaseSchema>;
export type ReviewErrorCategory = z.infer<typeof reviewErrorCategorySchema>;
export type ReviewRunResultKind = z.infer<typeof reviewRunResultKindSchema>;
export type ReviewPhaseTimings = z.infer<typeof reviewPhaseTimingsSchema>;
export type ReviewStats = z.infer<typeof reviewStatsSchema>;
export type ReviewRunSummary = z.infer<typeof reviewRunSummarySchema>;
export type ReviewProgressEvent = z.infer<typeof reviewProgressEventSchema>;
export type ReviewRunSnapshot = z.infer<typeof reviewRunSnapshotSchema>;
export type AnchoredCorrectionOperationSnapshot = z.infer<typeof anchoredCorrectionOperationSchema>;
export type PatternOperationSnapshot = z.infer<typeof patternOperationSchema>;
export type PreviewOperationsSnapshot = z.infer<typeof previewOperationsSnapshotSchema>;
export type ReviewPreviewSnapshot = z.infer<typeof reviewPreviewSnapshotSchema>;
export type GetReviewPreviewInput = z.infer<typeof getReviewPreviewInputSchema>;
export type SaveReviewInput = z.infer<typeof saveReviewInputSchema>;
export type SaveReviewOutput = z.infer<typeof saveReviewOutputSchema>;
export type StartReviewOutput = z.infer<typeof startReviewOutputSchema>;
