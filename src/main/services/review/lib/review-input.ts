import { getLocalDateKey } from '../../../../shared/writing/content';
import { reviewInputSchema, type ErrorPattern, type ReviewInput } from '../../../../shared/review-contract/schemas';
import { V0_1_REVIEW_CAPS } from '../types';

export function buildBoundedReviewInput(params: {
  writingContent: string;
  contentHash: string;
  date?: string;
  existingPatterns: ErrorPattern[];
  writingTemplate?: ReviewInput['writingTemplate'];
  generatedPrompt?: string | null;
  userGoal?: string | null;
}): ReviewInput {
  const input = {
    date: params.date ?? getLocalDateKey(),
    writingContent: params.writingContent,
    writingTemplate: params.writingTemplate,
    generatedPrompt: params.generatedPrompt ?? null,
    userGoal: params.userGoal ?? null,
    contentHash: params.contentHash,
    existingPatterns: params.existingPatterns
      .filter((pattern) => pattern.category !== 'spelling')
      .slice(0, V0_1_REVIEW_CAPS.existingPatternsLimit),
    maxCorrections: V0_1_REVIEW_CAPS.maxCorrections,
    maxReferenceRewrites: V0_1_REVIEW_CAPS.maxReferenceRewrites,
    maxRewriteTasks: V0_1_REVIEW_CAPS.maxRewriteTasks,
    maxUpgradeOpportunities: V0_1_REVIEW_CAPS.maxUpgradeOpportunities,
    maxWhatWentWell: V0_1_REVIEW_CAPS.maxWhatWentWell,
    maxInputExamples: V0_1_REVIEW_CAPS.maxInputExamples,
  };

  return reviewInputSchema.parse(input);
}
