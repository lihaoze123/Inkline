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

function renderLearningPanel(writing: WritingAttemptSnapshot, rewritePracticeInput = ''): string {
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
      completedRewritePractice={null}
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
});
