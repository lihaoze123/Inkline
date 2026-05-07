import { z } from 'zod';
import { patternTypeSchema } from '../review-contract/schemas';
import { writingTemplateTrackGuidanceSchema, type WritingTemplateTrackGuidance } from '../writing/track-guidance';

export { writingTemplateTrackGuidanceSchema, type WritingTemplateTrackGuidance };

export const reviewRunStatusSchema = z.enum([
  'draft',
  'reviewing',
  'review_ready',
  'review_saved',
  'review_failed',
  'stale',
  'discarded',
]);

export const writingTemplateIdSchema = z.enum(['journal', 'cet4', 'cet6', 'free']);

export const writingTemplateSchema = z.object({
  id: writingTemplateIdSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  starterPromptBehavior: z.string().min(1),
  reviewFocus: z.string().min(1),
  scenarioContext: z.string().optional(),
  trackGuidance: writingTemplateTrackGuidanceSchema.optional(),
});

export const writingRevisionSchema = z.object({
  id: z.string().min(1),
  writingAttemptId: z.string().min(1),
  content: z.string(),
  contentHash: z.string().min(1),
  createdAt: z.number(),
});

export const staleReviewSchema = z.object({
  id: z.string().min(1),
  reviewedContentHash: z.string().min(1),
  createdAt: z.number(),
});

export const rewritePracticeStatusSchema = z.enum([
  'pending',
  'in_progress',
  'completed',
  'skipped',
  'snoozed',
  'expired',
]);

export const rewritePracticeKindSchema = z.enum(['rewrite_original', 'new_context_reuse']);

export const rewriteSpacedStageSchema = z.enum(['D+1', 'D+3', 'D+7']);

export const rewriteCheckStatusSchema = z.enum(['pending', 'in_progress', 'completed', 'failed', 'retryable']);

export const rewriteCheckOutcomeSchema = z.enum(['correct', 'partly_correct', 'incorrect']);

export const rewriteCheckFeedbackSchema = z.object({
  message: z.string().min(1),
  nextStep: z.string().min(1).optional(),
});

