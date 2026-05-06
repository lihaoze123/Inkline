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
    active: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('ProgressPage evidence rendering', () => {
  it('renders evidence separately from review count', () => {
    const html = renderToStaticMarkup(
      <ProgressPage
        patterns={[pattern({ evidence: { stage: 'needs_repair', latestRepair: null } })]}
        isLoading={false}
        isError={false}
        hasWritten={false}
        hasPendingRewrite={false}
        onOpenPractice={() => undefined}
      />,
    );

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
        onOpenPractice={() => undefined}
      />,
    );

    expect(html).toContain('Repaired once');
    expect(html).toContain('A D+1 original-sentence repair was checked as correct once.');
    expect(html).toContain('Latest D+1 check repaired the original sentence.');
  });
});
