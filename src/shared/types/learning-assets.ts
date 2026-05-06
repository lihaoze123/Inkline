import { z } from 'zod';
import { correctionCategorySchema } from '../review-contract/schemas';
import { rewriteCheckOutcomeSchema, rewriteCheckStatusSchema, rewritePracticeStatusSchema } from './writing';

export const patternEvidenceStageSchema = z.enum([
  'needs_repair',
  'repaired_once',
  'transferred_once',
  'stable_after_spaced_reuse',
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

export const patternEvidenceSummarySchema = z.object({
  stage: patternEvidenceStageSchema,
  latestRepair: patternEvidenceRepairSummarySchema.nullable(),
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
  active: z.boolean(),
  createdAt: z.number(),
  updatedAt: z.number(),
  evidence: patternEvidenceSummarySchema.optional(),
});

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

export type ErrorPatternSnapshot = z.infer<typeof errorPatternSnapshotSchema>;
export type NotebookEntrySnapshot = z.infer<typeof notebookEntrySnapshotSchema>;
export type PatternEvidenceStage = z.infer<typeof patternEvidenceStageSchema>;
export type PatternEvidenceCheckSummary = z.infer<typeof patternEvidenceCheckSummarySchema>;
export type PatternEvidenceRepairSummary = z.infer<typeof patternEvidenceRepairSummarySchema>;
export type PatternEvidenceSummary = z.infer<typeof patternEvidenceSummarySchema>;
export type ListErrorPatternsOutput = z.infer<typeof listErrorPatternsOutputSchema>;
export type ListNotebookEntriesOutput = z.infer<typeof listNotebookEntriesOutputSchema>;
