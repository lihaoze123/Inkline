import { z } from 'zod';
import type { ProviderOptions } from '@ai-sdk/provider-utils';
import { reviewInputSchema, type ReviewInput, type ReviewOutput } from '../../../shared/review-contract/schemas';
import { aiProviderDiagnosticsSchema } from '../../../shared/types/ai';
import {
  startReviewInputSchema,
  startReviewOutputSchema,
  type StartReviewInput,
  type StartReviewOutput,
} from '../../../shared/types/review';

export const V0_1_REVIEW_CAPS = {
  maxCorrections: 5,
  maxReferenceRewrites: 1,
  maxRewriteTasks: 1,
  maxUpgradeOpportunities: 3,
  maxWhatWentWell: 2,
  maxInputExamples: 2,
  existingPatternsLimit: 30,
} as const;

export const reviewAgentRequestSchema = z.object({
  systemPrompt: z.string().min(1),
  userPrompt: z.string().min(1),
  input: reviewInputSchema,
  providerOptions: z
    .custom<ProviderOptions>((value) => typeof value === 'object' && value !== null && !Array.isArray(value))
    .optional(),
});

export const reviewAgentResponseSchema = z.object({
  output: z.unknown(),
  rawOutput: z.unknown(),
  providerDiagnostics: aiProviderDiagnosticsSchema.nullable().optional(),
});

export type ReviewAgentRequest = z.infer<typeof reviewAgentRequestSchema>;
export type ReviewAgentResponse = z.infer<typeof reviewAgentResponseSchema>;
export type ReviewAgent = (request: ReviewAgentRequest) => Promise<ReviewAgentResponse>;
export type { ReviewInput, ReviewOutput, StartReviewInput, StartReviewOutput };
export { startReviewInputSchema, startReviewOutputSchema };
