import { describe, expect, it, vi } from 'vitest';
import { journalEntries, journalRevisions, reviewRuns, rewriteTasks } from '../src/main/db/schema';
import type {
  journalEntries as journalEntriesTable,
  journalRevisions as journalRevisionsTable,
  reviewRuns as reviewRunsTable,
  rewriteTasks as rewriteTasksTable,
} from '../src/main/db/schema';
import type { db as appDatabase } from '../src/main/db/client';
import type { completeRewritePractice as completeRewritePracticeFunction, skipRewritePractice as skipRewritePracticeFunction } from '../src/main/services/journal/service';

type AppDatabase = typeof appDatabase;
type JournalEntryRow = typeof journalEntriesTable.$inferSelect;
type JournalRevisionRow = typeof journalRevisionsTable.$inferSelect;
type ReviewRunRow = typeof reviewRunsTable.$inferSelect;
type RewriteTaskRow = typeof rewriteTasksTable.$inferSelect;
type StoredRow = JournalEntryRow | JournalRevisionRow | ReviewRunRow | RewriteTaskRow;
type TableName = 'journalEntries' | 'journalRevisions' | 'reviewRuns' | 'rewriteTasks';

type RowStore = {
  journalEntries: JournalEntryRow[];
  journalRevisions: JournalRevisionRow[];
  reviewRuns: ReviewRunRow[];
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
  [journalEntries, 'journalEntries'],
  [journalRevisions, 'journalRevisions'],
  [reviewRuns, 'reviewRuns'],
  [rewriteTasks, 'rewriteTasks'],
]);

class FakeJournalDatabase {
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

  seedTodayWithPendingRewrite(): void {
    this.store.journalEntries.push({
      id: 'journal_1',
      dateKey: '2026-04-30',
      activeRevisionId: 'revision_1',
      lastReviewRunId: null,
      reviewedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    this.store.journalRevisions.push({
      id: 'revision_1',
      journalEntryId: 'journal_1',
      content: 'Today I go home.',
      contentHash: 'hash_a',
      createdAt: now,
    });
    this.store.reviewRuns.push({
      id: 'review_1',
      journalEntryId: 'journal_1',
      journalRevisionId: 'revision_1',
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
      const filtered = this.store.rewriteTasks.filter((task) => task.status === 'pending' && task.kind === 'rewrite_original' && task.spacedStage === 'D+1' && task.dueAt !== null && task.dueAt.getTime() <= now.getTime());
      return new QueryResult(filtered);
    }

    const value = extractId(condition);
    if (table === 'journalEntries') {
      return new QueryResult(this.store.journalEntries.filter((row) => row.id === value || row.dateKey === value));
    }

    return new QueryResult(rows.filter((row) => row.id === value));
  }

  private updateRow(table: TableName, id: string, patch: unknown): StoredRow | undefined {
    const row = this.rowsFor(table).find((candidate) => candidate.id === id);
    if (!row) {
      return undefined;
    }

    Object.assign(row, patch, table === 'journalEntries' || table === 'reviewRuns' ? { updatedAt: now } : {});
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

  orderBy(): { all: () => StoredRow[] } {
    return { all: () => [...this.rows] };
  }
}

const fakeDatabase = new FakeJournalDatabase();

async function loadCompleteRewritePractice(): Promise<typeof completeRewritePracticeFunction> {
  const module = await import('../src/main/services/journal/service');
  return module.completeRewritePractice;
}

async function loadSkipRewritePractice(): Promise<typeof skipRewritePracticeFunction> {
  const module = await import('../src/main/services/journal/service');
  return module.skipRewritePractice;
}

describe('rewrite practice service updates', () => {
  it('returns the completed rewrite practice even after it is no longer pending for Today', async () => {
    fakeDatabase.reset();
    fakeDatabase.seedTodayWithPendingRewrite();
    const completeRewritePractice = await loadCompleteRewritePractice();

    const result = completeRewritePractice({ rewriteTaskId: 'rewrite_1', userRewriteText: ' I went home. ' });

    expect(result.success).toBe(true);
    expect(result.journal?.pendingRewritePractice).toBeNull();
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

  it('removes skipped rewrite practice from the pending Today slot', async () => {
    fakeDatabase.reset();
    fakeDatabase.seedTodayWithPendingRewrite();
    const skipRewritePractice = await loadSkipRewritePractice();

    const result = skipRewritePractice({ rewriteTaskId: 'rewrite_1' });

    expect(result.success).toBe(true);
    expect(result.journal?.pendingRewritePractice).toBeNull();
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
    journalEntries: [],
    journalRevisions: [],
    reviewRuns: [],
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

  return (condition as { queryChunks: unknown[] }).queryChunks.some((chunk) => typeof chunk === 'object' && chunk !== null && 'value' in chunk && typeof (chunk as { value?: unknown }).value === 'string');
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

  if (typeof param !== 'object' || param === null || !('value' in param) || typeof (param as { value?: unknown }).value !== 'string') {
    throw new Error('Unsupported where parameter');
  }

  return (param as { value: string }).value;
}
