import { beforeEach, describe, expect, it, vi } from 'vitest';
import { writingAttempts, writingRevisions, reviewRuns, rewriteChecks, rewriteTasks } from '../src/main/db/schema';
import type {
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
type StoredRow = WritingAttemptRow | WritingRevisionRow | ReviewRunRow | RewriteCheckRow | RewriteTaskRow;
type TableName = 'writingAttempts' | 'writingRevisions' | 'reviewRuns' | 'rewriteChecks' | 'rewriteTasks';

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
const REWRITE_PRACTICE_MAX_AGE_MS = 7 * ONE_DAY_MS;

const tableNames = new Map<object, TableName>([
  [writingAttempts, 'writingAttempts'],
  [writingRevisions, 'writingRevisions'],
  [reviewRuns, 'reviewRuns'],
  [rewriteChecks, 'rewriteChecks'],
  [rewriteTasks, 'rewriteTasks'],
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
    values: (value: unknown) => { returning: () => { get: () => StoredRow } };
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
        return { returning: () => ({ get: () => row }) };
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

  rewriteTask(id: string): RewriteTaskRow | undefined {
    return this.store.rewriteTasks.find((task) => task.id === id);
  }

  rewriteChecks(): RewriteCheckRow[] {
    return [...this.store.rewriteChecks];
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
    status: 'pending',
    userRewriteText: null,
    dueAt: now,
    completedAt: null,
    skippedAt: null,
    createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
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
