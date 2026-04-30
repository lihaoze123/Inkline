import { desc } from 'drizzle-orm';
import { db } from '../../../db/client';
import { corrections } from '../../../db/schema';
import { type ErrorPattern, type ReviewInput } from '../../../../shared/review-contract/schemas';
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

function selectExistingPatterns(): ErrorPattern[] {
  return db
    .select()
    .from(corrections)
    .orderBy(desc(corrections.id))
    .all()
    .map((correction) => ({ correction, category: toPatternCategory(correction.category) }))
    .filter(({ category }) => category !== 'spelling')
    .slice(0, V0_1_REVIEW_CAPS.existingPatternsLimit)
    .map(({ correction, category }): ErrorPattern => ({
      id: correction.id,
      category,
      rule: correction.pattern.length > 0 ? correction.pattern : correction.explanation,
      canonicalExample: `${correction.originalText} -> ${correction.correctedText}`,
      active: true,
    }));
}

function toPatternCategory(category: string): ErrorPattern['category'] {
  const allowed = new Set<ErrorPattern['category']>([
    'tense',
    'agreement',
    'article',
    'collocation',
    'word_order',
    'chinglish',
    'wordiness',
    'spelling',
  ]);

  return allowed.has(category as ErrorPattern['category']) ? (category as ErrorPattern['category']) : 'chinglish';
}
