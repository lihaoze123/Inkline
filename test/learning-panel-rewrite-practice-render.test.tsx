import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { WritingAttemptSnapshot } from '../src/shared/types/writing';
import { getWritingTemplate } from '../src/shared/writing/templates';
import { LearningPanel } from '../src/renderer/components/LearningPanel';

const now = Date.UTC(2026, 4, 6, 8, 0, 0);

function writingWithPractice(
  pendingRewritePractice: NonNullable<WritingAttemptSnapshot['pendingRewritePractice']>,
): WritingAttemptSnapshot {
  return {
    attemptId: 'writing_1',
    dateKey: '2026-05-06',
    templateId: 'journal',
    template: getWritingTemplate('journal'),
    generatedPrompt: null,
    userGoal: null,
    activeRevision: null,
    lastAutosaveAt: null,
    lastReviewRunId: null,
    staleReview: null,
    pendingRewritePractice,
  };
}

function renderLearningPanel(
  writing: WritingAttemptSnapshot,
  rewritePracticeInput = '',
  completedRewritePractice: WritingAttemptSnapshot['pendingRewritePractice'] = null,
): string {
  return renderToStaticMarkup(
    <LearningPanel
      writing={writing}
      hasWritten={false}
      saveState="idle"
      reviewState="idle"
      reviewError={null}
      reviewProgress={{ activeRunId: null, events: [], currentEvent: null, startedAt: null }}
      latestReviewRun={null}
      preview={null}
      onOpenFeedback={() => undefined}
      rewritePracticeInput={rewritePracticeInput}
      completedRewritePractice={completedRewritePractice}
      rewritePracticeError={null}
      isRewritePracticeChecking={false}
      onRewritePracticeInputChange={() => undefined}
      onCompleteRewritePractice={() => undefined}
      onRetryRewriteCheck={() => undefined}
      onSkipRewritePractice={() => undefined}
      onSnoozeRewritePractice={() => undefined}
      onReviewCurrentVersion={() => undefined}
    />,
  );
}

function completedPracticeWithOutcome(
  outcome: 'correct' | 'partly_correct' | 'incorrect',
  practiceKind: NonNullable<WritingAttemptSnapshot['pendingRewritePractice']>['practiceKind'] = 'rewrite_original',
): NonNullable<WritingAttemptSnapshot['pendingRewritePractice']> {
  const isNewContextReuse = practiceKind === 'new_context_reuse';
  return {
    id: isNewContextReuse ? 'rewrite_d3' : 'rewrite_1',
    reviewRunId: 'review_1',
    originalSentence: isNewContextReuse ? 'New-context reuse practice' : 'I go home.',
    focusPattern: 'Use past tense for completed actions.',
    nativeModelSentence: isNewContextReuse ? '' : 'I went home.',
    prompt: isNewContextReuse
      ? 'Write one or two fresh English lines in a new everyday situation.'
      : 'Rewrite the original sentence.',
    practiceKind,
    spacedStage: isNewContextReuse ? 'D+3' : 'D+1',
    status: 'completed',
    userRewriteText: isNewContextReuse ? 'Last week I visit my cousin.' : 'I go home.',
    latestRewriteCheck: {
      id: `check_${outcome}`,
      rewriteTaskId: isNewContextReuse ? 'rewrite_d3' : 'rewrite_1',
      status: 'completed',
      outcome,
      feedback: { message: `${outcome} feedback.` },
      provider: 'test-provider',
      model: 'test-model',
      validationErrors: null,
      errorMessage: null,
      diagnostics: null,
      createdAt: now,
      updatedAt: now,
      completedAt: now,
    },
    dueAt: now,
    createdAt: now,
    isOlderThanSevenDays: false,
  };
}

describe('LearningPanel rewrite practice rendering', () => {
  it.each(['D+3', 'D+7'] as const)(
    'renders %s new-context reuse copy without original or reference labels',
    (stage) => {
      const html = renderLearningPanel(
        writingWithPractice({
          id: `rewrite_${stage}`,
          reviewRunId: 'review_1',
          originalSentence: 'New-context reuse practice',
          focusPattern: 'Use past tense for completed actions.',
          nativeModelSentence: '',
          prompt: 'Write one or two fresh English lines in a new everyday situation.',
          practiceKind: 'new_context_reuse',
          spacedStage: stage,
          status: 'pending',
          userRewriteText: null,
          latestRewriteCheck: null,
          dueAt: now,
          createdAt: now,
          isOlderThanSevenDays: false,
        }),
      );

      expect(html).toContain('Transfer practice');
      expect(html).toContain('Use the pattern in a new context');
      expect(html).toContain(stage);
      expect(html).not.toContain('Original:');
      expect(html).not.toContain('Reference sentence');
      expect(html).not.toContain('Rewrite the sentence in your own words.');
    },
  );

  it('keeps a completed recoverable D+1 card visible while a revised answer is edited', () => {
    const completedPractice = completedPracticeWithOutcome('partly_correct');
    const html = renderLearningPanel(
      { ...writingWithPractice(completedPractice), pendingRewritePractice: null },
      'I went home.',
      completedPractice,
    );

    expect(html).toContain('Rewrite practice');
    expect(html).toContain('value="I went home."');
    expect(html).toContain('Revise and check again');
    expect(html).not.toContain('disabled=""');
  });

  it('uses new-context recovery action copy for weak transfer outcomes', () => {
    const completedPractice = completedPracticeWithOutcome('incorrect', 'new_context_reuse');
    const html = renderLearningPanel(
      { ...writingWithPractice(completedPractice), pendingRewritePractice: null },
      'Last week I visited my cousin.',
      completedPractice,
    );

    expect(html).toContain('Transfer practice');
    expect(html).toContain('Revise new-context answer and check again');
    expect(html).not.toContain('Retry check');
    expect(html).not.toContain('Reference sentence');
  });

  it('keeps completed correct practice read-only instead of offering recovery', () => {
    const completedPractice = completedPracticeWithOutcome('correct');
    const html = renderLearningPanel(
      { ...writingWithPractice(completedPractice), pendingRewritePractice: null },
      'I went home again.',
      completedPractice,
    );

    expect(html).toContain('Rewrite submitted');
    expect(html).toContain('disabled=""');
    expect(html).not.toContain('Revise and check again');
  });
});
