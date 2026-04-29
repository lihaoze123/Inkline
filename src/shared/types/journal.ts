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

export const journalRevisionSchema = z.object({
  id: z.string().min(1),
  journalEntryId: z.string().min(1),
  content: z.string(),
  contentHash: z.string().min(1),
  createdAt: z.number(),
});

export const staleReviewSchema = z.object({
  id: z.string().min(1),
  reviewedContentHash: z.string().min(1),
  createdAt: z.number(),
});

export const rewritePracticeStatusSchema = z.enum(['pending', 'in_progress', 'completed', 'skipped', 'snoozed', 'expired']);

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

export const todayJournalSnapshotSchema = z.object({
  entryId: z.string().min(1),
  dateKey: z.string().min(1),
  activeRevision: journalRevisionSchema.nullable(),
  lastAutosaveAt: z.number().nullable(),
  lastReviewRunId: z.string().nullable(),
  staleReview: staleReviewSchema.nullable(),
  pendingRewritePractice: rewritePracticeSnapshotSchema.nullable(),
});

export const saveTodayJournalInputSchema = z.object({
  content: z.string(),
});

export const saveTodayJournalResultSchema = todayJournalSnapshotSchema.extend({
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
  journal: todayJournalSnapshotSchema.optional(),
  rewritePractice: rewritePracticeSnapshotSchema.nullable().optional(),
  error: z.string().optional(),
});

export type ReviewRunStatus = z.infer<typeof reviewRunStatusSchema>;
export type JournalRevisionSnapshot = z.infer<typeof journalRevisionSchema>;
export type StaleReviewSnapshot = z.infer<typeof staleReviewSchema>;
export type RewritePracticeStatus = z.infer<typeof rewritePracticeStatusSchema>;
export type RewritePracticeSnapshot = z.infer<typeof rewritePracticeSnapshotSchema>;
export type TodayJournalSnapshot = z.infer<typeof todayJournalSnapshotSchema>;
export type SaveTodayJournalInput = z.infer<typeof saveTodayJournalInputSchema>;
export type SaveTodayJournalResult = z.infer<typeof saveTodayJournalResultSchema>;
export type CompleteRewritePracticeInput = z.infer<typeof completeRewritePracticeInputSchema>;
export type SkipRewritePracticeInput = z.infer<typeof skipRewritePracticeInputSchema>;
export type RewritePracticeUpdateResult = z.infer<typeof rewritePracticeUpdateResultSchema>;
