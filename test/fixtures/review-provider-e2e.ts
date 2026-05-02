import type { ErrorPattern } from '../../src/shared/review-contract';

export const E2E_REVIEW_SAMPLE_WRITING = 'Today I go to the library. I bought a book in there, and it was very useful.';

export const E2E_REVIEW_EXISTING_PATTERNS: ErrorPattern[] = [
  {
    id: 'tense_past_for_finished_time',
    category: 'tense',
    rule: 'Use past tense for finished past events.',
    canonicalExample: 'Yesterday I went to the library.',
    patternKey: 'tense:use_past_tense_for_finished_past_events',
    active: true,
  },
  {
    id: 'collocation_use_there_for_place_reference',
    category: 'collocation',
    rule: 'Use there instead of in there when referring back to a place after an action.',
    canonicalExample: 'I bought a book there.',
    patternKey: 'collocation:use_there_for_place_reference',
    active: true,
  },
];
