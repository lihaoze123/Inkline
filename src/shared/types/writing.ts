import { z } from 'zod';

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

export const rewritePracticeSnapshotSchema = z.object({
  id: z.string().min(1),
  reviewRunId: z.string().min(1),
  originalSentence: z.string().min(1),
  focusPattern: z.string().min(1),
  nativeModelSentence: z.string(),
  prompt: z.string().min(1),
  practiceKind: z.literal('rewrite_original'),
  spacedStage: z.literal('D+1'),
  status: rewritePracticeStatusSchema,
  userRewriteText: z.string().nullable(),
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

export const rewritePracticeUpdateResultSchema = z.object({
  success: z.boolean(),
  writing: writingAttemptSnapshotSchema.optional(),
  rewritePractice: rewritePracticeSnapshotSchema.nullable().optional(),
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
export type RewritePracticeSnapshot = z.infer<typeof rewritePracticeSnapshotSchema>;
export type WritingAttemptSnapshot = z.infer<typeof writingAttemptSnapshotSchema>;
export type GetWritingAttemptInput = z.infer<typeof getWritingAttemptInputSchema>;
export type SaveWritingAttemptInput = z.infer<typeof saveWritingAttemptInputSchema>;
export type SaveWritingAttemptResult = z.infer<typeof saveWritingAttemptResultSchema>;
export type CompleteRewritePracticeInput = z.infer<typeof completeRewritePracticeInputSchema>;
export type SkipRewritePracticeInput = z.infer<typeof skipRewritePracticeInputSchema>;
export type RewritePracticeUpdateResult = z.infer<typeof rewritePracticeUpdateResultSchema>;
export type GenerateStarterPromptInput = z.infer<typeof generateStarterPromptInputSchema>;
export type GenerateStarterPromptResult = z.infer<typeof generateStarterPromptResultSchema>;
export type AcknowledgeStarterPromptDisclosureInput = z.infer<typeof acknowledgeStarterPromptDisclosureInputSchema>;
