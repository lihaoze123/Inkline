import { describe, expect, it, vi } from 'vitest';
import {
  corrections,
  journalEntries,
  journalRevisions,
  referenceRewrites,
  reviewRuns,
  rewriteTasks,
  selfRepairAttempts,
} from '../src/main/db/schema';
import type {
  corrections as correctionsTable,
  journalEntries as journalEntriesTable,
  journalRevisions as journalRevisionsTable,
  referenceRewrites as referenceRewritesTable,
  reviewRuns as reviewRunsTable,
  rewriteTasks as rewriteTasksTable,
  selfRepairAttempts as selfRepairAttemptsTable,
} from '../src/main/db/schema';
import type { db as appDatabase } from '../src/main/db/client';
import type { saveReviewRun as saveReviewRunFunction } from '../src/main/services/review/procedures/save';
import type { PreviewOperationsSnapshot, SaveReviewOutput } from '../src/shared/types/review';

type AppDatabase = typeof appDatabase;

type JournalEntryRow = typeof journalEntriesTable.$inferSelect;
type JournalRevisionRow = typeof journalRevisionsTable.$inferSelect;
type ReviewRunRow = typeof reviewRunsTable.$inferSelect;
type CorrectionRow = typeof correctionsTable.$inferSelect;
type SelfRepairAttemptRow = typeof selfRepairAttemptsTable.$inferSelect;
type ReferenceRewriteRow = typeof referenceRewritesTable.$inferSelect;
type RewriteTaskRow = typeof rewriteTasksTable.$inferSelect;

type StoredRow =
  | JournalEntryRow
  | JournalRevisionRow
  | ReviewRunRow
  | CorrectionRow
  | SelfRepairAttemptRow
  | ReferenceRewriteRow
  | RewriteTaskRow;

type TableName =
  | 'journalEntries'
  | 'journalRevisions'
  | 'reviewRuns'
  | 'corrections'
  | 'selfRepairAttempts'
  | 'referenceRewrites'
  | 'rewriteTasks';

type RowStore = {
  journalEntries: JournalEntryRow[];
  journalRevisions: JournalRevisionRow[];
  reviewRuns: ReviewRunRow[];
  corrections: CorrectionRow[];
  selfRepairAttempts: SelfRepairAttemptRow[];
  referenceRewrites: ReferenceRewriteRow[];
  rewriteTasks: RewriteTaskRow[];
};

vi.mock('../src/main/db/client', () => ({
  db: {},
  getDatabasePath: () => ':memory:',
  sqlite: {},
}));

const now = new Date('2026-04-29T12:00:00.000Z');
vi.setSystemTime(now);
const tableNames = new Map<object, TableName>([
  [journalEntries, 'journalEntries'],
  [journalRevisions, 'journalRevisions'],
  [reviewRuns, 'reviewRuns'],
  [corrections, 'corrections'],
  [selfRepairAttempts, 'selfRepairAttempts'],
  [referenceRewrites, 'referenceRewrites'],
  [rewriteTasks, 'rewriteTasks'],
]);

class FakeReviewDatabase {
  private store: RowStore = emptyStore();
  public failOnInsertTable: TableName | null = null;

  transaction<T>(callback: (tx: FakeReviewDatabase) => T): T {
    const snapshot = cloneStore(this.store);
    try {
      return callback(this);
    } catch (error) {
      this.store = snapshot;
      throw error;
    }
  }

  select(): {
    from: (table: unknown) => {
      where: (condition: unknown) => { get: () => StoredRow | undefined; all: () => StoredRow[] };
      get: () => StoredRow | undefined;
      all: () => StoredRow[];
    };
  } {
    return {
      from: (table: unknown) => {
        const rows = this.rowsFor(tableName(table));
        return {
          where: (condition: unknown) => {
            const id = extractId(condition);
            const filtered = rows.filter((row) => row.id === id);
            return {
              get: () => filtered[0],
              all: () => [...filtered],
            };
          },
          get: () => rows[0],
          all: () => [...rows],
        };
      },
    };
  }

