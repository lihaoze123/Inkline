import type { ReviewOutput } from '../../src/shared/review-contract';

export const E2E_UI_SAMPLE_WRITING = 'Today I go to the library. I bought a book in there, and it was very useful.';

export const E2E_UI_SAMPLE_GOAL = 'Practice past tense and natural place references.';

export const E2E_UI_SELF_REPAIR_REWRITE = 'Today I went to the library.';

export const E2E_UI_REWRITE_PRACTICE_ANSWER = 'Today I went to the library.';

export const E2E_UI_REVIEW_OUTPUT = {
  corrections: [
    {
      originalText: 'I go to the library',
      correctedText: 'I went to the library',
      explanation: 'Use past tense for a finished action that happened today.',
      category: 'tense',
      confidence: 'high',
      anchor: {
        exact: 'I go to the library',
        prefix: 'Today ',
        suffix: '. I bought a book in there, and it was very useful.',
        occurrenceIndex: 0,
      },
      matchedPatternId: null,
      newPatternSuggestion: {
        category: 'tense',
        rule: 'Use past tense for finished past events.',
        canonicalExample: 'Yesterday I went to the library.',
      },
    },
  ],
  summary: {
    focusPattern: {
      correctionIndex: 0,
      reason: 'The tense shift is the most reusable pattern in this draft.',
    },
    whatWentWell: ['You gave a clear sequence with a concrete place and object.'],
  },
  selfRepairTask: {
    correctionIndex: 0,
    prompt: 'Rewrite the first sentence with the correct tense.',
    hint: 'Use the past form of the action verb.',
  },
  inputBridge: {
    correctionIndex: 0,
    examples: ['Yesterday I went to the library.', 'Last week I visited the library.'],
  },
  referenceRewrites: [
    {
      text: 'Today I went to the library. I bought a book there, and it was very useful.',
      noticeTheGap:
        'The reference version changes the finished action to past tense and uses there for the place reference.',
    },
  ],
  rewriteTasks: [
    {
      kind: 'rewrite_original',
      prompt: 'Rewrite the original sentence using past tense.',
      focusCorrectionIndexes: [0],
      dueOffsetDays: 1,
      revealNativeModelAfterSubmit: true,
    },
  ],
  upgradeOpportunities: [],
} satisfies ReviewOutput;

export const E2E_UI_REWRITE_CHECK_EVALUATION = {
  outcome: 'correct',
  feedback: 'Good repair. The finished library visit now uses past tense clearly.',
} as const;
