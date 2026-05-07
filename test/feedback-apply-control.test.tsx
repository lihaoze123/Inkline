import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { FeedbackRewritePage } from '../src/renderer/App';
import type { ReviewPreviewSnapshot, ReviewRunSnapshot } from '../src/shared/types/review';

vi.mock('@shared/writing/templates', async () => import('../src/shared/writing/templates'));
vi.mock('@shared/types/settings', async () => import('../src/shared/types/settings'));
vi.mock('@shared/types/credentials', async () => import('../src/shared/types/credentials'));
vi.mock('@shared/diagnostics/beta-readiness', async () => import('../src/shared/diagnostics/beta-readiness'));

const reviewedContent = 'Today I go home.';

describe('FeedbackRewritePage apply-correction control', () => {
  it('keeps apply disabled until the review is saved', () => {
    const html = renderFeedbackPage({ reviewState: 'ready' });

    expect(html).toContain('Save review before applying to draft');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*data-e2e="apply-focus-correction-button"/);
  });

  it('enables explicit revised-draft creation for a saved current focus correction', () => {
    const html = renderFeedbackPage({ reviewState: 'saved' });

    expect(html).toContain('Create revised draft');
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*data-e2e="apply-focus-correction-button"/);
  });

  it('routes stale or mismatched reviews to reviewing the current draft', () => {
    const html = renderFeedbackPage({
      reviewState: 'saved',
      preview: makePreview({ isStaleForCurrentWriting: true }),
      activeWritingRevisionId: 'revision_current',
    });

    expect(html).toContain('This review belongs to an earlier draft.');
    expect(html).toContain('Review current draft');
    expect(html).not.toContain('data-e2e="apply-focus-correction-button"');
  });
});

function renderFeedbackPage({
  reviewState,
  preview,
  activeWritingRevisionId = 'revision_reviewed',
}: {
  reviewState: 'ready' | 'saved';
  preview?: ReviewPreviewSnapshot;
  activeWritingRevisionId?: string | null;
}): string {
  const renderedPreview =
    preview ??
    makePreview({
      reviewRun: makeReviewRun({ status: reviewState === 'ready' ? 'review_ready' : 'review_saved' }),
    });

  return renderToStaticMarkup(
    <FeedbackRewritePage
      preview={renderedPreview}
      reviewState={reviewState}
      selfRepairAttempt=""
      modelAnswerRevealed={false}
      rewritePracticeInput=""
      saveState="saved"
      activeWritingRevisionId={activeWritingRevisionId}
      applyCorrectionError={null}
      isApplyCorrectionPending={false}
      onSelfRepairAttemptChange={() => undefined}
      onRevealModelAnswer={() => undefined}
      onSaveReview={() => undefined}
      onApplyFocusCorrection={() => undefined}
      onBackToDraft={() => undefined}
      onReviewCurrentVersion={() => undefined}
      onRewritePracticeInputChange={() => undefined}
    />,
  );
}

function makePreview(overrides: Partial<ReviewPreviewSnapshot> = {}): ReviewPreviewSnapshot {
  return {
    reviewRun: makeReviewRun(overrides.reviewRun),
    reviewedContent,
    parsedOutput: {
      corrections: [],
      summary: {
        focusPattern: {
          correctionIndex: 0,
          reason: 'Use past tense for completed actions.',
        },
        whatWentWell: ['The sentence has a clear subject.'],
      },
      selfRepairTask: {
        correctionIndex: 0,
        prompt: 'Rewrite the sentence in past tense.',
        hint: 'Use the past form of the verb.',
      },
      inputBridge: {
        correctionIndex: 0,
        examples: ['I went home yesterday.'],
      },
      referenceRewrites: [],
      rewriteTasks: [],
      upgradeOpportunities: [],
    },
    operations: {
      corrections: [
        {
          correctionIndex: 0,
          originalText: 'I go home',
          correctedText: 'I went home',
          explanation: 'Use past tense for a completed action.',
          category: 'tense',
          confidence: 'high',
          status: 'suggested',
          startOffset: 6,
          endOffset: 15,
          contentHash: 'hash_reviewed',
          matchedPatternId: null,
          newPatternSuggestion: {
            category: 'tense',
            rule: 'Use past tense for completed actions.',
            canonicalExample: 'I go home -> I went home',
          },
        },
      ],
      patternOperations: [],
      referenceRewrites: [],
      selfRepair: {
        correctionIndex: 0,
        prompt: 'Rewrite the sentence in past tense.',
        hint: 'Use the past form of the verb.',
        updatesLongTermStats: false,
      },
      rewritePractice: [],
      upgradeOpportunities: [],
      inputBridge: null,
    },
    currentWritingContentHash: 'hash_reviewed',
    isStaleForCurrentWriting: false,
    ...overrides,
  };
}

function makeReviewRun(overrides: Partial<ReviewRunSnapshot> = {}): ReviewRunSnapshot {
  return {
    id: 'review_1',
    writingAttemptId: 'writing_1',
    writingRevisionId: 'revision_reviewed',
    contentHash: 'hash_reviewed',
    status: 'review_saved',
    validationStatus: 'valid',
    provider: 'test-provider',
    model: 'test-model',
    validationErrors: [],
    summary: null,
    createdAt: 1777546800000,
    updatedAt: 1777546800000,
    ...overrides,
  };
}
