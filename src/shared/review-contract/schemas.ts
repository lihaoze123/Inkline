import { z } from 'zod';

export const correctionCategorySchema = z.enum([
  'tense',
  'agreement',
  'article',
  'collocation',
  'word_order',
  'chinglish',
  'wordiness',
  'spelling',
]);

export const confidenceSchema = z.enum(['high', 'medium', 'low']);
export const validationStatusSchema = z.enum(['valid', 'valid_with_warnings', 'invalid']);
export const correctionStatusSchema = z.enum(['suggested', 'kept', 'dismissed', 'stale', 'low_confidence']);
export const rewritePracticeKindSchema = z.enum(['rewrite_original']);

export const errorPatternSchema = z.object({
  id: z.string().min(1),
  category: correctionCategorySchema,
  rule: z.string().min(1),
  canonicalExample: z.string().min(1),
  patternKey: z.string().min(1).optional(),
  active: z.boolean().optional(),
});

export const reviewInputSchema = z.object({
  date: z.string().min(1),
  journalContent: z.string(),
  contentHash: z.string().min(1),
  existingPatterns: z.array(errorPatternSchema),
  recentExamples: z.array(z.string()).optional(),
  maxCorrections: z.number().int().positive(),
  maxReferenceRewrites: z.number().int().nonnegative(),
  maxRewriteTasks: z.number().int().nonnegative(),
  maxUpgradeOpportunities: z.number().int().nonnegative(),
  maxWhatWentWell: z.number().int().positive(),
  maxInputExamples: z.number().int().nonnegative(),
});

export const correctionAnchorSchema = z.object({
  exact: z.string().min(1),
  prefix: z.string(),
  suffix: z.string(),
  occurrenceIndex: z.number().int().nonnegative().optional(),
});

export const newPatternSuggestionSchema = z.object({
  category: correctionCategorySchema,
  rule: z.string().min(1),
  canonicalExample: z.string().min(1),
  id: z.never().optional(),
});

export const reviewCorrectionSchema = z
  .object({
    originalText: z.string().min(1),
    correctedText: z.string().min(1),
    explanation: z.string().min(1),
    category: correctionCategorySchema,
    confidence: confidenceSchema,
    anchor: correctionAnchorSchema,
    matchedPatternId: z.string().min(1).nullable().optional(),
    newPatternSuggestion: newPatternSuggestionSchema.nullable().optional(),
  })
  .superRefine((correction, ctx) => {
    const hasMatchedPattern = correction.matchedPatternId != null;
    const hasNewPatternSuggestion = correction.newPatternSuggestion != null;

    if (hasMatchedPattern && hasNewPatternSuggestion) {
      ctx.addIssue({
        code: 'custom',
        path: ['newPatternSuggestion'],
        message: 'matchedPatternId and newPatternSuggestion are mutually exclusive',
      });
    }

    if (!hasMatchedPattern && !hasNewPatternSuggestion && correction.category !== 'spelling' && correction.confidence !== 'low') {
      ctx.addIssue({
        code: 'custom',
        path: ['matchedPatternId'],
        message: 'non-spelling corrections above low confidence require a matched pattern or new pattern suggestion',
      });
    }
  });

export const focusPatternSchema = z.object({
  correctionIndex: z.number().int().nonnegative(),
  reason: z.string().min(1),
});

export const summarySchema = z.object({
  focusPattern: focusPatternSchema,
  whatWentWell: z.array(z.string().min(1)),
});

export const selfRepairTaskSchema = z.object({
  correctionIndex: z.number().int().nonnegative(),
  prompt: z.string().min(1),
  hint: z.string().min(1),
});

export const inputBridgeSchema = z.object({
  correctionIndex: z.number().int().nonnegative(),
  examples: z.array(z.string().min(1)),
});

export const referenceRewriteSchema = z.object({
  text: z.string().min(1),
  noticeTheGap: z.string().min(1),
});

export const rewriteTaskSchema = z.object({
  kind: rewritePracticeKindSchema,
  prompt: z.string().min(1),
  focusCorrectionIndexes: z.array(z.number().int().nonnegative()).min(1),
  dueOffsetDays: z.number().int().positive().optional(),
  revealNativeModelAfterSubmit: z.boolean().optional(),
});

export const upgradeOpportunitySchema = z.object({
  description: z.string().min(1),
});

export const reviewOutputSchema = z.object({
  corrections: z.array(reviewCorrectionSchema),
  summary: summarySchema,
  selfRepairTask: selfRepairTaskSchema,
  inputBridge: inputBridgeSchema,
  referenceRewrites: z.array(referenceRewriteSchema),
  rewriteTasks: z.array(rewriteTaskSchema),
  upgradeOpportunities: z.array(upgradeOpportunitySchema).optional().default([]),
});

export type CorrectionCategory = z.infer<typeof correctionCategorySchema>;
export type ErrorPattern = z.infer<typeof errorPatternSchema>;
export type ReviewInput = z.infer<typeof reviewInputSchema>;
export type CorrectionAnchor = z.infer<typeof correctionAnchorSchema>;
export type ReviewCorrection = z.infer<typeof reviewCorrectionSchema>;
export type ReviewOutput = z.infer<typeof reviewOutputSchema>;
export type ValidationStatus = z.infer<typeof validationStatusSchema>;
export type CorrectionStatus = z.infer<typeof correctionStatusSchema>;
