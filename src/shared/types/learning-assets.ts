import { z } from 'zod';
import { correctionCategorySchema } from '../review-contract/schemas';

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
export type ListErrorPatternsOutput = z.infer<typeof listErrorPatternsOutputSchema>;
export type ListNotebookEntriesOutput = z.infer<typeof listNotebookEntriesOutputSchema>;
