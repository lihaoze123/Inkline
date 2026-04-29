import { z } from 'zod';
import { validationStatusSchema, reviewOutputSchema, correctionCategorySchema, confidenceSchema, correctionStatusSchema } from '../review-contract/schemas';
import { todayJournalSnapshotSchema } from './journal';

export const acknowledgeReviewDisclosureInputSchema = z.object({
  acknowledged: z.literal(true),
});

export const startReviewInputSchema = z.object({
  journalEntryId: z.string().min(1),
  journalRevisionId: z.string().min(1),
});

export const reviewRunSnapshotSchema = z.object({
  id: z.string().min(1),
  journalEntryId: z.string().min(1),
  journalRevisionId: z.string().min(1).nullable(),
  contentHash: z.string().min(1),
  status: z.enum(['draft', 'reviewing', 'review_ready', 'review_saved', 'review_failed', 'stale', 'discarded']),
  validationStatus: validationStatusSchema.nullable(),
  provider: z.string().min(1),
  model: z.string().min(1),
  validationErrors: z.array(z.string()),
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
  newPatternSuggestion: z.unknown().nullable(),
  lowConfidenceReason: z.string().optional(),
});

export const previewOperationsSnapshotSchema = z.object({
  corrections: z.array(anchoredCorrectionOperationSchema),
  patternOperations: z.array(z.unknown()),
  referenceRewrites: z.array(z.object({
    rewriteIndex: z.number().int().nonnegative(),
    text: z.string().min(1),
    noticeTheGap: z.string().min(1),
    updatesLongTermStats: z.literal(false),
  })),
  selfRepair: z.object({
    correctionIndex: z.number().int().nonnegative(),
    prompt: z.string().min(1),
    hint: z.string().min(1),
    updatesLongTermStats: z.literal(false),
  }).nullable(),
  rewritePractice: z.array(z.object({
    taskIndex: z.number().int().nonnegative(),
    kind: z.literal('rewrite_original'),
    prompt: z.string().min(1),
    focusCorrectionIndexes: z.array(z.number().int().nonnegative()),
    dueOffsetDays: z.number().int().positive(),
    revealNativeModelAfterSubmit: z.boolean(),
    updatesLongTermStats: z.literal(false),
  })),
  inputBridge: z.object({
    correctionIndex: z.number().int().nonnegative(),
    examples: z.array(z.string().min(1)),
    updatesLongTermStats: z.literal(false),
  }).nullable(),
});

export const reviewPreviewSnapshotSchema = z.object({
  reviewRun: reviewRunSnapshotSchema,
  reviewedContent: z.string(),
  parsedOutput: reviewOutputSchema,
  operations: previewOperationsSnapshotSchema,
  currentJournalContentHash: z.string().min(1).nullable(),
  isStaleForCurrentJournal: z.boolean(),
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
  journal: todayJournalSnapshotSchema.optional(),
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
export type ReviewRunSnapshot = z.infer<typeof reviewRunSnapshotSchema>;
export type AnchoredCorrectionOperationSnapshot = z.infer<typeof anchoredCorrectionOperationSchema>;
export type PreviewOperationsSnapshot = z.infer<typeof previewOperationsSnapshotSchema>;
export type ReviewPreviewSnapshot = z.infer<typeof reviewPreviewSnapshotSchema>;
export type GetReviewPreviewInput = z.infer<typeof getReviewPreviewInputSchema>;
export type SaveReviewInput = z.infer<typeof saveReviewInputSchema>;
export type SaveReviewOutput = z.infer<typeof saveReviewOutputSchema>;
export type StartReviewOutput = z.infer<typeof startReviewOutputSchema>;
