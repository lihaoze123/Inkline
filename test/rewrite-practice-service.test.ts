import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  corrections,
  errorPatterns,
  writingAttempts,
  writingRevisions,
  reviewRuns,
  rewriteChecks,
  rewriteTasks,
} from '../src/main/db/schema';
import type {
  corrections as correctionsTable,
  errorPatterns as errorPatternsTable,
  writingAttempts as writingAttemptsTable,
  writingRevisions as writingRevisionsTable,
  reviewRuns as reviewRunsTable,
  rewriteChecks as rewriteChecksTable,
  rewriteTasks as rewriteTasksTable,
} from '../src/main/db/schema';
import type { db as appDatabase } from '../src/main/db/client';
import type * as AiRuntimeConfigModule from '../src/main/services/ai/runtime-config';
import type {
  completeRewritePractice as completeRewritePracticeFunction,
  getDueRewritePracticeForPractice as getDueRewritePracticeForPracticeFunction,
  retryRewriteCheck as retryRewriteCheckFunction,
  skipRewritePractice as skipRewritePracticeFunction,
  snoozeRewritePractice as snoozeRewritePracticeFunction,
} from '../src/main/services/writing/service';

type AppDatabase = typeof appDatabase;
type WritingAttemptRow = typeof writingAttemptsTable.$inferSelect;
type WritingRevisionRow = typeof writingRevisionsTable.$inferSelect;
type ReviewRunRow = typeof reviewRunsTable.$inferSelect;
type RewriteCheckRow = typeof rewriteChecksTable.$inferSelect;
type RewriteTaskRow = typeof rewriteTasksTable.$inferSelect;
type ErrorPatternRow = typeof errorPatternsTable.$inferSelect;
type CorrectionRow = typeof correctionsTable.$inferSelect;
type StoredRow =
  | WritingAttemptRow
  | WritingRevisionRow
  | ReviewRunRow
  | RewriteCheckRow
  | RewriteTaskRow
  | ErrorPatternRow
  | CorrectionRow;
type TableName =
  | 'writingAttempts'
  | 'writingRevisions'
  | 'reviewRuns'
  | 'rewriteChecks'
  | 'rewriteTasks'
  | 'errorPatterns'
  | 'corrections';

const mocks = vi.hoisted(() => ({
  generateStructuredObject: vi.fn(),
  getAiProviderDiagnosticsFromError: vi.fn(() => null),
  getSettingsSnapshot: vi.fn(),
  buildAiRuntimeConfigForFeature: vi.fn(),
}));

type RowStore = {
  writingAttempts: WritingAttemptRow[];
  writingRevisions: WritingRevisionRow[];
  reviewRuns: ReviewRunRow[];
  rewriteChecks: RewriteCheckRow[];
  rewriteTasks: RewriteTaskRow[];
  errorPatterns: ErrorPatternRow[];
  corrections: CorrectionRow[];
};

vi.mock('../src/main/db/client', () => ({
  db: fakeDatabase.asAppDatabase(),
  getDatabasePath: () => ':memory:',
  sqlite: {},
}));

vi.mock('../src/main/services/ai', () => ({
  generateStructuredObject: mocks.generateStructuredObject,
  getAiProviderDiagnosticsFromError: mocks.getAiProviderDiagnosticsFromError,
}));

vi.mock('../src/main/services/ai/runtime-config', async (importOriginal) => {
  const actual = await importOriginal<typeof AiRuntimeConfigModule>();
  return {
    ...actual,
    buildAiRuntimeConfigForFeature: mocks.buildAiRuntimeConfigForFeature,
  };
});

vi.mock('../src/main/services/settings/service', () => ({
  getSettingsSnapshot: mocks.getSettingsSnapshot,
}));

const now = new Date('2026-04-30T12:00:00.000Z');
vi.setSystemTime(now);
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;
const REWRITE_PRACTICE_MAX_AGE_MS = 7 * ONE_DAY_MS;

const tableNames = new Map<object, TableName>([
  [writingAttempts, 'writingAttempts'],
  [writingRevisions, 'writingRevisions'],
  [reviewRuns, 'reviewRuns'],
  [rewriteChecks, 'rewriteChecks'],
  [rewriteTasks, 'rewriteTasks'],
  [errorPatterns, 'errorPatterns'],
  [corrections, 'corrections'],
]);

class FakeWritingDatabase {
  private store: RowStore = emptyStore();

  select(): {
    from: (table: unknown) => {
      where: (condition: unknown) => QueryResult;
      orderBy: () => { all: () => StoredRow[] };
      get: () => StoredRow | undefined;
      all: () => StoredRow[];
    };
  } {
    return {
      from: (table: unknown) => {
        const name = tableName(table);
        const rows = this.rowsFor(name);
        return {
          where: (condition: unknown) => this.queryRows(name, rows, condition),
          orderBy: () => ({ all: () => [...rows] }),
          get: () => rows[0],
          all: () => [...rows],
        };
      },
    };
  }

  insert(table: unknown): {
    values: (value: unknown) => { returning: () => { get: () => StoredRow }; run: () => void };
  } {
    return {
      values: (value: unknown) => {
        const tableNameValue = tableName(table);
        const row = {
          ...(value as Record<string, unknown>),
          createdAt: now,
          updatedAt: now,
          completedAt: (value as { completedAt?: unknown }).completedAt ?? null,
        } as StoredRow;
        this.rowsFor(tableNameValue).push(row);
        return { returning: () => ({ get: () => row }), run: () => undefined };
      },
    };
  }

  update(table: unknown): {
    set: (patch: unknown) => {
      where: (condition: unknown) => { run: () => void; returning: () => { get: () => StoredRow | undefined } };
    };
  } {
    return {
      set: (patch: unknown) => ({
        where: (condition: unknown) => {
          const updated = this.updateRow(tableName(table), extractId(condition), patch);
          return {
            run: () => undefined,
            returning: () => ({ get: () => updated }),
          };
        },
      }),
    };
  }

  reset(): void {
    this.store = emptyStore();
  }

