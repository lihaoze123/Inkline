import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ErrorPatternSnapshot } from '../src/shared/types/learning-assets';
import type { WritingAttemptSnapshot } from '../src/shared/types/writing';
import { DrillCenterPage } from '../src/renderer/components/DrillCenterPage';

const now = Date.UTC(2026, 4, 6, 8, 0, 0);

type PendingRewritePractice = NonNullable<WritingAttemptSnapshot['pendingRewritePractice']>;

function pattern(overrides: Partial<ErrorPatternSnapshot> = {}): ErrorPatternSnapshot {
  return {
    id: 'pattern_tense',
    patternKey: 'tense:past_actions',
    category: 'tense',
    rule: 'Use past tense for completed actions.',
    canonicalExample: 'Yesterday I went home.',
    count: 2,
    firstSeenDateKey: '2026-05-01',
    lastSeenDateKey: '2026-05-06',
    recentExamples: ['I go home -> I went home'],
    mergedIntoPatternId: null,
    mergedAt: null,
    active: true,
    createdAt: now,
    updatedAt: now,
    lifecycle: {
      status: 'repair_needed',
      label: 'Repair needed',
      description: 'No D+1 repair has been checked as correct yet.',
    },
    evidence: { stage: 'needs_repair', latestRepair: null, latestTransfer: null },
    ...overrides,
  };
}

function rewritePractice(overrides: Partial<PendingRewritePractice> = {}): PendingRewritePractice {
  return {
    id: 'rewrite_d1',
    reviewRunId: 'review_1',
    originalSentence: 'I go home.',
    focusPattern: 'Use past tense for completed actions.',
    nativeModelSentence: 'I went home.',
    prompt: 'Rewrite the original sentence.',
    practiceKind: 'rewrite_original',
    spacedStage: 'D+1',
    status: 'pending',
    userRewriteText: null,
    latestRewriteCheck: null,
    dueAt: now,
    createdAt: now,
    isOlderThanSevenDays: false,
    ...overrides,
  };
}

function renderDrillCenter({
  patterns = [],
  pendingRewritePractice = null,
  isLoading = false,
  isError = false,
}: {
  patterns?: ErrorPatternSnapshot[];
  pendingRewritePractice?: WritingAttemptSnapshot['pendingRewritePractice'];
  isLoading?: boolean;
  isError?: boolean;
} = {}): string {
  return renderToStaticMarkup(
    <DrillCenterPage
      patterns={patterns}
      pendingRewritePractice={pendingRewritePractice}
      isLoading={isLoading}
      isError={isError}
      onOpenPractice={() => undefined}
      onOpenProgress={() => undefined}
    />,
  );
}

