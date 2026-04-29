import { z } from 'zod';
import { validationStatusSchema } from '../review-contract/schemas';

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

export const startReviewOutputSchema = z.object({
  success: z.boolean(),
  reviewRun: reviewRunSnapshotSchema.optional(),
  disclosureRequired: z.boolean().optional(),
  error: z.string().optional(),
});

export type AcknowledgeReviewDisclosureInput = z.infer<typeof acknowledgeReviewDisclosureInputSchema>;
export type StartReviewInput = z.infer<typeof startReviewInputSchema>;
export type ReviewRunSnapshot = z.infer<typeof reviewRunSnapshotSchema>;
export type StartReviewOutput = z.infer<typeof startReviewOutputSchema>;