  seedPracticeWithPendingRewrite(task: RewriteTaskRow = createPendingRewriteTask('rewrite_1')): void {
    this.store.writingAttempts.push({
      id: 'journal_1',
      dateKey: '2026-04-30',
      templateId: 'journal',
      generatedPromptJson: null,
      userGoal: null,
      activeRevisionId: 'revision_1',
      lastReviewRunId: null,
      reviewedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    this.store.writingRevisions.push({
      id: 'revision_1',
      writingAttemptId: 'journal_1',
      content: 'Today I go home.',
      contentHash: 'hash_a',
      createdAt: now,
    });
    this.store.reviewRuns.push({
      id: 'review_1',
      writingAttemptId: 'journal_1',
      writingRevisionId: 'revision_1',
      contentHash: 'hash_a',
      status: 'review_saved',
      validationStatus: 'valid',
      provider: 'test-provider',
      model: 'test-model',
      inputSnapshotJson: null,
      rawOutputJson: null,
      parsedOutputJson: null,
      previewOperationsJson: null,
      validationErrorsJson: null,
      summaryJson: null,
      createdAt: now,
      updatedAt: now,
    });
    this.store.rewriteTasks.push(task);
  }

  seedRewriteTask(task: RewriteTaskRow): void {
    this.store.rewriteTasks.push(task);
  }

  seedFocusPatternFingerprint(fingerprintJson = JSON.stringify(createPatternFingerprint())): void {
    this.store.errorPatterns.push({
      id: 'pattern_tense',
      patternKey: 'tense:past_actions',
      category: 'tense',
      rule: 'Use past tense for completed actions.',
      canonicalExample: 'Yesterday I went home.',
      count: 1,
      firstSeenDateKey: '2026-04-30',
      lastSeenDateKey: '2026-04-30',
      recentExamplesJson: JSON.stringify(['I go home -> I went home']),
      fingerprintJson,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    this.store.corrections.push({
      id: 'correction_1',
      reviewRunId: 'review_1',
      patternId: 'pattern_tense',
      pattern: 'Use past tense for completed actions.',
      originalText: 'I go home.',
      correctedText: 'I went home.',
      explanation: 'Use past tense for completed actions.',
      category: 'fix',
      status: 'suggested',
      startOffset: 0,
      endOffset: 9,
    });
  }

  seedCompletedRewriteCheck(): void {
    this.store.rewriteChecks.push({
      id: 'rewrite_check_1',
      rewriteTaskId: 'rewrite_1',
      status: 'completed',
      outcome: 'correct',
      feedback: 'Good repair.',
      provider: 'test-provider',
      model: 'test-model',
      validationErrorsJson: null,
      errorMessage: null,
      diagnosticsJson: null,
      createdAt: now,
      updatedAt: now,
      completedAt: now,
    });
  }

  seedRewriteCheck(check: RewriteCheckRow): void {
    this.store.rewriteChecks.push(check);
  }

  rewriteTask(id: string): RewriteTaskRow | undefined {
    return this.store.rewriteTasks.find((task) => task.id === id);
  }

  rewriteChecks(): RewriteCheckRow[] {
    return [...this.store.rewriteChecks];
  }

  rewriteTasks(): RewriteTaskRow[] {
    return [...this.store.rewriteTasks];
  }

  asAppDatabase(): AppDatabase {
    return this as unknown as AppDatabase;
  }

  private rowsFor(table: TableName): StoredRow[] {
    return this.store[table] as StoredRow[];
  }

  private queryRows(table: TableName, rows: StoredRow[], condition: unknown): QueryResult {
    if (table === 'rewriteTasks' && !conditionHasId(condition)) {
      const filtered = this.store.rewriteTasks.filter(
        (task) =>
          task.status === 'pending' &&
          task.kind === 'rewrite_original' &&
          task.spacedStage === 'D+1' &&
          task.dueAt !== null &&
          task.dueAt.getTime() <= now.getTime(),
      );
      return new QueryResult(filtered);
    }

    const value = extractId(condition);
    if (table === 'writingAttempts') {
      return new QueryResult(this.store.writingAttempts.filter((row) => row.id === value || row.dateKey === value));
    }

    if (table === 'rewriteChecks') {
      return new QueryResult(this.store.rewriteChecks.filter((row) => row.id === value || row.rewriteTaskId === value));
    }

    if (table === 'corrections') {
      return new QueryResult(
        this.store.corrections.filter(
          (row) => row.id === value || row.reviewRunId === value || row.patternId === value,
        ),
      );
    }

    return new QueryResult(rows.filter((row) => row.id === value));
  }

  private updateRow(table: TableName, id: string, patch: unknown): StoredRow | undefined {
    const row = this.rowsFor(table).find((candidate) => candidate.id === id);
    if (!row) {
      return undefined;
    }

    Object.assign(row, patch, table === 'writingAttempts' || table === 'reviewRuns' ? { updatedAt: now } : {});
    return row;
  }
}

class QueryResult {
  constructor(private readonly rows: StoredRow[]) {}

  get(): StoredRow | undefined {
    return this.rows[0];
  }

  all(): StoredRow[] {
    return [...this.rows];
  }

  orderBy(): { all: () => StoredRow[]; get: () => StoredRow | undefined } {
    return { all: () => [...this.rows], get: () => this.rows[0] };
  }
}

const fakeDatabase = new FakeWritingDatabase();

async function loadCompleteRewritePractice(): Promise<typeof completeRewritePracticeFunction> {
  const module = await import('../src/main/services/writing/service');
  return module.completeRewritePractice;
}

async function loadSkipRewritePractice(): Promise<typeof skipRewritePracticeFunction> {
  const module = await import('../src/main/services/writing/service');
  return module.skipRewritePractice;
}

async function loadSnoozeRewritePractice(): Promise<typeof snoozeRewritePracticeFunction> {
  const module = await import('../src/main/services/writing/service');
  return module.snoozeRewritePractice;
}

async function loadRetryRewriteCheck(): Promise<typeof retryRewriteCheckFunction> {
  const module = await import('../src/main/services/writing/service');
  return module.retryRewriteCheck;
}

async function loadGetDueRewritePracticeForPractice(): Promise<typeof getDueRewritePracticeForPracticeFunction> {
  const module = await import('../src/main/services/writing/service');
  return module.getDueRewritePracticeForPractice;
}

describe('rewrite practice service updates', () => {
  beforeEach(() => {
    vi.setSystemTime(now);
    vi.clearAllMocks();
    mocks.getSettingsSnapshot.mockResolvedValue(createSettingsSnapshot());
    mocks.buildAiRuntimeConfigForFeature.mockResolvedValue({
      provider: 'openai-compatible',
      apiKey: 'test-key',
      baseUrl: 'https://example.test/v1',
      model: 'test-model',
    });
    mocks.generateStructuredObject.mockResolvedValue({
      output: { outcome: 'correct', feedback: 'Good repair.' },
      rawOutput: {},
      providerDiagnostics: null,
      provider: 'openai-compatible',
      model: 'test-model',
    });
    mocks.getAiProviderDiagnosticsFromError.mockReturnValue(null);
  });

  it('saves the submitted rewrite before evaluator execution and returns the completed practice', async () => {
    fakeDatabase.reset();
    fakeDatabase.seedPracticeWithPendingRewrite();
    mocks.generateStructuredObject.mockImplementationOnce(() => {
      expect(fakeDatabase.rewriteTask('rewrite_1')).toMatchObject({
        status: 'completed',
        userRewriteText: 'I went home.',
      });
      return Promise.resolve({
        output: { outcome: 'correct', feedback: 'Good repair.' },
        rawOutput: {},
        providerDiagnostics: null,
        provider: 'openai-compatible',
        model: 'test-model',
      });
    });
    const completeRewritePractice = await loadCompleteRewritePractice();

    const result = await completeRewritePractice({ rewriteTaskId: 'rewrite_1', userRewriteText: ' I went home. ' });

    expect(result.success).toBe(true);
    expect(result.writing?.pendingRewritePractice).toBeNull();
    expect(result.rewritePractice).toMatchObject({
      id: 'rewrite_1',
      status: 'completed',
      userRewriteText: 'I went home.',
      nativeModelSentence: 'I went home.',
    });
    expect(fakeDatabase.rewriteTask('rewrite_1')).toMatchObject({
      status: 'completed',
      userRewriteText: 'I went home.',
      completedAt: now,
    });
  });

  it('exposes the latest rewrite check snapshot when a rewrite task is returned', async () => {
    fakeDatabase.reset();
    fakeDatabase.seedPracticeWithPendingRewrite();
    fakeDatabase.seedCompletedRewriteCheck();
    const skipRewritePractice = await loadSkipRewritePractice();

    const result = skipRewritePractice({ rewriteTaskId: 'rewrite_1' });

    expect(result.success).toBe(true);
    expect(result.rewritePractice?.latestRewriteCheck).toMatchObject({
      id: 'rewrite_check_1',
      status: 'completed',
      outcome: 'correct',
      feedback: { message: 'Good repair.' },
      provider: 'test-provider',
      model: 'test-model',
    });
  });

  it.each(['correct', 'partly_correct', 'incorrect'] as const)(
    'persists a completed rewrite check for %s evaluator output',
    async (outcome) => {
      fakeDatabase.reset();
      fakeDatabase.seedPracticeWithPendingRewrite();
      mocks.generateStructuredObject.mockResolvedValueOnce({
        output: { outcome, feedback: `${outcome} feedback.` },
        rawOutput: {},
        providerDiagnostics: null,
        provider: 'openai-compatible',
        model: 'test-model',
      });
      const completeRewritePractice = await loadCompleteRewritePractice();

      const result = await completeRewritePractice({ rewriteTaskId: 'rewrite_1', userRewriteText: 'I went home.' });

      expect(result.success).toBe(true);
      expect(result.rewritePractice?.latestRewriteCheck).toMatchObject({
        status: 'completed',
        outcome,
        feedback: { message: `${outcome} feedback.` },
      });
      expect(fakeDatabase.rewriteChecks()).toHaveLength(1);
      expect(fakeDatabase.rewriteChecks()[0]).toMatchObject({
        status: 'completed',
        outcome,
        feedback: `${outcome} feedback.`,
      });
    },
  );

  it('creates one pending D+3 new-context reuse task after a D+1 correct check with a saved fingerprint', async () => {
    fakeDatabase.reset();
    fakeDatabase.seedPracticeWithPendingRewrite();
    fakeDatabase.seedFocusPatternFingerprint();
    const completeRewritePractice = await loadCompleteRewritePractice();

    const result = await completeRewritePractice({ rewriteTaskId: 'rewrite_1', userRewriteText: 'I went home.' });

    const d3Tasks = fakeDatabase.rewriteTasks().filter((task) => task.kind === 'new_context_reuse');
    expect(result.success).toBe(true);
    expect(d3Tasks).toHaveLength(1);
    expect(d3Tasks[0]).toMatchObject({
      reviewRunId: 'review_1',
      kind: 'new_context_reuse',
      spacedStage: 'D+3',
      status: 'pending',
      dueAt: new Date(now.getTime() + 3 * ONE_DAY_MS),
      nativeModelSentence: '',
    });
    expect(d3Tasks[0]?.prompt).not.toContain('went home');
    expect(d3Tasks[0]?.prompt).not.toContain('Rewrite the original sentence');
    expect(JSON.parse(d3Tasks[0]?.promptContractJson ?? '{}')).toMatchObject({
      targetMeaning: 'use past tense for completed actions',
      forbiddenHints: ['went home'],
      expectedPatternFamily: 'grammar',
    });
  });

  it('does not create D+3 for partly correct or incorrect D+1 checks even when a fingerprint exists', async () => {
    for (const outcome of ['partly_correct', 'incorrect'] as const) {
      fakeDatabase.reset();
      fakeDatabase.seedPracticeWithPendingRewrite();
      fakeDatabase.seedFocusPatternFingerprint();
      mocks.generateStructuredObject.mockResolvedValueOnce({
        output: { outcome, feedback: `${outcome} feedback.` },
        rawOutput: {},
        providerDiagnostics: null,
        provider: 'openai-compatible',
        model: 'test-model',
      });
      const completeRewritePractice = await loadCompleteRewritePractice();

      await completeRewritePractice({ rewriteTaskId: 'rewrite_1', userRewriteText: 'I went home.' });

      expect(fakeDatabase.rewriteTasks().filter((task) => task.kind === 'new_context_reuse')).toHaveLength(0);
    }
  });

  it.each(['partly_correct', 'incorrect'] as const)(
    'allows learner recovery after a completed D+1 %s check and appends a new check',
    async (initialOutcome) => {
      const previousCheckTime = new Date(now.getTime() - 60_000);
      const recoveryTime = new Date(now.getTime() + 60_000);
      fakeDatabase.reset();
      fakeDatabase.seedPracticeWithPendingRewrite({
        ...createPendingRewriteTask('rewrite_1'),
        status: 'completed',
        userRewriteText: 'I go home.',
        completedAt: previousCheckTime,
      });
      fakeDatabase.seedRewriteCheck(
        createCompletedRewriteCheck({
          id: 'rewrite_check_initial',
          outcome: initialOutcome,
          feedback: `${initialOutcome} feedback.`,
          at: previousCheckTime,
        }),
      );
      mocks.generateStructuredObject.mockResolvedValueOnce({
        output: { outcome: 'incorrect', feedback: 'The revision still needs the past tense.' },
        rawOutput: {},
        providerDiagnostics: null,
        provider: 'openai-compatible',
        model: 'test-model',
      });
      vi.setSystemTime(recoveryTime);
      const completeRewritePractice = await loadCompleteRewritePractice();

      const result = await completeRewritePractice({ rewriteTaskId: 'rewrite_1', userRewriteText: ' I went home. ' });

      expect(result.success).toBe(true);
      expect(result.rewritePractice).toMatchObject({
        id: 'rewrite_1',
        status: 'completed',
        userRewriteText: 'I went home.',
        latestRewriteCheck: {
          status: 'completed',
          outcome: 'incorrect',
          feedback: { message: 'The revision still needs the past tense.' },
        },
      });
      expect(fakeDatabase.rewriteTask('rewrite_1')).toMatchObject({
        status: 'completed',
        userRewriteText: 'I went home.',
        completedAt: recoveryTime,
      });
      expect(fakeDatabase.rewriteChecks()).toHaveLength(2);
      expect(fakeDatabase.rewriteChecks().map((check) => check.id)).toEqual([
        'rewrite_check_initial',
        expect.any(String),
      ]);
    },
  );

  it('does not create a recovery check after the latest completed D+1 outcome is correct', async () => {
    const previousCheckTime = new Date(now.getTime() - 60_000);
    fakeDatabase.reset();
    fakeDatabase.seedPracticeWithPendingRewrite({
      ...createPendingRewriteTask('rewrite_1'),
      status: 'completed',
      userRewriteText: 'I went home.',
      completedAt: previousCheckTime,
    });
    fakeDatabase.seedRewriteCheck(
      createCompletedRewriteCheck({
        id: 'rewrite_check_correct',
        outcome: 'correct',
        feedback: 'Good repair.',
        at: previousCheckTime,
      }),
    );
    const completeRewritePractice = await loadCompleteRewritePractice();

    const result = await completeRewritePractice({
      rewriteTaskId: 'rewrite_1',
      userRewriteText: 'I revised this again.',
    });

    expect(result.success).toBe(true);
    expect(result.rewritePractice).toMatchObject({
      id: 'rewrite_1',
      userRewriteText: 'I went home.',
      latestRewriteCheck: { outcome: 'correct' },
    });
    expect(fakeDatabase.rewriteChecks()).toHaveLength(1);
    expect(mocks.generateStructuredObject).not.toHaveBeenCalled();
  });

  it.each(['skipped', 'expired'] as const)(
    'does not create recovery checks for %s rewrite tasks even when an older weak check exists',
    async (status) => {
      const previousCheckTime = new Date(now.getTime() - 60_000);
      fakeDatabase.reset();
      fakeDatabase.seedPracticeWithPendingRewrite({
        ...createPendingRewriteTask('rewrite_1'),
        status,
        userRewriteText: 'I go home.',
        completedAt: null,
      });
      fakeDatabase.seedRewriteCheck(
        createCompletedRewriteCheck({
          id: 'rewrite_check_weak',
          outcome: 'partly_correct',
          feedback: 'Partly repaired.',
          at: previousCheckTime,
        }),
      );
      const completeRewritePractice = await loadCompleteRewritePractice();

      const result = await completeRewritePractice({
        rewriteTaskId: 'rewrite_1',
        userRewriteText: 'I went home.',
      });

      expect(result.success).toBe(true);
      expect(result.rewritePractice).toMatchObject({
        id: 'rewrite_1',
        status,
        userRewriteText: 'I go home.',
      });
      expect(fakeDatabase.rewriteChecks()).toHaveLength(1);
      expect(mocks.generateStructuredObject).not.toHaveBeenCalled();
    },
  );

  it('creates D+3 exactly once when a weak D+1 outcome is recovered to correct', async () => {
    const previousCheckTime = new Date(now.getTime() - 60_000);
    const recoveryTime = new Date(now.getTime() + 60_000);
    fakeDatabase.reset();
    fakeDatabase.seedPracticeWithPendingRewrite({
      ...createPendingRewriteTask('rewrite_1'),
      status: 'completed',
      userRewriteText: 'I go home.',
      completedAt: previousCheckTime,
    });
    fakeDatabase.seedFocusPatternFingerprint();
    fakeDatabase.seedRewriteCheck(
      createCompletedRewriteCheck({
        id: 'rewrite_check_weak',
        outcome: 'incorrect',
        feedback: 'The tense is still not repaired.',
        at: previousCheckTime,
      }),
    );
    vi.setSystemTime(recoveryTime);
    const completeRewritePractice = await loadCompleteRewritePractice();

    const result = await completeRewritePractice({ rewriteTaskId: 'rewrite_1', userRewriteText: 'I went home.' });
    const secondResult = await completeRewritePractice({
      rewriteTaskId: 'rewrite_1',
      userRewriteText: 'I went home again.',
    });

    const d3Tasks = fakeDatabase.rewriteTasks().filter((task) => task.kind === 'new_context_reuse');
    expect(result.success).toBe(true);
    expect(secondResult.success).toBe(true);
    expect(fakeDatabase.rewriteChecks()).toHaveLength(2);
    expect(d3Tasks).toHaveLength(1);
    expect(d3Tasks[0]).toMatchObject({
      spacedStage: 'D+3',
      dueAt: new Date(recoveryTime.getTime() + 3 * ONE_DAY_MS),
    });
  });

  it('does not fail D+1 completion or create D+3 when the saved fingerprint is missing or invalid', async () => {
    fakeDatabase.reset();
    fakeDatabase.seedPracticeWithPendingRewrite();
    fakeDatabase.seedFocusPatternFingerprint(JSON.stringify({ invalid: true }));
    const completeRewritePractice = await loadCompleteRewritePractice();

    const result = await completeRewritePractice({ rewriteTaskId: 'rewrite_1', userRewriteText: 'I went home.' });

    expect(result.success).toBe(true);
    expect(result.rewritePractice?.latestRewriteCheck).toMatchObject({ status: 'completed', outcome: 'correct' });
    expect(fakeDatabase.rewriteTasks().filter((task) => task.kind === 'new_context_reuse')).toHaveLength(0);
  });

  it('keeps D+3 generation idempotent across retries after the first correct D+1 check', async () => {
    fakeDatabase.reset();
    fakeDatabase.seedPracticeWithPendingRewrite();
    fakeDatabase.seedFocusPatternFingerprint();
    const completeRewritePractice = await loadCompleteRewritePractice();
    await completeRewritePractice({ rewriteTaskId: 'rewrite_1', userRewriteText: 'I went home.' });
    const retryRewriteCheck = await loadRetryRewriteCheck();

    await retryRewriteCheck({ rewriteTaskId: 'rewrite_1' });

    expect(fakeDatabase.rewriteTasks().filter((task) => task.kind === 'new_context_reuse')).toHaveLength(1);
  });

  it('persists a retryable check when the provider call fails without losing submitted text', async () => {
    fakeDatabase.reset();
    fakeDatabase.seedPracticeWithPendingRewrite();
    mocks.generateStructuredObject.mockRejectedValueOnce(new Error('network down with sk-testsecret123456789'));
    const completeRewritePractice = await loadCompleteRewritePractice();

    const result = await completeRewritePractice({ rewriteTaskId: 'rewrite_1', userRewriteText: 'I went home.' });

    expect(result.success).toBe(true);
    expect(fakeDatabase.rewriteTask('rewrite_1')).toMatchObject({
      status: 'completed',
      userRewriteText: 'I went home.',
    });
    expect(result.rewritePractice?.latestRewriteCheck).toMatchObject({
      status: 'retryable',
      outcome: null,
      errorMessage: 'AI service connection failed while checking this rewrite. Try again or check Settings.',
    });
    expect(fakeDatabase.rewriteChecks()[0]?.diagnosticsJson).not.toContain('sk-testsecret123456789');
  });

  it('persists a retryable check when evaluator output is invalid', async () => {
    fakeDatabase.reset();
    fakeDatabase.seedPracticeWithPendingRewrite();
    mocks.generateStructuredObject.mockResolvedValueOnce({
      output: { outcome: 'almost', feedback: '' },
      rawOutput: {},
      providerDiagnostics: null,
      provider: 'openai-compatible',
      model: 'test-model',
    });
    const completeRewritePractice = await loadCompleteRewritePractice();

    const result = await completeRewritePractice({ rewriteTaskId: 'rewrite_1', userRewriteText: 'I went home.' });

    expect(result.success).toBe(true);
    expect(result.rewritePractice?.latestRewriteCheck).toMatchObject({
      status: 'retryable',
      outcome: null,
      errorMessage: 'AI response could not be used to check this rewrite. Try again.',
    });
  });

  it('retries a failed rewrite check using the saved rewrite text', async () => {
    fakeDatabase.reset();
    fakeDatabase.seedPracticeWithPendingRewrite();
    mocks.generateStructuredObject.mockRejectedValueOnce(new Error('temporary network failure'));
    const completeRewritePractice = await loadCompleteRewritePractice();
    await completeRewritePractice({ rewriteTaskId: 'rewrite_1', userRewriteText: 'I went home.' });
    expect(fakeDatabase.rewriteChecks()).toHaveLength(1);
    expect(fakeDatabase.rewriteChecks()[0]).toMatchObject({ status: 'retryable' });

    mocks.generateStructuredObject.mockClear();
    mocks.generateStructuredObject.mockResolvedValueOnce({
      output: { outcome: 'partly_correct', feedback: 'Better, but still needs the target tense.' },
      rawOutput: {},
      providerDiagnostics: null,
      provider: 'openai-compatible',
      model: 'test-model',
    });
    const retryRewriteCheck = await loadRetryRewriteCheck();

    const result = await retryRewriteCheck({ rewriteTaskId: 'rewrite_1' });

    expect(result.success).toBe(true);
    expect(result.rewriteCheck).toMatchObject({
      status: 'completed',
      outcome: 'partly_correct',
    });
    expect(fakeDatabase.rewriteChecks()).toHaveLength(2);
    expect(mocks.generateStructuredObject).toHaveBeenCalledTimes(1);
    expect(mocks.generateStructuredObject.mock.calls[0]?.[0].userPrompt).toContain('I went home.');
  });

  it('creates D+3 when retrying a D+1 check succeeds as correct and no D+3 exists yet', async () => {
    fakeDatabase.reset();
    fakeDatabase.seedPracticeWithPendingRewrite();
    fakeDatabase.seedFocusPatternFingerprint();
    mocks.generateStructuredObject.mockRejectedValueOnce(new Error('temporary network failure'));
    const completeRewritePractice = await loadCompleteRewritePractice();
    await completeRewritePractice({ rewriteTaskId: 'rewrite_1', userRewriteText: 'I went home.' });

    mocks.generateStructuredObject.mockClear();
    mocks.generateStructuredObject.mockResolvedValueOnce({
      output: { outcome: 'correct', feedback: 'Good repair.' },
      rawOutput: {},
      providerDiagnostics: null,
      provider: 'openai-compatible',
      model: 'test-model',
    });
    const retryRewriteCheck = await loadRetryRewriteCheck();

    const result = await retryRewriteCheck({ rewriteTaskId: 'rewrite_1' });

    expect(result.success).toBe(true);
    expect(result.rewriteCheck).toMatchObject({ status: 'completed', outcome: 'correct' });
    expect(fakeDatabase.rewriteTasks().filter((task) => task.kind === 'new_context_reuse')).toHaveLength(1);
  });

  it('branches D+3 rewrite-check evaluation to transfer semantics with the hidden prompt contract', async () => {
    fakeDatabase.reset();
    fakeDatabase.seedPracticeWithPendingRewrite(createD3RewriteTask('rewrite_d3'));
    mocks.generateStructuredObject.mockResolvedValueOnce({
      output: { outcome: 'partly_correct', feedback: 'Transfer is close but incomplete.' },
      rawOutput: {},
      providerDiagnostics: null,
      provider: 'openai-compatible',
      model: 'test-model',
    });
    const completeRewritePractice = await loadCompleteRewritePractice();

    const result = await completeRewritePractice({
      rewriteTaskId: 'rewrite_d3',
      userRewriteText: 'Last week I visited my cousin.',
    });

    expect(result.success).toBe(true);
    const evaluationInput = mocks.generateStructuredObject.mock.calls[0]?.[0];
    expect(evaluationInput.systemPrompt).toContain('delayed new-context reuse');
    expect(evaluationInput.userPrompt).toContain('Evaluate this D+3 new-context reuse submission.');
    expect(evaluationInput.userPrompt).toContain('use past tense for completed actions');
    expect(evaluationInput.userPrompt).toContain('went home');
    expect(evaluationInput.userPrompt).toContain('Last week I visited my cousin.');
    expect(fakeDatabase.rewriteTasks().filter((task) => task.kind === 'new_context_reuse')).toHaveLength(1);
  });

  it('creates one pending D+7 new-context reuse task after a D+3 correct check with a hidden prompt contract', async () => {
    fakeDatabase.reset();
    fakeDatabase.seedPracticeWithPendingRewrite(createD3RewriteTask('rewrite_d3'));
    const completeRewritePractice = await loadCompleteRewritePractice();

    const result = await completeRewritePractice({
      rewriteTaskId: 'rewrite_d3',
      userRewriteText: 'Last week I visited my cousin.',
    });

    const newContextTasks = fakeDatabase.rewriteTasks().filter((task) => task.kind === 'new_context_reuse');
    const d7Tasks = newContextTasks.filter((task) => task.spacedStage === 'D+7');
    expect(result.success).toBe(true);
    expect(newContextTasks.filter((task) => task.spacedStage === 'D+3')).toHaveLength(1);
    expect(d7Tasks).toHaveLength(1);
    expect(d7Tasks[0]).toMatchObject({
      reviewRunId: 'review_1',
      kind: 'new_context_reuse',
      spacedStage: 'D+7',
      status: 'pending',
      dueAt: new Date(now.getTime() + SEVEN_DAYS_MS),
      nativeModelSentence: '',
    });
    expect(d7Tasks[0]?.prompt).not.toContain('went home');
    expect(d7Tasks[0]?.prompt).not.toContain('Rewrite the original sentence');
    expect(JSON.parse(d7Tasks[0]?.promptContractJson ?? '{}')).toMatchObject({
      targetMeaning: 'use past tense for completed actions',
      forbiddenHints: ['went home'],
      expectedPatternFamily: 'grammar',
    });
  });

  it('creates D+7 when retrying a D+3 check succeeds as correct and no D+7 exists yet', async () => {
    fakeDatabase.reset();
    fakeDatabase.seedPracticeWithPendingRewrite(createD3RewriteTask('rewrite_d3'));
    mocks.generateStructuredObject.mockRejectedValueOnce(new Error('temporary network failure'));
    const completeRewritePractice = await loadCompleteRewritePractice();
    await completeRewritePractice({
      rewriteTaskId: 'rewrite_d3',
      userRewriteText: 'Last week I visited my cousin.',
    });
    expect(fakeDatabase.rewriteTasks().filter((task) => task.spacedStage === 'D+7')).toHaveLength(0);

    mocks.generateStructuredObject.mockClear();
    mocks.generateStructuredObject.mockResolvedValueOnce({
      output: { outcome: 'correct', feedback: 'Good transfer.' },
      rawOutput: {},
      providerDiagnostics: null,
      provider: 'openai-compatible',
      model: 'test-model',
    });
    const retryRewriteCheck = await loadRetryRewriteCheck();

    const result = await retryRewriteCheck({ rewriteTaskId: 'rewrite_d3' });

    expect(result.success).toBe(true);
    expect(result.rewriteCheck).toMatchObject({ status: 'completed', outcome: 'correct' });
    expect(fakeDatabase.rewriteTasks().filter((task) => task.spacedStage === 'D+7')).toHaveLength(1);
  });

  it('does not create D+7 for partly correct or incorrect D+3 checks', async () => {
    for (const outcome of ['partly_correct', 'incorrect'] as const) {
      fakeDatabase.reset();
      fakeDatabase.seedPracticeWithPendingRewrite(createD3RewriteTask('rewrite_d3'));
      mocks.generateStructuredObject.mockResolvedValueOnce({
        output: { outcome, feedback: `${outcome} feedback.` },
        rawOutput: {},
        providerDiagnostics: null,
        provider: 'openai-compatible',
        model: 'test-model',
      });
      const completeRewritePractice = await loadCompleteRewritePractice();

      await completeRewritePractice({
        rewriteTaskId: 'rewrite_d3',
        userRewriteText: 'Last week I visited my cousin.',
      });

      expect(fakeDatabase.rewriteTasks().filter((task) => task.spacedStage === 'D+7')).toHaveLength(0);
    }
  });

  it('creates D+7 when a weak D+3 outcome is recovered to correct', async () => {
    const previousCheckTime = new Date(now.getTime() - 60_000);
    const recoveryTime = new Date(now.getTime() + 60_000);
    fakeDatabase.reset();
    fakeDatabase.seedPracticeWithPendingRewrite({
      ...createD3RewriteTask('rewrite_d3'),
      status: 'completed',
      userRewriteText: 'I visit my cousin.',
      completedAt: previousCheckTime,
    });
    fakeDatabase.seedRewriteCheck(
      createCompletedRewriteCheck({
        id: 'rewrite_check_d3_weak',
        rewriteTaskId: 'rewrite_d3',
        outcome: 'partly_correct',
        feedback: 'Transfer is close but incomplete.',
        at: previousCheckTime,
      }),
    );
    vi.setSystemTime(recoveryTime);
    const completeRewritePractice = await loadCompleteRewritePractice();

    const result = await completeRewritePractice({
      rewriteTaskId: 'rewrite_d3',
      userRewriteText: 'Last week I visited my cousin.',
    });

    const d7Tasks = fakeDatabase.rewriteTasks().filter((task) => task.spacedStage === 'D+7');
    expect(result.success).toBe(true);
    expect(result.rewritePractice).toMatchObject({
      id: 'rewrite_d3',
      latestRewriteCheck: { status: 'completed', outcome: 'correct' },
    });
    expect(d7Tasks).toHaveLength(1);
    expect(d7Tasks[0]).toMatchObject({
      spacedStage: 'D+7',
      dueAt: new Date(recoveryTime.getTime() + SEVEN_DAYS_MS),
    });
  });

  it('does not fail D+3 completion transport or create D+7 when the prompt contract is invalid', async () => {
    fakeDatabase.reset();
    fakeDatabase.seedPracticeWithPendingRewrite({
      ...createD3RewriteTask('rewrite_d3'),
      promptContractJson: JSON.stringify({ invalid: true }),
    });
    const completeRewritePractice = await loadCompleteRewritePractice();

    const result = await completeRewritePractice({
      rewriteTaskId: 'rewrite_d3',
      userRewriteText: 'Last week I visited my cousin.',
    });

    expect(result.success).toBe(true);
    expect(result.rewritePractice?.latestRewriteCheck).toMatchObject({ status: 'retryable', outcome: null });
    expect(fakeDatabase.rewriteTasks().filter((task) => task.spacedStage === 'D+7')).toHaveLength(0);
  });

  it('keeps D+7 generation idempotent across retries after the first correct D+3 check', async () => {
    fakeDatabase.reset();
    fakeDatabase.seedPracticeWithPendingRewrite(createD3RewriteTask('rewrite_d3'));
    const completeRewritePractice = await loadCompleteRewritePractice();
    await completeRewritePractice({
      rewriteTaskId: 'rewrite_d3',
      userRewriteText: 'Last week I visited my cousin.',
    });
    const retryRewriteCheck = await loadRetryRewriteCheck();

    await retryRewriteCheck({ rewriteTaskId: 'rewrite_d3' });

    expect(fakeDatabase.rewriteTasks().filter((task) => task.spacedStage === 'D+7')).toHaveLength(1);
  });

  it('branches D+7 rewrite-check evaluation to spaced transfer semantics and does not create later tasks', async () => {
    fakeDatabase.reset();
    fakeDatabase.seedPracticeWithPendingRewrite(createD7RewriteTask('rewrite_d7'));
    const completeRewritePractice = await loadCompleteRewritePractice();

    const result = await completeRewritePractice({
      rewriteTaskId: 'rewrite_d7',
      userRewriteText: 'Last month I finished the report.',
    });

    expect(result.success).toBe(true);
    const evaluationInput = mocks.generateStructuredObject.mock.calls[0]?.[0];
    expect(evaluationInput.systemPrompt).toContain('D+7 new context');
    expect(evaluationInput.userPrompt).toContain('Evaluate this D+7 new-context reuse submission.');
    expect(evaluationInput.userPrompt).toContain('spaced reuse check');
    expect(evaluationInput.userPrompt).toContain('Last month I finished the report.');
    expect(fakeDatabase.rewriteTasks().filter((task) => task.kind === 'new_context_reuse')).toHaveLength(1);
  });

  it('allows D+7 recovery checks without creating any later task', async () => {
    const previousCheckTime = new Date(now.getTime() - 60_000);
    fakeDatabase.reset();
    fakeDatabase.seedPracticeWithPendingRewrite({
      ...createD7RewriteTask('rewrite_d7'),
      status: 'completed',
      userRewriteText: 'I finish the report.',
      completedAt: previousCheckTime,
    });
    fakeDatabase.seedRewriteCheck(
      createCompletedRewriteCheck({
        id: 'rewrite_check_d7_weak',
        rewriteTaskId: 'rewrite_d7',
        outcome: 'incorrect',
        feedback: 'The spaced reuse was not shown yet.',
        at: previousCheckTime,
      }),
    );
    const completeRewritePractice = await loadCompleteRewritePractice();

    const result = await completeRewritePractice({
      rewriteTaskId: 'rewrite_d7',
      userRewriteText: 'Last month I finished the report.',
    });

    expect(result.success).toBe(true);
    expect(result.rewritePractice).toMatchObject({
      id: 'rewrite_d7',
      latestRewriteCheck: { status: 'completed', outcome: 'correct' },
    });
    expect(fakeDatabase.rewriteChecks()).toHaveLength(2);
    expect(fakeDatabase.rewriteTasks().filter((task) => task.kind === 'new_context_reuse')).toHaveLength(1);
  });

  it('returns persisted retryable retry attempts as successful transport results', async () => {
    fakeDatabase.reset();
    fakeDatabase.seedPracticeWithPendingRewrite();
    mocks.generateStructuredObject.mockRejectedValueOnce(new Error('temporary network failure'));
    const completeRewritePractice = await loadCompleteRewritePractice();
    await completeRewritePractice({ rewriteTaskId: 'rewrite_1', userRewriteText: 'I went home.' });

    mocks.generateStructuredObject.mockClear();
    mocks.generateStructuredObject.mockRejectedValueOnce(new Error('temporary retry failure'));
    const retryRewriteCheck = await loadRetryRewriteCheck();

    const result = await retryRewriteCheck({ rewriteTaskId: 'rewrite_1' });

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.rewriteCheck).toMatchObject({
      status: 'retryable',
      outcome: null,
      errorMessage: 'AI service connection failed while checking this rewrite. Try again or check Settings.',
    });
    expect(result.rewritePractice?.latestRewriteCheck).toMatchObject({ status: 'retryable', outcome: null });
    expect(fakeDatabase.rewriteChecks()).toHaveLength(2);
  });

  it('removes skipped rewrite practice from the pending practice slot', async () => {
    fakeDatabase.reset();
    fakeDatabase.seedPracticeWithPendingRewrite();
    const skipRewritePractice = await loadSkipRewritePractice();

    const result = skipRewritePractice({ rewriteTaskId: 'rewrite_1' });

    expect(result.success).toBe(true);
    expect(result.writing?.pendingRewritePractice).toBeNull();
    expect(result.rewritePractice).toMatchObject({ id: 'rewrite_1', status: 'skipped' });
    expect(fakeDatabase.rewriteTask('rewrite_1')).toMatchObject({ status: 'skipped', skippedAt: now });
  });

  it('snoozes rewrite practice for one day without creating a rewrite check', async () => {
    fakeDatabase.reset();
    fakeDatabase.seedPracticeWithPendingRewrite();
    const snoozeRewritePractice = await loadSnoozeRewritePractice();

    const result = snoozeRewritePractice({ rewriteTaskId: 'rewrite_1' });

    expect(result.success).toBe(true);
    expect(result.writing?.pendingRewritePractice).toBeNull();
    expect(result.rewritePractice).toMatchObject({
      id: 'rewrite_1',
      status: 'snoozed',
      dueAt: now.getTime() + ONE_DAY_MS,
      latestRewriteCheck: null,
    });
    expect(fakeDatabase.rewriteTask('rewrite_1')).toMatchObject({
      status: 'snoozed',
      dueAt: new Date(now.getTime() + ONE_DAY_MS),
    });
    expect(fakeDatabase.rewriteChecks()).toHaveLength(0);
  });

  it('returns due snoozed rewrite practice to the practice slot', async () => {
    fakeDatabase.reset();
    fakeDatabase.seedPracticeWithPendingRewrite({
      ...createPendingRewriteTask('rewrite_1'),
      status: 'snoozed',
      dueAt: now,
    });
    const getDueRewritePracticeForPractice = await loadGetDueRewritePracticeForPractice();

    const result = getDueRewritePracticeForPractice(now);

    expect(result).toMatchObject({ id: 'rewrite_1', status: 'snoozed' });
  });

  it('returns due D+7 new-context reuse practice to the practice slot', async () => {
    fakeDatabase.reset();
    const dueAt = new Date(now.getTime() + SEVEN_DAYS_MS);
    fakeDatabase.seedPracticeWithPendingRewrite({
      ...createD7RewriteTask('rewrite_d7'),
      createdAt: now,
      dueAt,
    });
    const getDueRewritePracticeForPractice = await loadGetDueRewritePracticeForPractice();

    const result = getDueRewritePracticeForPractice(new Date(dueAt.getTime() + 1_000));

    expect(result).toMatchObject({
      id: 'rewrite_d7',
      practiceKind: 'new_context_reuse',
      spacedStage: 'D+7',
      status: 'pending',
      isOlderThanSevenDays: false,
    });
    expect(fakeDatabase.rewriteTask('rewrite_d7')).toMatchObject({ status: 'pending' });
  });

  it('expires stale D+1 rewrite practice before selecting the practice slot', async () => {
    fakeDatabase.reset();
    const staleRewrite = {
      ...createPendingRewriteTask('rewrite_stale'),
      createdAt: new Date(now.getTime() - REWRITE_PRACTICE_MAX_AGE_MS - 1),
      dueAt: new Date(now.getTime() - ONE_DAY_MS),
    };
    const freshRewrite = createPendingRewriteTask('rewrite_fresh');
    fakeDatabase.seedPracticeWithPendingRewrite(staleRewrite);
    fakeDatabase.seedRewriteTask(freshRewrite);
    const getDueRewritePracticeForPractice = await loadGetDueRewritePracticeForPractice();

    const result = getDueRewritePracticeForPractice(now);

    expect(result).toMatchObject({ id: 'rewrite_fresh' });
    expect(fakeDatabase.rewriteTask('rewrite_stale')).toMatchObject({ status: 'expired' });
  });

  it('does not mutate terminal rewrite practice when complete is requested', async () => {
    fakeDatabase.reset();
    fakeDatabase.seedPracticeWithPendingRewrite({
      ...createPendingRewriteTask('rewrite_1'),
      status: 'skipped',
      skippedAt: now,
    });
    const completeRewritePractice = await loadCompleteRewritePractice();

    const result = await completeRewritePractice({ rewriteTaskId: 'rewrite_1', userRewriteText: 'I went home.' });

    expect(result.success).toBe(true);
    expect(result.rewritePractice).toMatchObject({
      id: 'rewrite_1',
      status: 'skipped',
      userRewriteText: null,
    });
    expect(fakeDatabase.rewriteTask('rewrite_1')).toMatchObject({
      status: 'skipped',
      skippedAt: now,
      userRewriteText: null,
      completedAt: null,
    });
    expect(fakeDatabase.rewriteChecks()).toHaveLength(0);
    expect(mocks.generateStructuredObject).not.toHaveBeenCalled();
  });

  it('does not mutate terminal rewrite practice when skip is requested', async () => {
    fakeDatabase.reset();
    fakeDatabase.seedPracticeWithPendingRewrite({
      ...createPendingRewriteTask('rewrite_1'),
      status: 'expired',
    });
    const skipRewritePractice = await loadSkipRewritePractice();

    const result = skipRewritePractice({ rewriteTaskId: 'rewrite_1' });

    expect(result.success).toBe(true);
    expect(result.rewritePractice).toMatchObject({
      id: 'rewrite_1',
      status: 'expired',
    });
    expect(fakeDatabase.rewriteTask('rewrite_1')).toMatchObject({
      status: 'expired',
      skippedAt: null,
      completedAt: null,
    });
  });

  it('does not mutate terminal rewrite practice when snooze is requested', async () => {
    fakeDatabase.reset();
    fakeDatabase.seedPracticeWithPendingRewrite({
      ...createPendingRewriteTask('rewrite_1'),
      status: 'completed',
      completedAt: now,
      userRewriteText: 'I went home.',
    });
    const snoozeRewritePractice = await loadSnoozeRewritePractice();

    const result = snoozeRewritePractice({ rewriteTaskId: 'rewrite_1' });

    expect(result.success).toBe(true);
    expect(result.rewritePractice).toMatchObject({
      id: 'rewrite_1',
      status: 'completed',
      dueAt: now.getTime(),
    });
    expect(fakeDatabase.rewriteTask('rewrite_1')).toMatchObject({
      status: 'completed',
      dueAt: now,
      userRewriteText: 'I went home.',
    });
    expect(fakeDatabase.rewriteChecks()).toHaveLength(0);
  });
});

function createPendingRewriteTask(id: string): RewriteTaskRow {
  return {
    id,
    reviewRunId: 'review_1',
    originalSentence: 'I go home.',
    focusPattern: 'tense_pattern',
    nativeModelSentence: 'I went home.',
    prompt: 'Rewrite the original sentence.',
    kind: 'rewrite_original',
    spacedStage: 'D+1',
    promptContractJson: null,
    status: 'pending',
    userRewriteText: null,
    dueAt: now,
    completedAt: null,
    skippedAt: null,
    createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
  };
}

function createCompletedRewriteCheck({
  id,
  rewriteTaskId = 'rewrite_1',
  outcome,
  feedback,
  at,
}: {
  id: string;
  rewriteTaskId?: string;
  outcome: 'correct' | 'partly_correct' | 'incorrect';
  feedback: string;
  at: Date;
}): RewriteCheckRow {
  return {
    id,
    rewriteTaskId,
    status: 'completed',
    outcome,
    feedback,
    provider: 'test-provider',
    model: 'test-model',
    validationErrorsJson: null,
    errorMessage: null,
    diagnosticsJson: null,
    createdAt: at,
    updatedAt: at,
    completedAt: at,
  };
}

function createD3RewriteTask(id: string): RewriteTaskRow {
  return {
    id,
    reviewRunId: 'review_1',
    originalSentence: 'New-context reuse practice',
    focusPattern: 'Use past tense for completed actions.',
    nativeModelSentence: '',
    prompt: 'Write one or two fresh English lines in a new everyday situation.',
    kind: 'new_context_reuse',
    spacedStage: 'D+3',
    promptContractJson: JSON.stringify({
      targetMeaning: 'use past tense for completed actions',
      allowedHints: ['A completed past action should use past-tense verb forms.'],
      forbiddenHints: ['went home'],
      expectedPatternFamily: 'grammar',
    }),
    status: 'pending',
    userRewriteText: null,
    dueAt: now,
    completedAt: null,
    skippedAt: null,
    createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
  };
}

function createD7RewriteTask(id: string): RewriteTaskRow {
  return {
    ...createD3RewriteTask(id),
    spacedStage: 'D+7',
    dueAt: now,
  };
}

function createPatternFingerprint(): {
  patternType: 'grammar';
  learnerError: string;
  targetCorrection: string;
  abstractRule: string;
  positiveExamples: string[];
  negativeExample: string;
  transferBoundary: string;
  forbiddenLeakageTerms: string[];
} {
  return {
    patternType: 'grammar',
    learnerError: 'uses present tense for a completed past action',
    targetCorrection: 'use past tense for completed actions',
    abstractRule: 'Use past tense when the action is finished in the past.',
    positiveExamples: ['Yesterday I went home.'],
    negativeExample: 'Yesterday I go home.',
    transferBoundary: 'A completed past action should use past-tense verb forms.',
    forbiddenLeakageTerms: ['went home'],
  };
}

function createSettingsSnapshot(): {
  provider: string;
  baseUrl: string;
  model: string;
  providerApiKeyStatus: 'configured';
  rawResponseStorageEnabled: boolean;
  reviewThinkingEnabled: boolean;
  aiModelSettings: {
    defaultProviderId: 'openai-compatible';
    providers: {
      'openai-compatible': {
        providerId: 'openai-compatible';
        provider: string;
        baseUrl: string;
        model: string;
        isLocalModel: boolean;
        apiKeyStatus: { providerId: 'openai-compatible'; status: 'configured'; storage: 'os-keychain' };
      };
      anthropic: {
        providerId: 'anthropic';
        provider: string;
        model: string;
        isLocalModel: boolean;
        apiKeyStatus: { providerId: 'anthropic'; status: 'not-configured'; storage: 'os-keychain' };
      };
    };
    featureOverrides: Record<string, never>;
  };
} {
  return {
    provider: 'OpenAI-compatible',
    baseUrl: 'https://example.test/v1',
    model: 'test-model',
    providerApiKeyStatus: 'configured',
    rawResponseStorageEnabled: false,
    reviewThinkingEnabled: false,
    aiModelSettings: {
      defaultProviderId: 'openai-compatible',
      providers: {
        'openai-compatible': {
          providerId: 'openai-compatible',
          provider: 'OpenAI-compatible',
          baseUrl: 'https://example.test/v1',
          model: 'test-model',
          isLocalModel: false,
          apiKeyStatus: { providerId: 'openai-compatible', status: 'configured', storage: 'os-keychain' },
        },
        anthropic: {
          providerId: 'anthropic',
          provider: 'Anthropic Claude',
          model: 'claude-sonnet-4-5',
          isLocalModel: false,
          apiKeyStatus: { providerId: 'anthropic', status: 'not-configured', storage: 'os-keychain' },
        },
      },
      featureOverrides: {},
    },
  };
}

function emptyStore(): RowStore {
  return {
    writingAttempts: [],
    writingRevisions: [],
    reviewRuns: [],
    rewriteChecks: [],
    rewriteTasks: [],
    errorPatterns: [],
    corrections: [],
  };
}

function tableName(table: unknown): TableName {
  const name = typeof table === 'object' && table !== null ? tableNames.get(table) : undefined;
  if (!name) {
    throw new Error('Unknown table');
  }
  return name;
}

function conditionHasId(condition: unknown): boolean {
  if (typeof condition !== 'object' || condition === null || !('queryChunks' in condition)) {
    return false;
  }

  return (condition as { queryChunks: unknown[] }).queryChunks.some(
    (chunk) =>
      typeof chunk === 'object' &&
      chunk !== null &&
      'value' in chunk &&
      typeof (chunk as { value?: unknown }).value === 'string',
  );
}

function extractId(condition: unknown): string {
  if (typeof condition !== 'object' || condition === null || !('queryChunks' in condition)) {
    throw new Error('Unsupported where condition');
  }

  const chunks = (condition as { queryChunks: unknown[] }).queryChunks;
  const param = chunks.find((chunk) => {
    if (typeof chunk !== 'object' || chunk === null || !('value' in chunk)) {
      return false;
    }
    return typeof (chunk as { value?: unknown }).value === 'string';
  });

  if (
    typeof param !== 'object' ||
    param === null ||
    !('value' in param) ||
    typeof (param as { value?: unknown }).value !== 'string'
  ) {
    throw new Error('Unsupported where parameter');
  }

  return (param as { value: string }).value;
}
