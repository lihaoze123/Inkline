import { describe, expect, it, vi } from 'vitest';
import { errorPatternSnapshotSchema, patternEvidenceStageSchema } from '../src/shared/types/learning-assets';
import {
  derivePatternEvidenceSummaries,
  type PatternEvidenceQueryRow,
} from '../src/main/services/learning-assets/service';

vi.mock('../src/main/db/client', () => ({
  db: {},
}));

const baseTime = Date.UTC(2026, 4, 6, 8, 0, 0);

function at(minutes: number): Date {
  return new Date(baseTime + minutes * 60_000);
}

function evidenceRow(overrides: Partial<PatternEvidenceQueryRow> = {}): PatternEvidenceQueryRow {
  return {
    patternId: 'pattern_tense',
    rewriteTaskId: 'rewrite_d1',
    rewriteTaskStatus: 'completed',
    dueAt: at(0),
    completedAt: at(5),
    taskCreatedAt: at(-10),
    checkId: null,
    checkStatus: null,
    checkOutcome: null,
    checkCompletedAt: null,
    checkUpdatedAt: null,
    checkCreatedAt: null,
    ...overrides,
  };
}

function completedCheckRow(
  outcome: NonNullable<PatternEvidenceQueryRow['checkOutcome']>,
  minutes: number,
  overrides: Partial<PatternEvidenceQueryRow> = {},
): PatternEvidenceQueryRow {
  return evidenceRow({
    checkId: `check_${outcome}_${minutes}`,
    checkStatus: 'completed',
    checkOutcome: outcome,
    checkCompletedAt: at(minutes),
    checkUpdatedAt: at(minutes),
    checkCreatedAt: at(minutes - 1),
    ...overrides,
  });
}

describe('learning-assets evidence summaries', () => {
  it('adds a typed evidence summary to error pattern snapshots', () => {
    expect(patternEvidenceStageSchema.options).toEqual([
      'needs_repair',
      'repaired_once',
      'transferred_once',
      'stable_after_spaced_reuse',
    ]);

    const parsed = errorPatternSnapshotSchema.parse({
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
      createdAt: baseTime,
      updatedAt: baseTime,
      evidence: {
        stage: 'repaired_once',
        latestRepair: {
          rewriteTaskId: 'rewrite_d1',
          practiceKind: 'rewrite_original',
          spacedStage: 'D+1',
          status: 'completed',
          dueAt: baseTime,
          completedAt: baseTime + 1,
          createdAt: baseTime - 1,
          latestCheck: {
            id: 'check_correct',
            status: 'completed',
            outcome: 'correct',
            completedAt: baseTime + 2,
            updatedAt: baseTime + 2,
          },
        },
      },
    });

    expect(parsed.evidence?.stage).toBe('repaired_once');
    expect(() => patternEvidenceStageSchema.parse('not_a_stage')).toThrow();
  });

  it('derives repaired once from a latest completed D+1 correct check', () => {
    const evidence = derivePatternEvidenceSummaries([completedCheckRow('correct', 10)]).get('pattern_tense');

    expect(evidence).toMatchObject({
      stage: 'repaired_once',
      latestRepair: {
        rewriteTaskId: 'rewrite_d1',
        status: 'completed',
        latestCheck: {
          status: 'completed',
          outcome: 'correct',
        },
      },
    });
  });

  it('keeps partly correct and incorrect checks in needs repair when they are the latest completed check', () => {
    const evidence = derivePatternEvidenceSummaries([
      completedCheckRow('correct', 10),
      completedCheckRow('partly_correct', 20),
      completedCheckRow('incorrect', 30),
    ]).get('pattern_tense');

    expect(evidence).toMatchObject({
      stage: 'needs_repair',
      latestRepair: {
        latestCheck: {
          outcome: 'incorrect',
        },
      },
    });
  });

  it('keeps retryable check state visible without removing prior correct repair evidence', () => {
    const evidence = derivePatternEvidenceSummaries([
      completedCheckRow('correct', 10),
      evidenceRow({
        checkId: 'check_retryable',
        checkStatus: 'retryable',
        checkUpdatedAt: at(20),
        checkCreatedAt: at(20),
      }),
    ]).get('pattern_tense');

    expect(evidence).toMatchObject({
      stage: 'repaired_once',
      latestRepair: {
        latestCheck: {
          status: 'retryable',
          outcome: null,
        },
      },
    });
  });

  it('does not advance evidence for skipped, snoozed, or expired repair lifecycle states', () => {
    const evidence = derivePatternEvidenceSummaries([
      evidenceRow({
        rewriteTaskId: 'rewrite_skipped',
        rewriteTaskStatus: 'skipped',
        completedAt: null,
        taskCreatedAt: at(5),
      }),
      evidenceRow({
        rewriteTaskId: 'rewrite_snoozed',
        rewriteTaskStatus: 'snoozed',
        dueAt: at(30),
        completedAt: null,
        taskCreatedAt: at(10),
      }),
      evidenceRow({
        rewriteTaskId: 'rewrite_expired',
        rewriteTaskStatus: 'expired',
        completedAt: null,
        taskCreatedAt: at(40),
      }),
    ]).get('pattern_tense');

    expect(evidence).toMatchObject({
      stage: 'needs_repair',
      latestRepair: {
        rewriteTaskId: 'rewrite_expired',
        status: 'expired',
      },
    });
  });
});
