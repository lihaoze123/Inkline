import { z } from 'zod';

const trackGuidanceTextSchema = z.string().trim().min(1);

export const writingTemplateTrackGuidanceSchema = z.object({
  starterPromptFocus: trackGuidanceTextSchema,
  reviewLens: trackGuidanceTextSchema,
  rewritePracticeFocus: trackGuidanceTextSchema,
});

export type WritingTemplateTrackGuidance = z.infer<typeof writingTemplateTrackGuidanceSchema>;