  insert(table: unknown): {
    values: (value: unknown) => { run: () => void; returning: () => { get: () => StoredRow } };
  } {
    return {
      values: (value: unknown) => {
        const inserted = this.insertRow(tableName(table), value);
        return {
          run: () => undefined,
          returning: () => ({ get: () => inserted }),
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

  seedJournal(activeHash = 'hash_a'): void {
    this.store.journalEntries.push({
      id: 'journal_1',
      dateKey: '2026-04-29',
      activeRevisionId: activeHash === 'hash_a' ? 'revision_reviewed' : 'revision_active',
      lastReviewRunId: null,
      reviewedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    this.store.journalRevisions.push({
      id: 'revision_reviewed',
      journalEntryId: 'journal_1',
      content: 'Today I go home.',
      contentHash: 'hash_a',
      createdAt: now,
    });

    if (activeHash !== 'hash_a') {
      this.store.journalRevisions.push({
        id: 'revision_active',
        journalEntryId: 'journal_1',
        content: 'Today I went home.',
        contentHash: activeHash,
        createdAt: now,
      });
    }
  }

  seedReadyReview(operations: PreviewOperationsSnapshot): void {
    this.store.reviewRuns.push({
      id: 'review_1',
      journalEntryId: 'journal_1',
      journalRevisionId: 'revision_reviewed',
      contentHash: 'hash_a',
      status: 'review_ready',
      validationStatus: 'valid',
      provider: 'test-provider',
      model: 'test-model',
      inputSnapshotJson: null,
      rawOutputJson: null,
      parsedOutputJson: null,
      previewOperationsJson: JSON.stringify(operations),
      validationErrorsJson: JSON.stringify([]),
      createdAt: now,
      updatedAt: now,
    });
  }

  setLastReviewRunId(reviewRunId: string): void {
    const entry = this.store.journalEntries.find((candidate) => candidate.id === 'journal_1');
    if (entry) {
      entry.lastReviewRunId = reviewRunId;
    }
  }

  reviewRun(): ReviewRunRow | undefined {
    return this.store.reviewRuns.find((candidate) => candidate.id === 'review_1');
  }

  journalEntry(): JournalEntryRow | undefined {
    return this.store.journalEntries.find((candidate) => candidate.id === 'journal_1');
  }

  count(table: TableName): number {
    return this.store[table].length;
  }

  savedCorrections(): CorrectionRow[] {
    return [...this.store.corrections];
  }

  savedRewriteTasks(): RewriteTaskRow[] {
    return [...this.store.rewriteTasks];
  }

  asAppDatabase(): AppDatabase {
    return this as unknown as AppDatabase;
  }

  private rowsFor(table: TableName): StoredRow[] {
    return this.store[table] as StoredRow[];
  }

  private insertRow(table: TableName, value: unknown): StoredRow {
    if (this.failOnInsertTable === table) {
      throw new Error(`insert failed for ${table}`);
    }

    const row = toRecord(value);
    switch (table) {
      case 'corrections': {
        const inserted = row as CorrectionRow;
        this.store.corrections.push(inserted);
        return inserted;
      }
      case 'selfRepairAttempts': {
        const inserted = { ...row, createdAt: now } as SelfRepairAttemptRow;
        this.store.selfRepairAttempts.push(inserted);
        return inserted;
      }
      case 'referenceRewrites': {
        const inserted = { ...row, createdAt: now } as ReferenceRewriteRow;
        this.store.referenceRewrites.push(inserted);
        return inserted;
      }
      case 'rewriteTasks': {
        const inserted = { ...row, userRewriteText: null, completedAt: null, skippedAt: null, createdAt: now } as RewriteTaskRow;
        this.store.rewriteTasks.push(inserted);
        return inserted;
      }
      default:
        throw new Error(`Unsupported insert table: ${table}`);
    }
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

async function loadSaveReviewRun(): Promise<typeof saveReviewRunFunction> {
  const module = await import('../src/main/services/review/procedures/save');
  return module.saveReviewRun;
}

function currentJournal(): NonNullable<SaveReviewOutput['journal']> {
  return {
    entryId: 'journal_1',
    dateKey: '2026-04-29',
    activeRevision: {
      id: 'revision_reviewed',
      journalEntryId: 'journal_1',
      content: 'Today I go home.',
      contentHash: 'hash_a',
      createdAt: now.getTime(),
    },
    lastAutosaveAt: now.getTime(),
    lastReviewRunId: 'review_1',
    staleReview: null,
    pendingRewritePractice: null,
  };
}

function baseOperations(overrides: Partial<PreviewOperationsSnapshot> = {}): PreviewOperationsSnapshot {
  return {
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
        contentHash: 'hash_a',
        matchedPatternId: 'tense_pattern',
        newPatternSuggestion: null,
      },
    ],
    patternOperations: [],
    referenceRewrites: [
      {
        rewriteIndex: 0,
        text: 'Today I went home.',
        noticeTheGap: 'The verb changes to past tense.',
        updatesLongTermStats: false,
      },
    ],
    selfRepair: {
      correctionIndex: 0,
      prompt: 'Rewrite the sentence in past tense.',
      hint: 'Use the past form of the verb.',
      updatesLongTermStats: false,
    },
    rewritePractice: [
      {
        taskIndex: 0,
        kind: 'rewrite_original',
        prompt: 'Rewrite the original sentence.',
        focusCorrectionIndexes: [0],
        dueOffsetDays: 1,
        revealNativeModelAfterSubmit: true,
        updatesLongTermStats: false,
      },
    ],
    inputBridge: {
      correctionIndex: 0,
      examples: ['Yesterday I went home.'],
      updatesLongTermStats: false,
    },
    ...overrides,
  };
}

describe('saveReviewRun transaction', () => {
  it('saves review artifacts atomically and is idempotent', async () => {
    const database = new FakeReviewDatabase();
    database.seedJournal();
    database.seedReadyReview(baseOperations());
    const saveReviewRun = await loadSaveReviewRun();

    const firstSave = saveReviewRun(
      { reviewRunId: 'review_1', selfRepairAttemptText: 'I went home', revealedWithoutAttempt: false },
      { database: database.asAppDatabase(), getTodayJournalSnapshot: currentJournal }
    );
    const secondSave = saveReviewRun(
      { reviewRunId: 'review_1', selfRepairAttemptText: 'I went home', revealedWithoutAttempt: false },
      { database: database.asAppDatabase(), getTodayJournalSnapshot: currentJournal }
    );

    expect(firstSave.success).toBe(true);
    expect(secondSave.success).toBe(true);
    expect(secondSave.reviewRun?.status).toBe('review_saved');
    expect(database.journalEntry()?.lastReviewRunId).toBe('review_1');
    expect(database.journalEntry()?.reviewedAt).toBeInstanceOf(Date);
    expect(database.count('corrections')).toBe(1);
    expect(database.count('selfRepairAttempts')).toBe(1);
    expect(database.count('referenceRewrites')).toBe(1);
    expect(database.count('rewriteTasks')).toBe(1);
    expect(database.savedRewriteTasks()[0]).toMatchObject({
      originalSentence: 'I go home',
      focusPattern: 'tense_pattern',
      nativeModelSentence: 'I went home',
      kind: 'rewrite_original',
      spacedStage: 'D+1',
      status: 'pending',
    });
    expect(database.savedRewriteTasks()[0].dueAt?.getTime()).toBeGreaterThanOrEqual(now.getTime() + 24 * 60 * 60 * 1000 - 1000);
  });

  it('rolls back partial writes when one transaction step fails', async () => {
    const database = new FakeReviewDatabase();
    database.seedJournal();
    database.seedReadyReview(baseOperations());
    database.failOnInsertTable = 'referenceRewrites';
    const saveReviewRun = await loadSaveReviewRun();

    const result = saveReviewRun({ reviewRunId: 'review_1' }, { database: database.asAppDatabase(), getTodayJournalSnapshot: currentJournal });

    expect(result.success).toBe(false);
    expect(database.reviewRun()?.status).toBe('review_ready');
    expect(database.count('corrections')).toBe(0);
    expect(database.count('selfRepairAttempts')).toBe(0);
    expect(database.count('referenceRewrites')).toBe(0);
    expect(database.count('rewriteTasks')).toBe(0);
  });

  it('excludes low-confidence corrections from saved corrections and rewrite practice', async () => {
    const database = new FakeReviewDatabase();
    database.seedJournal();
    database.seedReadyReview(baseOperations({
      corrections: [
        ...baseOperations().corrections,
        {
          correctionIndex: 1,
          originalText: 'a office',
          correctedText: 'an office',
          explanation: 'Use an before a vowel sound.',
          category: 'article',
          confidence: 'low',
          status: 'low_confidence',
          startOffset: 20,
          endOffset: 28,
          contentHash: 'hash_a',
          matchedPatternId: 'article_pattern',
          newPatternSuggestion: null,
          lowConfidenceReason: 'model_low_confidence',
        },
      ],
      rewritePractice: [
        {
          taskIndex: 0,
          kind: 'rewrite_original',
          prompt: 'Rewrite the low-confidence sentence.',
          focusCorrectionIndexes: [1],
          dueOffsetDays: 1,
          revealNativeModelAfterSubmit: true,
          updatesLongTermStats: false,
        },
      ],
    }));
    const saveReviewRun = await loadSaveReviewRun();

    const result = saveReviewRun({ reviewRunId: 'review_1' }, { database: database.asAppDatabase(), getTodayJournalSnapshot: currentJournal });

    if (!result.success) {
      throw new Error(result.error);
    }
    expect(result).toMatchObject({ success: true });
    expect(database.savedCorrections()).toHaveLength(1);
    expect(database.savedCorrections()[0].pattern).toBe('tense_pattern');
    expect(database.count('rewriteTasks')).toBe(0);
  });

  it('creates at most one D+1 rewrite task from a saved review', async () => {
    const database = new FakeReviewDatabase();
    database.seedJournal();
    database.seedReadyReview(baseOperations({
      rewritePractice: [
        ...baseOperations().rewritePractice,
        {
          taskIndex: 1,
          kind: 'rewrite_original',
          prompt: 'Second practice should not be saved.',
          focusCorrectionIndexes: [0],
          dueOffsetDays: 1,
          revealNativeModelAfterSubmit: true,
          updatesLongTermStats: false,
        },
      ],
    }));
    const saveReviewRun = await loadSaveReviewRun();

    const result = saveReviewRun({ reviewRunId: 'review_1' }, { database: database.asAppDatabase(), getTodayJournalSnapshot: currentJournal });

    if (!result.success) {
      throw new Error(result.error);
    }
    expect(database.savedRewriteTasks()).toHaveLength(1);
    expect(database.savedRewriteTasks()[0].prompt).toBe('Rewrite the original sentence.');
  });

  it('does not create a rewrite task unless it practices the focus correction', async () => {
    const database = new FakeReviewDatabase();
    database.seedJournal();
    database.seedReadyReview(baseOperations({
      corrections: [
        ...baseOperations().corrections,
        {
          correctionIndex: 1,
          originalText: 'a office',
          correctedText: 'an office',
          explanation: 'Use an before a vowel sound.',
          category: 'article',
          confidence: 'high',
          status: 'suggested',
          startOffset: 20,
          endOffset: 28,
          contentHash: 'hash_a',
          matchedPatternId: 'article_pattern',
          newPatternSuggestion: null,
        },
      ],
      rewritePractice: [
        {
          taskIndex: 0,
          kind: 'rewrite_original',
          prompt: 'Rewrite a non-focus sentence.',
          focusCorrectionIndexes: [1],
          dueOffsetDays: 1,
          revealNativeModelAfterSubmit: true,
          updatesLongTermStats: false,
        },
      ],
    }));
    const saveReviewRun = await loadSaveReviewRun();

    const result = saveReviewRun({ reviewRunId: 'review_1' }, { database: database.asAppDatabase(), getTodayJournalSnapshot: currentJournal });

    if (!result.success) {
      throw new Error(result.error);
    }
    expect(database.count('rewriteTasks')).toBe(0);
  });

  it('keeps the saved review pointer unchanged when the preview is stale before save', async () => {
    const database = new FakeReviewDatabase();
    database.seedJournal('hash_b');
    database.setLastReviewRunId('older_review');
    database.seedReadyReview(baseOperations());
    const saveReviewRun = await loadSaveReviewRun();

    const result = saveReviewRun({ reviewRunId: 'review_1' }, { database: database.asAppDatabase(), getTodayJournalSnapshot: currentJournal });

    if (!result.success) {
      throw new Error(result.error);
    }
    expect(result).toMatchObject({ success: true });
    expect(database.reviewRun()?.status).toBe('stale');
    expect(database.journalEntry()?.lastReviewRunId).toBe('older_review');
  });

  it('rejects a review that lacks one anchored focus correction', async () => {
    const database = new FakeReviewDatabase();
    database.seedJournal();
    database.seedReadyReview(baseOperations({
      corrections: [
        {
          ...baseOperations().corrections[0],
          status: 'low_confidence',
          lowConfidenceReason: 'model_low_confidence',
        },
      ],
    }));
    const saveReviewRun = await loadSaveReviewRun();

    const result = saveReviewRun({ reviewRunId: 'review_1' }, { database: database.asAppDatabase(), getTodayJournalSnapshot: currentJournal });

    expect(result.success).toBe(false);
    expect(database.reviewRun()?.status).toBe('review_ready');
    expect(database.count('corrections')).toBe(0);
    expect(database.count('selfRepairAttempts')).toBe(0);
    expect(database.count('referenceRewrites')).toBe(0);
    expect(database.count('rewriteTasks')).toBe(0);
  });
});

function emptyStore(): RowStore {
  return {
    journalEntries: [],
    journalRevisions: [],
    reviewRuns: [],
    corrections: [],
    selfRepairAttempts: [],
    referenceRewrites: [],
    rewriteTasks: [],
  };
}

function cloneStore(store: RowStore): RowStore {
  return {
    journalEntries: store.journalEntries.map((row) => ({ ...row, createdAt: cloneDate(row.createdAt), updatedAt: cloneDate(row.updatedAt), reviewedAt: cloneNullableDate(row.reviewedAt) })),
    journalRevisions: store.journalRevisions.map((row) => ({ ...row, createdAt: cloneDate(row.createdAt) })),
    reviewRuns: store.reviewRuns.map((row) => ({ ...row, createdAt: cloneDate(row.createdAt), updatedAt: cloneDate(row.updatedAt) })),
    corrections: store.corrections.map((row) => ({ ...row })),
    selfRepairAttempts: store.selfRepairAttempts.map((row) => ({ ...row, createdAt: cloneDate(row.createdAt) })),
    referenceRewrites: store.referenceRewrites.map((row) => ({ ...row, createdAt: cloneDate(row.createdAt) })),
    rewriteTasks: store.rewriteTasks.map((row) => ({ ...row, createdAt: cloneDate(row.createdAt), dueAt: cloneNullableDate(row.dueAt) })),
  };
}

function tableName(table: unknown): TableName {
  const name = typeof table === 'object' && table !== null ? tableNames.get(table) : undefined;
  if (!name) {
    throw new Error('Unknown table');
  }
  return name;
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

function toRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Expected row object');
  }
  return value as Record<string, unknown>;
}

function cloneDate(value: Date): Date {
  return new Date(value.getTime());
}

function cloneNullableDate(value: Date | null): Date | null {
  return value ? cloneDate(value) : null;
}
