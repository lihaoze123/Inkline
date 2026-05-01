import { type ReviewInput } from '../../../../shared/review-contract/schemas';
import { selectActiveReviewPatterns } from '../../learning-assets/service';
import { V0_1_REVIEW_CAPS } from '../types';
import { buildBoundedReviewInput } from './review-input';

export function buildReviewInput(params: {
  writingContent: string;
  contentHash: string;
  date?: string;
  writingTemplate?: ReviewInput['writingTemplate'];
  generatedPrompt?: string | null;
  userGoal?: string | null;
}): ReviewInput {
  return buildBoundedReviewInput({ ...params, existingPatterns: selectExistingPatterns() });
}

function selectExistingPatterns(): ReviewInput['existingPatterns'] {
  return selectActiveReviewPatterns(undefined, V0_1_REVIEW_CAPS.existingPatternsLimit);
}
