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

export const todayJournalSnapshotSchema = z.object({
  entryId: z.string().min(1),
  dateKey: z.string().min(1),
  activeRevision: journalRevisionSchema.nullable(),
  lastAutosaveAt: z.number().nullable(),
  lastReviewRunId: z.string().nullable(),
  staleReview: staleReviewSchema.nullable(),
});

export const saveTodayJournalInputSchema = z.object({
  content: z.string(),
});

export const saveTodayJournalResultSchema = todayJournalSnapshotSchema.extend({
  saved: z.boolean(),
});

export type ReviewRunStatus = z.infer<typeof reviewRunStatusSchema>;
export type JournalRevisionSnapshot = z.infer<typeof journalRevisionSchema>;
export type StaleReviewSnapshot = z.infer<typeof staleReviewSchema>;
export type TodayJournalSnapshot = z.infer<typeof todayJournalSnapshotSchema>;
export type SaveTodayJournalInput = z.infer<typeof saveTodayJournalInputSchema>;
export type SaveTodayJournalResult = z.infer<typeof saveTodayJournalResultSchema>;