describe('DrillCenterPage rendering', () => {
  it('renders loading, error, and empty states', () => {
    expect(renderDrillCenter({ isLoading: true })).toContain('Opening drill center...');
    expect(renderDrillCenter({ isError: true })).toContain('Drill Center is unavailable right now.');

    const html = renderDrillCenter();
    expect(html).toContain('No drill candidates yet');
    expect(html).toContain('Scheduled repair and transfer tasks will appear here.');
    expect(html).toContain('Start practice');
  });

  it('highlights a D+1 repair when the current pending rewrite practice matches the pattern', () => {
    const html = renderDrillCenter({
      pendingRewritePractice: rewritePractice({ id: 'rewrite_d1' }),
      patterns: [
        pattern({
          evidence: {
            stage: 'needs_repair',
            latestTransfer: null,
            latestRepair: {
              rewriteTaskId: 'rewrite_d1',
              practiceKind: 'rewrite_original',
              spacedStage: 'D+1',
              status: 'pending',
              dueAt: now,
              completedAt: null,
              createdAt: now,
              latestCheck: null,
            },
          },
        }),
      ],
    });

    expect(html).toContain('Current task');
    expect(html).toContain('Ready in Practice');
    expect(html).toContain('D+1 repair matches the current Practice task.');
    expect(html).toContain('Open Practice');
    expect(html).toContain('Open Progress');
  });

  it('does not show the Practice action when the pending rewrite belongs to a different pattern', () => {
    const html = renderDrillCenter({
      pendingRewritePractice: rewritePractice({ id: 'rewrite_other' }),
      patterns: [
        pattern({
          evidence: {
            stage: 'needs_repair',
            latestTransfer: null,
            latestRepair: {
              rewriteTaskId: 'rewrite_d1',
              practiceKind: 'rewrite_original',
              spacedStage: 'D+1',
              status: 'pending',
              dueAt: now,
              completedAt: null,
              createdAt: now,
              latestCheck: null,
            },
          },
        }),
      ],
    });

    expect(html).toContain('Scheduled');
    expect(html).toContain('D+1 repair is waiting in the learning loop.');
    expect(html).toContain('Open Progress');
    expect(html).not.toContain('Open Practice');
  });

  it.each(['D+3', 'D+7'] as const)('renders %s transfer wording for current new-context practice', (stage) => {
    const html = renderDrillCenter({
      pendingRewritePractice: rewritePractice({
        id: `rewrite_${stage}`,
        practiceKind: 'new_context_reuse',
        spacedStage: stage,
        originalSentence: 'New-context reuse practice',
        nativeModelSentence: '',
        prompt: 'Write one or two fresh English lines in a new everyday situation.',
      }),
      patterns: [
        pattern({
          evidence: {
            stage: stage === 'D+7' ? 'transferred_once' : 'repaired_once',
            latestRepair: {
              rewriteTaskId: 'rewrite_d1',
              practiceKind: 'rewrite_original',
              spacedStage: 'D+1',
              status: 'completed',
              dueAt: now,
              completedAt: now,
              createdAt: now,
              latestCheck: {
                id: 'check_d1_correct',
                status: 'completed',
                outcome: 'correct',
                completedAt: now,
                updatedAt: now,
              },
            },
            latestTransfer: {
              rewriteTaskId: `rewrite_${stage}`,
              practiceKind: 'new_context_reuse',
              spacedStage: stage,
              status: 'pending',
              dueAt: now,
              completedAt: null,
              createdAt: now,
              latestCheck: null,
            },
          },
        }),
      ],
    });

    expect(html).toContain(stage === 'D+7' ? 'D+7 spaced reuse' : 'D+3 transfer');
    expect(html).toContain('matches the current Practice task.');
    expect(html).toContain('Open Practice');
    expect(html).not.toContain('Original:');
    expect(html).not.toContain('Reference sentence');
  });

  it('shows retryable and weak outcomes as context rather than success', () => {
    const html = renderDrillCenter({
      patterns: [
        pattern({
          lifecycle: {
            status: 'needs_attention',
            label: 'Needs attention',
            description: 'The latest repair or transfer evidence needs follow-up before the next stage.',
          },
          evidence: {
            stage: 'needs_repair',
            latestTransfer: null,
            latestRepair: {
              rewriteTaskId: 'rewrite_d1',
              practiceKind: 'rewrite_original',
              spacedStage: 'D+1',
              status: 'completed',
              dueAt: now,
              completedAt: now,
              createdAt: now,
              latestCheck: {
                id: 'check_retryable',
                status: 'retryable',
                outcome: null,
                completedAt: null,
                updatedAt: now,
              },
            },
          },
        }),
      ],
    });

    expect(html).toContain('Follow-up needed');
    expect(html).toContain('D+1 repair check needs retry; the saved answer is context, not success.');
    expect(html).toContain('D+1 repair: submitted; check needs retry.');
  });

  it('renders stable patterns without mastery wording', () => {
    const html = renderDrillCenter({
      patterns: [
        pattern({
          lifecycle: {
            status: 'stable',
            label: 'Stable',
            description: 'D+7 spaced reuse was checked correct.',
          },
          evidence: {
            stage: 'stable_after_spaced_reuse',
            latestRepair: null,
            latestTransfer: {
              rewriteTaskId: 'rewrite_d7',
              practiceKind: 'new_context_reuse',
              spacedStage: 'D+7',
              status: 'completed',
              dueAt: now,
              completedAt: now,
              createdAt: now,
              latestCheck: {
                id: 'check_d7_correct',
                status: 'completed',
                outcome: 'correct',
                completedAt: now,
                updatedAt: now,
              },
            },
          },
        }),
      ],
    });

    expect(html).toContain('Stable after spaced reuse');
    expect(html).toContain('No due drill');
    expect(html).not.toContain('Mastery');
    expect(html).not.toContain('mastery');
    expect(html).not.toContain('Mastered');
    expect(html).not.toContain('mastered');
  });
});
