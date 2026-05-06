import { describe, expect, it } from 'vitest';
import {
  newContextPromptContractSchema,
  retryRewriteCheckInputSchema,
  retryRewriteCheckResultSchema,
  rewriteCheckSnapshotSchema,
  rewriteCheckStatusSchema,
  rewritePracticeSnapshotSchema,
  rewriteSpacedStageSchema,
  snoozeRewritePracticeInputSchema,
} from '../src/shared/types/writing';

const completedRewriteCheck = {
  id: 'rewrite_check_1',
  rewriteTaskId: 'rewrite_1',
  status: 'completed',
  outcome: 'partly_correct',
  feedback: { message: 'The tense is repaired, but the article still needs attention.' },
  provider: 'anthropic',
  model: 'claude-sonnet-4-5',
  validationErrors: null,
  errorMessage: null,
  diagnostics: { validationStatus: 'valid' },
  createdAt: 1777410000000,
  updatedAt: 1777410001000,
  completedAt: 1777410001000,
} as const;

const rewritePractice = {
  id: 'rewrite_1',
  reviewRunId: 'review_1',
  originalSentence: 'Yesterday I go home.',
  focusPattern: 'Use past tense for completed actions.',
  nativeModelSentence: 'Yesterday I went home.',
  prompt: 'Rewrite the original sentence.',
  practiceKind: 'rewrite_original',
  spacedStage: 'D+1',
  status: 'completed',
  userRewriteText: 'Yesterday I went home.',
  latestRewriteCheck: completedRewriteCheck,
  dueAt: 1777496400000,
  createdAt: 1777410000000,
  isOlderThanSevenDays: false,
} as const;

describe('rewrite-check shared writing contracts', () => {
  it('accepts all baseline rewrite-check status values', () => {
    expect(rewriteCheckStatusSchema.options).toEqual(['pending', 'in_progress', 'completed', 'failed', 'retryable']);
  });

  it('accepts all spaced rewrite-practice stages', () => {
    expect(rewriteSpacedStageSchema.options).toEqual(['D+1', 'D+3', 'D+7']);
  });

  it('accepts completed checks with a learning outcome and diagnostics metadata', () => {
    expect(rewriteCheckSnapshotSchema.parse(completedRewriteCheck)).toMatchObject({
      status: 'completed',
      outcome: 'partly_correct',
      feedback: { message: 'The tense is repaired, but the article still needs attention.' },
      provider: 'anthropic',
      model: 'claude-sonnet-4-5',
    });
  });

  it('rejects non-completed checks that carry an outcome', () => {
    const result = rewriteCheckSnapshotSchema.safeParse({
      ...completedRewriteCheck,
      status: 'retryable',
      outcome: 'incorrect',
      completedAt: null,
    });

    expect(result.success).toBe(false);
  });

  it('rejects completed checks without an outcome', () => {
    const result = rewriteCheckSnapshotSchema.safeParse({
      ...completedRewriteCheck,
      outcome: null,
    });

    expect(result.success).toBe(false);
  });

  it('allows pending practice snapshots to expose nullable latest rewrite-check state', () => {
    expect(rewritePracticeSnapshotSchema.parse({ ...rewritePractice, latestRewriteCheck: null })).toMatchObject({
      latestRewriteCheck: null,
    });
    expect(rewritePracticeSnapshotSchema.parse(rewritePractice).latestRewriteCheck).toMatchObject({
      id: 'rewrite_check_1',
      outcome: 'partly_correct',
    });
  });

  it('allows D+3 new-context reuse practice snapshots without exposing the hidden prompt contract', () => {
    const parsed = rewritePracticeSnapshotSchema.parse({
      ...rewritePractice,
      id: 'rewrite_d3',
      originalSentence: 'New-context reuse practice',
      nativeModelSentence: '',
      prompt: 'Write one or two fresh English lines in a new everyday situation.',
      practiceKind: 'new_context_reuse',
      spacedStage: 'D+3',
      latestRewriteCheck: null,
    });

    expect(parsed).toMatchObject({
      practiceKind: 'new_context_reuse',
      spacedStage: 'D+3',
      nativeModelSentence: '',
    });
    expect('promptContract' in parsed).toBe(false);
  });

  it('allows D+7 new-context reuse practice snapshots without exposing the hidden prompt contract', () => {
    const parsed = rewritePracticeSnapshotSchema.parse({
      ...rewritePractice,
      id: 'rewrite_d7',
      originalSentence: 'New-context reuse practice',
      nativeModelSentence: '',
      prompt: 'Write one or two fresh English lines in a new everyday situation.',
      practiceKind: 'new_context_reuse',
      spacedStage: 'D+7',
      latestRewriteCheck: null,
    });

    expect(parsed).toMatchObject({
      practiceKind: 'new_context_reuse',
      spacedStage: 'D+7',
      nativeModelSentence: '',
    });
    expect('promptContract' in parsed).toBe(false);
  });

  it('defines the hidden D+3 prompt contract shape', () => {
    expect(
      newContextPromptContractSchema.parse({
        targetMeaning: 'use past tense for completed actions',
        allowedHints: ['Use the same pattern in a different everyday situation.'],
        forbiddenHints: ['went home'],
        expectedPatternFamily: 'grammar',
      }),
    ).toMatchObject({
      targetMeaning: 'use past tense for completed actions',
      expectedPatternFamily: 'grammar',
    });
  });

  it('defines retry input and result payload shapes for retryable evaluator results', () => {
    expect(retryRewriteCheckInputSchema.parse({ rewriteTaskId: 'rewrite_1' })).toEqual({ rewriteTaskId: 'rewrite_1' });
    expect(
      retryRewriteCheckResultSchema.parse({
        success: true,
        rewriteCheck: completedRewriteCheck,
      }),
    ).toMatchObject({ success: true, rewriteCheck: { status: 'completed', outcome: 'partly_correct' } });
  });

  it('defines snooze input for rewrite practice lifecycle updates', () => {
    expect(snoozeRewritePracticeInputSchema.parse({ rewriteTaskId: 'rewrite_1' })).toEqual({
      rewriteTaskId: 'rewrite_1',
    });
  });
});
