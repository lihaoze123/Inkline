import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ErrorPatternSnapshot } from '../src/shared/types/learning-assets';
import { ProgressPage } from '../src/renderer/components/ProgressPage';

const now = Date.UTC(2026, 4, 6, 8, 0, 0);

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
    ...overrides,
  };
}

describe('ProgressPage evidence rendering', () => {
  it('renders evidence separately from review count', () => {
    const html = renderToStaticMarkup(
      <ProgressPage
        patterns={[pattern({ evidence: { stage: 'needs_repair', latestRepair: null, latestTransfer: null } })]}
        isLoading={false}
        isError={false}
        hasWritten={false}
        hasPendingRewrite={false}
        isMergePending={false}
        onMergePatterns={async () => ({ success: false, error: 'Not available in render test.' })}
        onOpenPractice={() => undefined}
      />,
    );

    expect(html).toContain('Current status');
    expect(html).toContain('Repair needed');
    expect(html).toContain('Learning evidence');
    expect(html).toContain('Needs repair');
    expect(html).toContain('No D+1 repair check is recorded yet.');
    expect(html).toContain('times seen');
    expect(html).toContain('Review count is separate from learning evidence.');
  });

  it('renders contextual check feedback without advancing wording', () => {
    const html = renderToStaticMarkup(
      <ProgressPage
        patterns={[
          pattern({
            evidence: {
              stage: 'needs_repair',
              latestTransfer: null,
              latestRepair: {
                rewriteTaskId: 'rewrite_d1',
                practiceKind: 'rewrite_original',
                spacedStage: 'D+1',
                status: 'completed',
                dueAt: now,
                completedAt: now + 1,
                createdAt: now - 1,
                latestCheck: {
                  id: 'check_partly',
                  status: 'completed',
                  outcome: 'partly_correct',
                  completedAt: now + 2,
                  updatedAt: now + 2,
                },
              },
            },
          }),
        ]}
        isLoading={false}
        isError={false}
        hasWritten={false}
        hasPendingRewrite={false}
        isMergePending={false}
        onMergePatterns={async () => ({ success: false, error: 'Not available in render test.' })}
        onOpenPractice={() => undefined}
      />,
    );

    expect(html).toContain('Needs repair');
    expect(html).toContain('Latest D+1 check was partly correct; evidence is unchanged.');
  });

  it('renders repaired once for D+1 correct evidence', () => {
    const html = renderToStaticMarkup(
      <ProgressPage
        patterns={[
          pattern({
            evidence: {
              stage: 'repaired_once',
              latestTransfer: null,
              latestRepair: {
                rewriteTaskId: 'rewrite_d1',
                practiceKind: 'rewrite_original',
                spacedStage: 'D+1',
                status: 'completed',
                dueAt: now,
                completedAt: now + 1,
                createdAt: now - 1,
                latestCheck: {
                  id: 'check_correct',
                  status: 'completed',
                  outcome: 'correct',
                  completedAt: now + 2,
                  updatedAt: now + 2,
                },
              },
            },
          }),
        ]}
        isLoading={false}
        isError={false}
        hasWritten={false}
        hasPendingRewrite={false}
        isMergePending={false}
        onMergePatterns={async () => ({ success: false, error: 'Not available in render test.' })}
        onOpenPractice={() => undefined}
      />,
    );

    expect(html).toContain('Repaired once');
    expect(html).toContain('A D+1 original-sentence repair was checked as correct once.');
    expect(html).toContain('Latest D+1 check repaired the original sentence.');
  });

  it('renders transferred once for D+3 correct evidence without mastery wording', () => {
    const html = renderToStaticMarkup(
      <ProgressPage
        patterns={[
          pattern({
            evidence: {
              stage: 'transferred_once',
              latestRepair: {
                rewriteTaskId: 'rewrite_d1',
                practiceKind: 'rewrite_original',
                spacedStage: 'D+1',
                status: 'completed',
                dueAt: now,
                completedAt: now + 1,
                createdAt: now - 1,
                latestCheck: {
                  id: 'check_correct',
                  status: 'completed',
                  outcome: 'correct',
                  completedAt: now + 2,
                  updatedAt: now + 2,
                },
              },
              latestTransfer: {
                rewriteTaskId: 'rewrite_d3',
                practiceKind: 'new_context_reuse',
                spacedStage: 'D+3',
                status: 'completed',
                dueAt: now + 3,
                completedAt: now + 4,
                createdAt: now + 3,
                latestCheck: {
                  id: 'check_transfer_correct',
                  status: 'completed',
                  outcome: 'correct',
                  completedAt: now + 5,
                  updatedAt: now + 5,
                },
              },
            },
            lifecycle: {
              status: 'stabilizing',
              label: 'Stabilizing',
              description: 'The pattern transferred once; D+7 spaced reuse is not checked correct yet.',
            },
          }),
        ]}
        isLoading={false}
        isError={false}
        hasWritten={false}
        hasPendingRewrite={false}
        isMergePending={false}
        onMergePatterns={async () => ({ success: false, error: 'Not available in render test.' })}
        onOpenPractice={() => undefined}
      />,
    );

    expect(html).toContain('Transferred once');
    expect(html).toContain('A delayed new-context reuse check was correct once.');
    expect(html).toContain('Current status');
    expect(html).toContain('Stabilizing');
    expect(html).toContain('Latest D+3 transfer check was correct.');
    expect(html).not.toContain('Mastered');
    expect(html).not.toContain('mastered');
  });

  it('renders stable after spaced reuse for D+7 correct evidence without mastery wording', () => {
    const html = renderToStaticMarkup(
      <ProgressPage
        patterns={[
          pattern({
            evidence: {
              stage: 'stable_after_spaced_reuse',
              latestRepair: {
                rewriteTaskId: 'rewrite_d1',
                practiceKind: 'rewrite_original',
                spacedStage: 'D+1',
                status: 'completed',
                dueAt: now,
                completedAt: now + 1,
                createdAt: now - 1,
                latestCheck: {
                  id: 'check_correct',
                  status: 'completed',
                  outcome: 'correct',
                  completedAt: now + 2,
                  updatedAt: now + 2,
                },
              },
              latestTransfer: {
                rewriteTaskId: 'rewrite_d7',
                practiceKind: 'new_context_reuse',
                spacedStage: 'D+7',
                status: 'completed',
                dueAt: now + 3,
                completedAt: now + 4,
                createdAt: now + 3,
                latestCheck: {
                  id: 'check_stable_correct',
                  status: 'completed',
                  outcome: 'correct',
                  completedAt: now + 5,
                  updatedAt: now + 5,
                },
              },
            },
            lifecycle: {
              status: 'stable',
              label: 'Stable',
              description: 'D+7 spaced reuse was checked correct.',
            },
          }),
        ]}
        isLoading={false}
        isError={false}
        hasWritten={false}
        hasPendingRewrite={false}
        isMergePending={false}
        onMergePatterns={async () => ({ success: false, error: 'Not available in render test.' })}
        onOpenPractice={() => undefined}
      />,
    );

    expect(html).toContain('Stable after spaced reuse');
    expect(html).toContain('A D+7 new-context reuse check was correct after spacing.');
    expect(html).toContain('Latest D+7 spaced reuse check was correct.');
    expect(html).not.toContain('Mastered');
    expect(html).not.toContain('mastered');
  });

  it('renders needs-attention lifecycle and weak latest transfer context', () => {
    const html = renderToStaticMarkup(
      <ProgressPage
        patterns={[
          pattern({
            evidence: {
              stage: 'transferred_once',
              latestRepair: {
                rewriteTaskId: 'rewrite_d1',
                practiceKind: 'rewrite_original',
                spacedStage: 'D+1',
                status: 'completed',
                dueAt: now,
                completedAt: now + 1,
                createdAt: now - 1,
                latestCheck: {
                  id: 'check_correct',
                  status: 'completed',
                  outcome: 'correct',
                  completedAt: now + 2,
                  updatedAt: now + 2,
                },
              },
              latestTransfer: {
                rewriteTaskId: 'rewrite_d3',
                practiceKind: 'new_context_reuse',
                spacedStage: 'D+3',
                status: 'completed',
                dueAt: now + 3,
                completedAt: now + 4,
                createdAt: now + 3,
                latestCheck: {
                  id: 'check_transfer_partly',
                  status: 'completed',
                  outcome: 'partly_correct',
                  completedAt: now + 5,
                  updatedAt: now + 5,
                },
              },
            },
            lifecycle: {
              status: 'needs_attention',
              label: 'Needs attention',
              description: 'The latest repair or transfer evidence needs follow-up before the next stage.',
              blockingReason: 'Latest D+3 transfer check was partly correct; try the same stage again.',
            },
          }),
        ]}
        isLoading={false}
        isError={false}
        hasWritten={false}
        hasPendingRewrite={false}
        isMergePending={false}
        onMergePatterns={async () => ({ success: false, error: 'Not available in render test.' })}
        onOpenPractice={() => undefined}
      />,
    );

    expect(html).toContain('Needs attention');
    expect(html).toContain('Latest D+3 transfer check was partly correct; try the same stage again.');
    expect(html).toContain('Latest D+3 transfer check was partly correct; evidence is unchanged.');
    expect(html).toContain('Transferred once');
    expect(html).not.toContain('Mastered');
    expect(html).not.toContain('mastered');
  });
});
