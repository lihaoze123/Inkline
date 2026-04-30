import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ReviewSaveStub, locateAnchor, validateReviewResult, type ErrorPattern, type ReviewInput } from '../src/shared/review-contract';

const existingPatterns: ErrorPattern[] = [
  {
    id: 'tense_past_for_finished_time',
    category: 'tense',
    rule: 'Use past tense for finished past events.',
    canonicalExample: 'Yesterday I went to school.',
    patternKey: 'tense:use_past_tense_for_finished_past_events',
    active: true,
  },
  {
    id: 'article_specific_place',
    category: 'article',
    rule: 'Use the for a specific place already known to the reader.',
    canonicalExample: 'I went to the office.',
    patternKey: 'article:use_the_for_a_specific_place_already_known_to_the_reader',
    active: true,
  },
  {
    id: 'collocation_make_decision',
    category: 'collocation',
    rule: 'Use make a decision, not do a decision.',
    canonicalExample: 'I made a decision.',
    patternKey: 'collocation:use_make_a_decision_not_do_a_decision',
    active: true,
  },
];

function contentHash(content: string): string {
  return createHash('sha256').update(content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')).digest('hex');
}

function inputFor(writingContent: string): ReviewInput {
  return {
    date: '2026-04-29',
    writingContent,
    contentHash: contentHash(writingContent),
    existingPatterns,
    maxCorrections: 5,
    maxReferenceRewrites: 1,
    maxRewriteTasks: 1,
    maxUpgradeOpportunities: 0,
    maxWhatWentWell: 3,
    maxInputExamples: 2,
  };
}

function validOutputFor(writingContent: string, exact: string, prefix: string, suffix: string, occurrenceIndex = 0): unknown {
  return {
    corrections: [
      {
        originalText: exact,
        correctedText: exact === 'I go to school' ? 'I went to school' : 'I went to the office',
        explanation: 'Use past tense for a completed action.',
        category: 'tense',
        confidence: 'high',
        anchor: { exact, prefix, suffix, occurrenceIndex },
        matchedPatternId: 'tense_past_for_finished_time',
        newPatternSuggestion: null,
      },
    ],
    summary: {
      focusPattern: { correctionIndex: 0, reason: 'This is the most reusable correction.' },
      whatWentWell: ['You wrote a clear sequence of events.'],
    },
    selfRepairTask: {
      correctionIndex: 0,
      prompt: 'Rewrite this sentence with the right tense.',
      hint: 'Use the past form of the verb.',
    },
    inputBridge: {
      correctionIndex: 0,
      examples: ['Yesterday I went to school.'],
    },
    referenceRewrites: [
      {
        text: writingContent.replace(exact, exact === 'I go to school' ? 'I went to school' : 'I went to the office'),
        noticeTheGap: 'The rewrite changes the verb to past tense.',
      },
    ],
    rewriteTasks: [
      {
        kind: 'rewrite_original',
        prompt: 'Rewrite the original sentence using the focus pattern.',
        focusCorrectionIndexes: [0],
        dueOffsetDays: 1,
      },
    ],
    upgradeOpportunities: [],
  };
}

describe('review quote anchoring', () => {
  it('locates repeated phrases with occurrenceIndex', () => {
    const result = locateAnchor('I go home. Then I go home again.', {
      exact: 'I go home',
      prefix: 'Then ',
      suffix: ' again.',
      occurrenceIndex: 1,
    });

    expect(result.success).toBe(true);
    if (result.success === true) {
      expect(result.location.startOffset).toBe(16);
      expect(result.location.endOffset).toBe(25);
    }
  });

  it('uses prefix and suffix to disambiguate when occurrenceIndex is missing', () => {
    const result = locateAnchor('I go home. Then I go home again.', {
      exact: 'I go home',
      prefix: 'Then ',
      suffix: ' again.',
    });

    expect(result.success).toBe(true);
    if (result.success === true) {
      expect(result.location.startOffset).toBe(16);
      expect(result.location.endOffset).toBe(25);
    }
  });

  it('locates multiline text after CRLF normalization', () => {
    const result = locateAnchor('First line\r\nI go to school\r\nLast line', {
      exact: 'I go to school',
      prefix: 'First line\n',
      suffix: '\nLast line',
      occurrenceIndex: 0,
    });

    expect(result.success).toBe(true);
    if (result.success === true) {
      expect(result.location.startOffset).toBe('First line\n'.length);
    }
  });

  it('locates mixed Chinese and English text with UTF-16 offsets', () => {
    const result = locateAnchor('今天 I go to school because 我想学习.', {
      exact: 'I go to school',
      prefix: '今天 ',
      suffix: ' because 我想学习.',
      occurrenceIndex: 0,
    });

    expect(result.success).toBe(true);
    if (result.success === true) {
      expect(result.location.startOffset).toBe(3);
      expect(result.location.endOffset).toBe(17);
    }
  });

  it('uses curly quote fallback only after exact matching fails', () => {
    const result = locateAnchor('She said “I go now” before leaving.', {
      exact: '"I go now"',
      prefix: 'She said ',
      suffix: ' before leaving.',
      occurrenceIndex: 0,
    });

    expect(result.success).toBe(true);
    if (result.success === true) {
      expect(result.location.usedFallback).toBe(true);
    }
  });

  it('preserves irregular spaces instead of collapsing them', () => {
    const result = locateAnchor('I  go to school with two spaces.', {
      exact: 'I go to school',
      prefix: '',
      suffix: ' with two spaces.',
      occurrenceIndex: 0,
    });

    expect(result.success).toBe(false);
  });
});

describe('review contract validation harness', () => {
  it('accepts a normal short journal and generates preview operations', () => {
    const journal = 'Today I go to school.';
    const result = validateReviewResult(inputFor(journal), validOutputFor(journal, 'I go to school', 'Today ', '.', 0));

    expect(result.schemaValid).toBe(true);
    expect(result.validationStatus).toBe('valid');
    expect(result.anchoringSuccessRate).toBe(1);
    expect(result.operations.corrections).toHaveLength(1);
    expect(result.operations.patternOperations).toEqual([
      { kind: 'reuse_pattern', correctionIndex: 0, patternId: 'tense_past_for_finished_time', updatesLongTermStats: false },
    ]);
    expect(result.operations.rewritePractice).toHaveLength(1);
  });

  it('downgrades paraphrased anchor exact text to low confidence warnings', () => {
    const journal = 'Today I go to school.';
    const result = validateReviewResult(inputFor(journal), validOutputFor(journal, 'I went to school', 'Today ', '.', 0));

    expect(result.schemaValid).toBe(true);
    expect(result.validationStatus).toBe('invalid');
    expect(result.anchoringSuccessRate).toBe(0);
    expect(result.operations.corrections).toHaveLength(0);
    expect(result.issues.some((issue) => issue.code === 'anchor_failed')).toBe(true);
  });

  it('rejects a matchedPatternId that does not exist', () => {
    const journal = 'Today I go to school.';
    const output = validOutputFor(journal, 'I go to school', 'Today ', '.', 0);
    const invalidOutput = {
      ...(output as Record<string, unknown>),
      corrections: [
        {
          ...((output as { corrections: Record<string, unknown>[] }).corrections[0]),
          matchedPatternId: 'missing_pattern',
        },
      ],
    };

    const result = validateReviewResult(inputFor(journal), invalidOutput);

    expect(result.validationStatus).toBe('invalid');
    expect(result.operations.patternOperations).toHaveLength(0);
  });

  it('flags a new pattern suggestion near-duplicate in preview operations', () => {
    const journal = 'Today I do a decision.';
    const output = validOutputFor(journal, 'I do a decision', 'Today ', '.', 0);
    const duplicateOutput = {
      ...(output as Record<string, unknown>),
      corrections: [
        {
          ...((output as { corrections: Record<string, unknown>[] }).corrections[0]),
          correctedText: 'I make a decision',
          category: 'collocation',
          matchedPatternId: null,
          newPatternSuggestion: {
            category: 'collocation',
            rule: 'Use make a decision, not do a decision.',
            canonicalExample: 'I made a decision.',
          },
        },
      ],
    };

    const result = validateReviewResult(inputFor(journal), duplicateOutput);

    expect(result.validationStatus).toBe('valid_with_warnings');
    expect(result.issues.some((issue) => issue.code === 'input_bridge_examples_not_focus_pattern')).toBe(true);
    expect(result.operations.patternOperations[0]).toMatchObject({
      kind: 'suggest_new_pattern',
      duplicateOfPatternId: 'collocation_make_decision',
      updatesLongTermStats: false,
    });
  });

  it('rejects missing focus patterns at schema validation', () => {
    const journal = 'Today I go to school.';
    const output = validOutputFor(journal, 'I go to school', 'Today ', '.', 0);
    const invalidOutput = { ...(output as Record<string, unknown>), summary: { whatWentWell: ['The idea is clear.'] } };

    const result = validateReviewResult(inputFor(journal), invalidOutput);

    expect(result.schemaValid).toBe(false);
    expect(result.validationStatus).toBe('invalid');
  });

  it('rejects multiple focus patterns at schema validation', () => {
    const journal = 'Today I go to school.';
    const output = validOutputFor(journal, 'I go to school', 'Today ', '.', 0);
    const invalidOutput = {
      ...(output as Record<string, unknown>),
      summary: {
        focusPattern: [
          { correctionIndex: 0, reason: 'First focus.' },
          { correctionIndex: 0, reason: 'Second focus.' },
        ],
        whatWentWell: ['The idea is clear.'],
      },
    };

    const result = validateReviewResult(inputFor(journal), invalidOutput);

    expect(result.schemaValid).toBe(false);
    expect(result.validationStatus).toBe('invalid');
  });

  it('rejects self-repair hints that leak the full corrected text', () => {
    const journal = 'Today I go to school.';
    const output = validOutputFor(journal, 'I go to school', 'Today ', '.', 0);
    const invalidOutput = {
      ...(output as Record<string, unknown>),
      selfRepairTask: {
        correctionIndex: 0,
        prompt: 'Try again.',
        hint: 'The answer is I went to school.',
      },
    };

    const result = validateReviewResult(inputFor(journal), invalidOutput);

    expect(result.validationStatus).toBe('invalid');
  });

  it('rejects empty whatWentWell at schema validation', () => {
    const journal = 'Today I go to school.';
    const output = validOutputFor(journal, 'I go to school', 'Today ', '.', 0);
    const invalidOutput = {
      ...(output as Record<string, unknown>),
      summary: { focusPattern: { correctionIndex: 0, reason: 'Focus.' }, whatWentWell: [] },
    };

    const result = validateReviewResult(inputFor(journal), invalidOutput);

    expect(result.validationStatus).toBe('invalid');
    expect(result.operations.corrections).toHaveLength(0);
  });

  it('rejects reference rewrites that lack noticeTheGap at schema validation', () => {
    const journal = 'Today I go to school.';
    const output = validOutputFor(journal, 'I go to school', 'Today ', '.', 0);
    const invalidOutput = { ...(output as Record<string, unknown>), referenceRewrites: [{ text: 'Today I went to school.' }] };

    const result = validateReviewResult(inputFor(journal), invalidOutput);

    expect(result.schemaValid).toBe(false);
  });

  it('warns when input bridge examples do not match the focus pattern', () => {
    const journal = 'Today I go to school.';
    const output = validOutputFor(journal, 'I go to school', 'Today ', '.', 0);
    const warningOutput = {
      ...(output as Record<string, unknown>),
      inputBridge: { correctionIndex: 0, examples: ['Apples are red.'] },
    };

    const result = validateReviewResult(inputFor(journal), warningOutput);

    expect(result.validationStatus).toBe('valid_with_warnings');
    expect(result.issues.some((issue) => issue.code === 'input_bridge_examples_not_focus_pattern')).toBe(true);
  });

  it('rejects rewrite tasks that reference missing correction indexes', () => {
    const journal = 'Today I go to school.';
    const output = validOutputFor(journal, 'I go to school', 'Today ', '.', 0);
    const invalidOutput = {
      ...(output as Record<string, unknown>),
      rewriteTasks: [{ kind: 'rewrite_original', prompt: 'Try again.', focusCorrectionIndexes: [2] }],
    };

    const result = validateReviewResult(inputFor(journal), invalidOutput);

    expect(result.validationStatus).toBe('invalid');
  });

  it('rejects content hashes that do not match normalized writing content', () => {
    const journal = 'Today I go to school.';
    const input = { ...inputFor(journal), contentHash: 'not-the-journal-hash' };
    const result = validateReviewResult(input, validOutputFor(journal, 'I go to school', 'Today ', '.', 0));

    expect(result.validationStatus).toBe('invalid');
    expect(result.issues.some((issue) => issue.code === 'content_hash_mismatch')).toBe(true);
    expect(result.operations.corrections).toHaveLength(0);
  });

  it('rejects upgrade opportunities when v0.1 caps them at zero', () => {
    const journal = 'Today I go to school.';
    const output = validOutputFor(journal, 'I go to school', 'Today ', '.', 0);
    const invalidOutput = {
      ...(output as Record<string, unknown>),
      upgradeOpportunities: [{ description: 'Try a more vivid opening.' }],
    };

    const result = validateReviewResult(inputFor(journal), invalidOutput);

    expect(result.validationStatus).toBe('invalid');
    expect(result.issues.some((issue) => issue.code === 'max_upgrade_opportunities_exceeded')).toBe(true);
  });

  it('keeps invalid output from producing long-term operations', () => {
    const journal = 'Today I go to school.';
    const result = validateReviewResult(inputFor(journal), { corrections: [{ category: 'grammar' }] });

    expect(result.schemaValid).toBe(false);
    expect(result.operations).toEqual({ corrections: [], patternOperations: [], referenceRewrites: [], selfRepair: null, rewritePractice: [], inputBridge: null });
  });

  it('simulates idempotent save without duplicating counts or rewrite tasks', () => {
    const journal = 'Today I go to school.';
    const result = validateReviewResult(inputFor(journal), validOutputFor(journal, 'I go to school', 'Today ', '.', 0));
    const saveStub = new ReviewSaveStub();

    const firstSave = saveStub.saveReviewRun('run-1', result.operations);
    const secondSave = saveStub.saveReviewRun('run-1', result.operations);

    expect(secondSave).toEqual(firstSave);
    expect(secondSave.patternCountIncrements).toEqual({ tense_past_for_finished_time: 1 });
    expect(secondSave.rewriteTaskIds).toEqual(['run-1:rewrite:0']);
  });
});