export const rewriteCheckSnapshotSchema = z
  .object({
    id: z.string().min(1),
    rewriteTaskId: z.string().min(1),
    status: rewriteCheckStatusSchema,
    outcome: rewriteCheckOutcomeSchema.nullable(),
    feedback: rewriteCheckFeedbackSchema.nullable(),
    provider: z.string().min(1).nullable(),
    model: z.string().min(1).nullable(),
    validationErrors: z.array(z.string().min(1)).nullable(),
    errorMessage: z.string().min(1).nullable(),
    diagnostics: z.record(z.string(), z.unknown()).nullable(),
    createdAt: z.number(),
    updatedAt: z.number(),
    completedAt: z.number().nullable(),
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

export const newContextPromptContractSchema = z.object({
  targetMeaning: z.string().min(1),
  allowedHints: z.array(z.string().min(1)),
  forbiddenHints: z.array(z.string().min(1)),
  expectedPatternFamily: patternTypeSchema,
});

export const rewritePracticeSnapshotSchema = z.object({
  id: z.string().min(1),
  reviewRunId: z.string().min(1),
  originalSentence: z.string().min(1),
  focusPattern: z.string().min(1),
  nativeModelSentence: z.string(),
  prompt: z.string().min(1),
  practiceKind: rewritePracticeKindSchema,
  spacedStage: rewriteSpacedStageSchema,
  status: rewritePracticeStatusSchema,
  userRewriteText: z.string().nullable(),
  latestRewriteCheck: rewriteCheckSnapshotSchema.nullable(),
  dueAt: z.number().nullable(),
  createdAt: z.number(),
  isOlderThanSevenDays: z.boolean(),
});

export const starterPromptSchema = z.object({
  text: z.string().min(1),
  generatedAt: z.number(),
});

export const writingAttemptSnapshotSchema = z.object({
  attemptId: z.string().min(1),
  dateKey: z.string().min(1),
  templateId: writingTemplateIdSchema,
  template: writingTemplateSchema,
  generatedPrompt: starterPromptSchema.nullable(),
  userGoal: z.string().nullable(),
  activeRevision: writingRevisionSchema.nullable(),
  lastAutosaveAt: z.number().nullable(),
  lastReviewRunId: z.string().nullable(),
  staleReview: staleReviewSchema.nullable(),
  pendingRewritePractice: rewritePracticeSnapshotSchema.nullable(),
});

export const getWritingAttemptInputSchema = z.object({
  templateId: writingTemplateIdSchema,
});

export const saveWritingAttemptInputSchema = z.object({
  templateId: writingTemplateIdSchema.default('journal'),
  content: z.string(),
  userGoal: z.string().optional(),
});

export const saveWritingAttemptResultSchema = writingAttemptSnapshotSchema.extend({
  saved: z.boolean(),
});

export const completeRewritePracticeInputSchema = z.object({
  rewriteTaskId: z.string().min(1),
  userRewriteText: z.string().trim().min(1),
});

export const skipRewritePracticeInputSchema = z.object({
  rewriteTaskId: z.string().min(1),
});

export const snoozeRewritePracticeInputSchema = z.object({
  rewriteTaskId: z.string().min(1),
});

export const rewritePracticeUpdateResultSchema = z.object({
  success: z.boolean(),
  writing: writingAttemptSnapshotSchema.optional(),
  rewritePractice: rewritePracticeSnapshotSchema.nullable().optional(),
  error: z.string().optional(),
});

export const completeRewritePracticeResultSchema = rewritePracticeUpdateResultSchema;
export const snoozeRewritePracticeResultSchema = rewritePracticeUpdateResultSchema;

export const retryRewriteCheckInputSchema = z.object({
  rewriteTaskId: z.string().min(1),
});

export const retryRewriteCheckResultSchema = z.object({
  success: z.boolean(),
  writing: writingAttemptSnapshotSchema.optional(),
  rewritePractice: rewritePracticeSnapshotSchema.nullable().optional(),
  rewriteCheck: rewriteCheckSnapshotSchema.nullable().optional(),
  error: z.string().optional(),
});

export const generateStarterPromptInputSchema = z.object({
  templateId: writingTemplateIdSchema,
  userGoal: z.string().optional(),
});

export const generateStarterPromptResultSchema = z.object({
  success: z.boolean(),
  writing: writingAttemptSnapshotSchema.optional(),
  starterPrompt: starterPromptSchema.optional(),
  disclosureRequired: z.boolean().optional(),
  error: z.string().optional(),
});

export const acknowledgeStarterPromptDisclosureInputSchema = z.object({
  acknowledged: z.literal(true),
});

export type ReviewRunStatus = z.infer<typeof reviewRunStatusSchema>;
export type WritingTemplateId = z.infer<typeof writingTemplateIdSchema>;
export type WritingTemplate = z.infer<typeof writingTemplateSchema>;
export type WritingRevisionSnapshot = z.infer<typeof writingRevisionSchema>;
export type StaleReviewSnapshot = z.infer<typeof staleReviewSchema>;
export type StarterPromptSnapshot = z.infer<typeof starterPromptSchema>;
export type RewritePracticeStatus = z.infer<typeof rewritePracticeStatusSchema>;
export type RewritePracticeKind = z.infer<typeof rewritePracticeKindSchema>;
export type RewriteSpacedStage = z.infer<typeof rewriteSpacedStageSchema>;
export type RewriteCheckStatus = z.infer<typeof rewriteCheckStatusSchema>;
export type RewriteCheckOutcome = z.infer<typeof rewriteCheckOutcomeSchema>;
export type RewriteCheckFeedback = z.infer<typeof rewriteCheckFeedbackSchema>;
export type RewriteCheckSnapshot = z.infer<typeof rewriteCheckSnapshotSchema>;
export type NewContextPromptContract = z.infer<typeof newContextPromptContractSchema>;
export type RewritePracticeSnapshot = z.infer<typeof rewritePracticeSnapshotSchema>;
export type WritingAttemptSnapshot = z.infer<typeof writingAttemptSnapshotSchema>;
export type GetWritingAttemptInput = z.infer<typeof getWritingAttemptInputSchema>;
export type SaveWritingAttemptInput = z.infer<typeof saveWritingAttemptInputSchema>;
export type SaveWritingAttemptResult = z.infer<typeof saveWritingAttemptResultSchema>;
export type CompleteRewritePracticeInput = z.infer<typeof completeRewritePracticeInputSchema>;
export type SkipRewritePracticeInput = z.infer<typeof skipRewritePracticeInputSchema>;
export type SnoozeRewritePracticeInput = z.infer<typeof snoozeRewritePracticeInputSchema>;
export type RewritePracticeUpdateResult = z.infer<typeof rewritePracticeUpdateResultSchema>;
export type CompleteRewritePracticeResult = z.infer<typeof completeRewritePracticeResultSchema>;
export type SnoozeRewritePracticeResult = z.infer<typeof snoozeRewritePracticeResultSchema>;
export type RetryRewriteCheckInput = z.infer<typeof retryRewriteCheckInputSchema>;
export type RetryRewriteCheckResult = z.infer<typeof retryRewriteCheckResultSchema>;
export type GenerateStarterPromptInput = z.infer<typeof generateStarterPromptInputSchema>;
export type GenerateStarterPromptResult = z.infer<typeof generateStarterPromptResultSchema>;
export type AcknowledgeStarterPromptDisclosureInput = z.infer<typeof acknowledgeStarterPromptDisclosureInputSchema>;
