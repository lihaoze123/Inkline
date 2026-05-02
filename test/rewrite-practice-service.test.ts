import { describe, expect, it, vi } from 'vitest';
import { writingAttempts, writingRevisions, reviewRuns, rewriteChecks, rewriteTasks } from '../src/main/db/schema';
import type {
  writingAttempts as writingAttemptsTable,
  writingRevisions as writingRevisionsTable,
  reviewRuns as reviewRunsTable,
  rewriteChecks as rewriteChecksTable,
  rewriteTasks as rewriteTasksTable,
} from '../src/main/db/schema';
import type { db as appDatabase } from '../src/main/db/client';
import type {
  completeRewritePractice as completeRewritePracticeFunction,
  skipRewritePractice as skipRewritePracticeFunction,
} from '../src/main/services/writing/service';

type AppDatabase = typeof appDatabase;
type WritingAttemptRow = typeof writingAttemptsTable.$inferSelect;
type WritingRevisionRow = typeof writingRevisionsTable.$inferSelect;
type ReviewRunRow = typeof reviewRunsTable.$inferSelect;
type RewriteCheckRow = typeof rewriteChecksTable.$inferSelect;
type RewriteTaskRow = typeof rewriteTasksTable.$inferSelect;
type StoredRow = WritingAttemptRow | WritingRevisionRow | ReviewRunRow | RewriteCheckRow | RewriteTaskRow;
type TableName = 'writingAttempts' | 'writingRevisions' | 'reviewRuns' | 'rewriteChecks' | 'rewriteTasks';

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

const now = new Date('2026-04-30T12:00:00.000Z');
vi.setSystemTime(now);

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

  seedPracticeWithPendingRewrite(): void {
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
    this.store.rewriteTasks.push(createPendingRewriteTask('rewrite_1'));
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

describe('rewrite practice service updates', () => {
  it('returns the completed rewrite practice even after it is no longer pending for Today', async () => {
    fakeDatabase.reset();
    fakeDatabase.seedPracticeWithPendingRewrite();
    const completeRewritePractice = await loadCompleteRewritePractice();

    const result = completeRewritePractice({ rewriteTaskId: 'rewrite_1', userRewriteText: ' I went home. ' });

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

  it('exposes the latest rewrite check snapshot when present', async () => {
    fakeDatabase.reset();
    fakeDatabase.seedPracticeWithPendingRewrite();
    fakeDatabase.seedCompletedRewriteCheck();
    const completeRewritePractice = await loadCompleteRewritePractice();

    const result = completeRewritePractice({ rewriteTaskId: 'rewrite_1', userRewriteText: 'I went home.' });

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
