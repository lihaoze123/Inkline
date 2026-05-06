import { createHash } from 'node:crypto';
import {
  ReviewSaveStub,
  validateReviewResult,
  type ErrorPattern,
  type ReviewInput,
} from '../src/shared/review-contract';

const sampleWriting = 'Today I go to the library. I bought a book in there, and it was very useful.';
const contentHash = createHash('sha256')
  .update(sampleWriting.replace(/\r\n/g, '\n').replace(/\r/g, '\n'))
  .digest('hex');

const existingPatterns: ErrorPattern[] = [
  {
    id: 'tense_past_for_finished_time',
    category: 'tense',
    rule: 'Use past tense for finished past events.',
    canonicalExample: 'Yesterday I went to the library.',
    patternKey: 'tense:use_past_tense_for_finished_past_events',
    active: true,
  },
];

const input: ReviewInput = {
  date: '2026-04-29',
  writingContent: sampleWriting,
  contentHash,
  existingPatterns,
  maxCorrections: 5,
  maxReferenceRewrites: 1,
  maxRewriteTasks: 1,
  maxUpgradeOpportunities: 0,
  maxWhatWentWell: 3,
  maxInputExamples: 2,
};

const mockAgentOutput = {
  corrections: [
    {
      originalText: 'I go to the library',
      correctedText: 'I went to the library',
      explanation:
        'The event happened today and is being reported as a completed action, so past tense is more natural.',
      category: 'tense',
      confidence: 'high',
      anchor: {
        exact: 'I go to the library',
        prefix: 'Today ',
        suffix: '. I bought a book',
        occurrenceIndex: 0,
      },
      matchedPatternId: 'tense_past_for_finished_time',
      newPatternSuggestion: null,
    },
  ],
  summary: {
    focusPattern: {
      correctionIndex: 0,
      reason: 'Past tense for completed events is high learning value and reusable.',
      fingerprint: {
        patternType: 'grammar',
        learnerError: 'uses present tense for a completed library visit',
        targetCorrection: 'use past tense for the completed library visit',
        abstractRule: 'Use past tense when describing completed events.',
        positiveExamples: ['Yesterday I went to the library.'],
        negativeExample: 'Yesterday I go to the library.',
        transferBoundary: 'Applies to completed events, not habits or current routines.',
        forbiddenLeakageTerms: ['went', 'past tense'],
      },
    },
    whatWentWell: ['You used a clear time word, Today, to set the scene.'],
  },
  selfRepairTask: {
    correctionIndex: 0,
    prompt: 'Rewrite the sentence using the tense for a completed event.',
    hint: 'Think about the past form of the verb after I.',
  },
  inputBridge: {
    correctionIndex: 0,
    examples: ['Yesterday I went to the library.', 'Last night I watched a useful lesson.'],
  },
  referenceRewrites: [
    {
      text: 'Today I went to the library. I bought a book there, and it was very useful.',
      noticeTheGap: 'Use went for the completed trip, and use there instead of in there after bought a book.',
    },
  ],
  rewriteTasks: [
    {
      kind: 'rewrite_original',
      prompt: 'Rewrite your first sentence using past tense for the completed action.',
      focusCorrectionIndexes: [0],
      dueOffsetDays: 1,
      revealNativeModelAfterSubmit: true,
    },
  ],
  upgradeOpportunities: [],
};

const result = validateReviewResult(input, mockAgentOutput);
const saveStub = new ReviewSaveStub();
const firstSave = saveStub.saveReviewRun('mock-review-run-1', result.operations);
const secondSave = saveStub.saveReviewRun('mock-review-run-1', result.operations);

console.log(
  JSON.stringify(
    {
      schemaValidationResult: result.schemaValid,
      anchoringSuccessRate: result.anchoringSuccessRate,
      generatedCorrections: result.operations.corrections,
      generatedPatternOperations: result.operations.patternOperations,
      generatedRewritePracticeOperations: result.operations.rewritePractice,
      validationStatus: result.validationStatus,
      issues: result.issues,
      saveSimulation: {
        firstSave,
        secondSave,
        idempotent: JSON.stringify(firstSave) === JSON.stringify(secondSave),
      },
    },
    null,
    2,
  ),
);
