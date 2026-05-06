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
