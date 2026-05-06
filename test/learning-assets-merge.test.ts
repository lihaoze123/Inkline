import { describe, expect, it, vi } from 'vitest';
import { corrections, errorPatterns, rewriteChecks, rewriteTasks } from '../src/main/db/schema';
import type {
  corrections as correctionsTable,
  errorPatterns as errorPatternsTable,
  rewriteChecks as rewriteChecksTable,
  rewriteTasks as rewriteTasksTable,
} from '../src/main/db/schema';
import type { db as appDatabase } from '../src/main/db/client';
import {
  listErrorPatterns,
  mergeErrorPatterns,
  selectActiveReviewPatterns,
  type PatternEvidenceQueryRow,
} from '../src/main/services/learning-assets/service';

vi.mock('../src/main/db/client', () => ({
  db: {},
  getDatabasePath: () => ':memory:',
  sqlite: {},
}));

type AppDatabase = typeof appDatabase;
type ErrorPatternRow = typeof errorPatternsTable.$inferSelect;
type CorrectionRow = typeof correctionsTable.$inferSelect;
type RewriteTaskRow = typeof rewriteTasksTable.$inferSelect;
type RewriteCheckRow = typeof rewriteChecksTable.$inferSelect;
type StoredRow = ErrorPatternRow | CorrectionRow | RewriteTaskRow | RewriteCheckRow;
type TableName = 'errorPatterns' | 'corrections' | 'rewriteTasks' | 'rewriteChecks';
type RowStore = {
  errorPatterns: ErrorPatternRow[];
  corrections: CorrectionRow[];
  rewriteTasks: RewriteTaskRow[];
  rewriteChecks: RewriteCheckRow[];
};

const baseDate = new Date('2026-05-06T08:00:00.000Z');
const tableNames = new Map<object, TableName>([
  [errorPatterns, 'errorPatterns'],
  [corrections, 'corrections'],
  [rewriteTasks, 'rewriteTasks'],
  [rewriteChecks, 'rewriteChecks'],
]);

describe('learning-assets pattern merge', () => {
  it('merges a duplicate source into a target without rewriting historical corrections', () => {
    const database = new FakeLearningAssetsDatabase();
    database.seedPattern({
      id: 'pattern_target',
      patternKey: 'tense:completed_actions',
      category: 'tense',
      rule: 'Use past tense for completed actions.',
      canonicalExample: 'Yesterday I went home.',
      count: 1,
      firstSeenDateKey: '2026-05-01',
      lastSeenDateKey: '2026-05-02',
      recentExamplesJson: JSON.stringify(['I go home -> I went home']),
      fingerprintJson: null,
    });
    database.seedPattern({
      id: 'pattern_source',
      patternKey: 'tense:past_events',
      category: 'tense',
      rule: 'Choose past tense for finished events.',
      canonicalExample: 'Last week I visit Beijing -> Last week I visited Beijing',
      count: 2,
      firstSeenDateKey: '2026-04-29',
      lastSeenDateKey: '2026-05-05',
      recentExamplesJson: JSON.stringify([
        'Last week I visit Beijing -> Last week I visited Beijing',
        'I go home -> I went home',
      ]),
      fingerprintJson: JSON.stringify({
        patternType: 'grammar',
        learnerError: 'uses present tense for completed past events',
        targetCorrection: 'use past tense for completed past events',
        abstractRule: 'Use past tense when an event is finished in the past.',
        positiveExamples: ['Last week I visited Beijing.'],
        negativeExample: 'Last week I visit Beijing.',
        transferBoundary: 'Completed past events need past-tense verbs.',
        forbiddenLeakageTerms: ['visited'],
      }),
    });
    database.seedCorrectEvidence('pattern_source');

    const result = mergeErrorPatterns(
      { sourcePatternId: 'pattern_source', targetPatternId: 'pattern_target' },
      database.asAppDatabase(),
    );

    expect(result.success).toBe(true);
    const target = database.getPattern('pattern_target');
    const source = database.getPattern('pattern_source');
    const correction = database.getCorrection('correction_source');
    const listedPatterns = listErrorPatterns(database.asAppDatabase());
    const activeReviewPatterns = selectActiveReviewPatterns(database.asAppDatabase());

    expect(target).toMatchObject({
      count: 3,
      firstSeenDateKey: '2026-04-29',
      lastSeenDateKey: '2026-05-05',
    });
    expect(target.fingerprintJson).toBe(source.fingerprintJson);
    expect(parseExamples(target)).toEqual([
      'I go home -> I went home',
      'Last week I visit Beijing -> Last week I visited Beijing',
    ]);
    expect(source.active).toBe(false);
    expect(source.mergedIntoPatternId).toBe('pattern_target');
    expect(source.mergedAt?.getTime()).toBeGreaterThan(0);
    expect(correction.patternId).toBe('pattern_source');
    expect(listedPatterns).toHaveLength(1);
    expect(listedPatterns[0]?.id).toBe('pattern_target');
    expect(listedPatterns[0]?.evidence?.stage).toBe('repaired_once');
    expect(listedPatterns[0]?.lifecycle.status).toBe('ready_for_transfer');
    expect(activeReviewPatterns.map((pattern) => pattern.id)).toEqual(['pattern_target']);
  });

  it('rolls merged source transfer context into the target pattern lifecycle', () => {
    const database = new FakeLearningAssetsDatabase();
    database.seedPattern({
      id: 'pattern_target',
      patternKey: 'tense:completed_actions',
      category: 'tense',
      rule: 'Use past tense for completed actions.',
      canonicalExample: 'Yesterday I went home.',
      count: 1,
      firstSeenDateKey: '2026-05-01',
      lastSeenDateKey: '2026-05-02',
      recentExamplesJson: JSON.stringify(['I go home -> I went home']),
      fingerprintJson: null,
    });
    database.seedPattern({
      id: 'pattern_source',
      patternKey: 'tense:past_events',
      category: 'tense',
      rule: 'Choose past tense for finished events.',
      canonicalExample: 'Last week I visit Beijing -> Last week I visited Beijing',
      count: 1,
      firstSeenDateKey: '2026-05-03',
      lastSeenDateKey: '2026-05-04',
      recentExamplesJson: JSON.stringify(['Last week I visit Beijing -> Last week I visited Beijing']),
      fingerprintJson: null,
    });
    database.seedTransferEvidence('pattern_source');

    const result = mergeErrorPatterns(
      { sourcePatternId: 'pattern_source', targetPatternId: 'pattern_target' },
      database.asAppDatabase(),
    );
    const listedPatterns = listErrorPatterns(database.asAppDatabase());

    expect(result.success).toBe(true);
    expect(listedPatterns).toHaveLength(1);
    expect(listedPatterns[0]?.id).toBe('pattern_target');
    expect(listedPatterns[0]?.evidence).toMatchObject({
      stage: 'transferred_once',
      latestTransfer: {
        rewriteTaskId: 'rewrite_transfer_d3',
        spacedStage: 'D+3',
        latestCheck: {
          outcome: 'correct',
        },
      },
    });
    expect(listedPatterns[0]?.lifecycle.status).toBe('stabilizing');
  });

  it('rejects cross-category merges without mutating either pattern', () => {
    const database = new FakeLearningAssetsDatabase();
    database.seedPattern({
      id: 'pattern_tense',
      patternKey: 'tense:completed_actions',
      category: 'tense',
      rule: 'Use past tense for completed actions.',
      canonicalExample: 'Yesterday I went home.',
      count: 1,
      firstSeenDateKey: '2026-05-01',
      lastSeenDateKey: '2026-05-02',
      recentExamplesJson: JSON.stringify(['I go home -> I went home']),
      fingerprintJson: null,
    });
    database.seedPattern({
      id: 'pattern_article',
      patternKey: 'article:specific_nouns',
      category: 'article',
      rule: 'Use the before a specific noun.',
      canonicalExample: 'I saw movie -> I saw the movie',
      count: 1,
      firstSeenDateKey: '2026-05-01',
      lastSeenDateKey: '2026-05-01',
      recentExamplesJson: JSON.stringify(['I saw movie -> I saw the movie']),
      fingerprintJson: null,
    });

    const result = mergeErrorPatterns(
      { sourcePatternId: 'pattern_article', targetPatternId: 'pattern_tense' },
      database.asAppDatabase(),
    );

    expect(result).toEqual({ success: false, error: 'Only patterns in the same category can be merged.' });
    expect(database.getPattern('pattern_article')).toMatchObject({
      active: true,
      mergedIntoPatternId: null,
      count: 1,
    });
    expect(database.getPattern('pattern_tense')).toMatchObject({
      active: true,
      mergedIntoPatternId: null,
      count: 1,
    });
  });
});

class FakeLearningAssetsDatabase {
  private store: RowStore = {
    errorPatterns: [],
    corrections: [],
    rewriteTasks: [],
    rewriteChecks: [],
  };

  asAppDatabase(): AppDatabase {
    return this as unknown as AppDatabase;
  }

  transaction<T>(callback: (tx: this) => T): T {
    const snapshot = cloneStore(this.store);
    try {
      return callback(this);
    } catch (error) {
      this.store = snapshot;
      throw error;
    }
  }

  select(): {
    from: (table: unknown) => SelectFromResult;
  } {
    return {
      from: (table: unknown) => this.selectFrom(tableName(table)),
    };
  }

  update(table: unknown): {
    set: (values: Partial<ErrorPatternRow>) => {
      where: (condition: unknown) => {
        returning: () => { all: () => ErrorPatternRow[] };
        run: () => void;
      };
    };
  } {
    const name = tableName(table);
    return {
      set: (values) => ({
        where: (condition) => {
          const patternId = firstStringInCondition(condition);
          const runUpdate = (): ErrorPatternRow[] => {
            if (name !== 'errorPatterns' || !patternId) {
              return [];
            }

            const pattern = this.store.errorPatterns.find((candidate) => candidate.id === patternId);
            if (!pattern) {
              return [];
            }

            Object.assign(pattern, values);
            return [pattern];
          };

          return {
            returning: () => ({ all: runUpdate }),
            run: () => {
              runUpdate();
            },
          };
        },
      }),
    };
  }

  seedPattern(
    overrides: Pick<
      ErrorPatternRow,
      | 'id'
      | 'patternKey'
      | 'category'
      | 'rule'
      | 'canonicalExample'
      | 'count'
      | 'firstSeenDateKey'
      | 'lastSeenDateKey'
      | 'recentExamplesJson'
      | 'fingerprintJson'
    >,
  ): void {
    this.store.errorPatterns.push({
      ...overrides,
      active: true,
      mergedIntoPatternId: null,
      mergedAt: null,
      createdAt: baseDate,
      updatedAt: baseDate,
    });
  }

  seedCorrectEvidence(patternId: string): void {
    this.store.corrections.push({
      id: 'correction_source',
      reviewRunId: 'review_source',
      patternId,
      pattern: 'Choose past tense for finished events.',
      originalText: 'Last week I visit Beijing',
      correctedText: 'Last week I visited Beijing',
      explanation: 'The event is finished.',
      category: 'fix',
      status: 'suggested',
      startOffset: 0,
      endOffset: 25,
    });
    this.store.rewriteTasks.push({
      id: 'rewrite_source',
      reviewRunId: 'review_source',
      originalSentence: 'Last week I visit Beijing',
      focusPattern: 'Choose past tense for finished events.',
      nativeModelSentence: 'Last week I visited Beijing.',
      prompt: 'Rewrite the sentence with past tense.',
      promptContractJson: null,
      kind: 'rewrite_original',
      spacedStage: 'D+1',
      status: 'completed',
      userRewriteText: 'Last week I visited Beijing.',
      dueAt: baseDate,
      completedAt: baseDate,
      skippedAt: null,
      createdAt: baseDate,
    });
    this.store.rewriteChecks.push({
      id: 'rewrite_check_source',
      rewriteTaskId: 'rewrite_source',
      status: 'completed',
      outcome: 'correct',
      feedback: 'Correct.',
      provider: 'test',
      model: 'test',
      validationErrorsJson: null,
      errorMessage: null,
      diagnosticsJson: null,
      createdAt: baseDate,
      updatedAt: baseDate,
      completedAt: baseDate,
    });
  }

  seedTransferEvidence(patternId: string): void {
    const transferDate = new Date(baseDate.getTime() + 3 * 60_000);
    this.store.corrections.push({
      id: 'correction_transfer',
      reviewRunId: 'review_transfer',
      patternId,
      pattern: 'Choose past tense for finished events.',
      originalText: 'Last week I visit Beijing',
      correctedText: 'Last week I visited Beijing',
      explanation: 'The event is finished.',
      category: 'fix',
      status: 'suggested',
      startOffset: 0,
      endOffset: 25,
    });
    this.store.rewriteTasks.push(
      {
        id: 'rewrite_transfer_d1',
        reviewRunId: 'review_transfer',
        originalSentence: 'Last week I visit Beijing',
        focusPattern: 'Choose past tense for finished events.',
        nativeModelSentence: 'Last week I visited Beijing.',
        prompt: 'Rewrite the sentence with past tense.',
        promptContractJson: null,
        kind: 'rewrite_original',
        spacedStage: 'D+1',
        status: 'completed',
        userRewriteText: 'Last week I visited Beijing.',
        dueAt: baseDate,
        completedAt: baseDate,
        skippedAt: null,
        createdAt: baseDate,
      },
      {
        id: 'rewrite_transfer_d3',
        reviewRunId: 'review_transfer',
        originalSentence: 'Write a new sentence about a finished event.',
        focusPattern: 'Choose past tense for finished events.',
        nativeModelSentence: '',
        prompt: 'Write one sentence about a finished event last week.',
        promptContractJson: null,
        kind: 'new_context_reuse',
        spacedStage: 'D+3',
        status: 'completed',
        userRewriteText: 'Last week I visited Beijing.',
        dueAt: transferDate,
        completedAt: transferDate,
        skippedAt: null,
        createdAt: transferDate,
      },
    );
    this.store.rewriteChecks.push(
      {
        id: 'rewrite_check_transfer_d1',
        rewriteTaskId: 'rewrite_transfer_d1',
        status: 'completed',
        outcome: 'correct',
        feedback: 'Correct.',
        provider: 'test',
        model: 'test',
        validationErrorsJson: null,
        errorMessage: null,
        diagnosticsJson: null,
        createdAt: baseDate,
        updatedAt: baseDate,
        completedAt: baseDate,
      },
      {
        id: 'rewrite_check_transfer_d3',
        rewriteTaskId: 'rewrite_transfer_d3',
        status: 'completed',
        outcome: 'correct',
        feedback: 'Correct.',
        provider: 'test',
        model: 'test',
        validationErrorsJson: null,
        errorMessage: null,
        diagnosticsJson: null,
        createdAt: transferDate,
        updatedAt: transferDate,
        completedAt: transferDate,
      },
    );
  }

  getPattern(patternId: string): ErrorPatternRow {
    const pattern = this.store.errorPatterns.find((candidate) => candidate.id === patternId);
    if (!pattern) {
      throw new Error(`Pattern not found: ${patternId}`);
    }

    return pattern;
  }

  getCorrection(correctionId: string): CorrectionRow {
    const correction = this.store.corrections.find((candidate) => candidate.id === correctionId);
    if (!correction) {
      throw new Error(`Correction not found: ${correctionId}`);
    }

    return correction;
  }

  private selectFrom(table: TableName): SelectFromResult {
    if (table === 'corrections') {
      return {
        innerJoin: () => ({
          leftJoin: () => ({
            where: (condition: unknown) => ({
              all: () => this.selectEvidenceRows(stringsInCondition(condition)),
            }),
          }),
        }),
      };
    }

    const selectedRows = (): StoredRow[] => {
      if (table === 'errorPatterns') {
        return [...this.store.errorPatterns];
      }
      if (table === 'rewriteTasks') {
        return [...this.store.rewriteTasks];
      }
      return [...this.store.rewriteChecks];
    };

    const applyAllCondition = (condition: unknown): StoredRow[] => {
      if (table !== 'errorPatterns') {
        return selectedRows();
      }

      const strings = stringsInCondition(condition);
      if (strings.length === 0) {
        return this.store.errorPatterns.filter((pattern) => pattern.active && !pattern.mergedIntoPatternId);
      }

      return this.store.errorPatterns.filter(
        (pattern) => pattern.mergedIntoPatternId !== null && strings.includes(pattern.mergedIntoPatternId),
      );
    };

    const applyGetCondition = (condition: unknown): StoredRow | undefined => {
      if (table !== 'errorPatterns') {
        return selectedRows()[0];
      }

      const patternId = firstStringInCondition(condition);
      return this.store.errorPatterns.find((pattern) => pattern.id === patternId);
    };

    const sortedRows = (rows: StoredRow[]): StoredRow[] => {
      if (table !== 'errorPatterns') {
        return rows;
      }

      return [...(rows as ErrorPatternRow[])].sort((left, right) => {
        if (right.count !== left.count) {
          return right.count - left.count;
        }
        return right.updatedAt.getTime() - left.updatedAt.getTime();
      });
    };

    return {
      where: (condition: unknown) => {
        const rows = applyAllCondition(condition);
        const singleRow = applyGetCondition(condition);
        return {
          get: () => singleRow,
          all: () => rows,
          orderBy: () => ({
            limit: (limit: number) => ({
              all: () => sortedRows(rows).slice(0, limit),
            }),
            all: () => sortedRows(rows),
          }),
        };
      },
      orderBy: () => ({
        all: () => sortedRows(selectedRows()),
      }),
      get: () => selectedRows()[0],
      all: () => selectedRows(),
    };
  }

  private selectEvidenceRows(patternIds: string[]): PatternEvidenceQueryRow[] {
    return this.store.corrections.flatMap((correction) => {
      if (!correction.patternId || !patternIds.includes(correction.patternId) || correction.category !== 'fix') {
        return [];
      }

      const linkedTasks = this.store.rewriteTasks.filter((task) => task.reviewRunId === correction.reviewRunId);
      return linkedTasks.flatMap((task) => {
        const linkedChecks = this.store.rewriteChecks.filter((check) => check.rewriteTaskId === task.id);
        if (linkedChecks.length === 0) {
          return [evidenceRowFor(correction, task, null)];
        }

        return linkedChecks.map((check) => evidenceRowFor(correction, task, check));
      });
    });
  }
}

type SelectFromResult = {
  where?: (condition: unknown) => {
    get?: () => StoredRow | undefined;
    all?: () => StoredRow[];
    orderBy?: () => {
      limit: (limit: number) => { all: () => StoredRow[] };
      all: () => StoredRow[];
    };
  };
  orderBy?: () => { all: () => StoredRow[] };
  get?: () => StoredRow | undefined;
  all?: () => StoredRow[];
  innerJoin?: (
    table: unknown,
    condition: unknown,
  ) => {
    leftJoin: (
      table: unknown,
      condition: unknown,
    ) => {
      where: (condition: unknown) => { all: () => PatternEvidenceQueryRow[] };
    };
  };
};

function evidenceRowFor(
  correction: CorrectionRow,
  task: RewriteTaskRow,
  check: RewriteCheckRow | null,
): PatternEvidenceQueryRow {
  return {
    patternId: correction.patternId,
    rewriteTaskId: task.id,
    practiceKind: task.kind,
    spacedStage: task.spacedStage,
    rewriteTaskStatus: task.status,
    dueAt: task.dueAt,
    completedAt: task.completedAt,
    taskCreatedAt: task.createdAt,
    checkId: check?.id ?? null,
    checkStatus: check?.status ?? null,
    checkOutcome: check?.outcome ?? null,
    checkCompletedAt: check?.completedAt ?? null,
    checkUpdatedAt: check?.updatedAt ?? null,
    checkCreatedAt: check?.createdAt ?? null,
  };
}

function tableName(table: unknown): TableName {
  const name = typeof table === 'object' && table !== null ? tableNames.get(table) : undefined;
  if (!name) {
    throw new Error('Unknown table');
  }

  return name;
}

function firstStringInCondition(condition: unknown): string | undefined {
  return stringsInCondition(condition)[0];
}

function stringsInCondition(condition: unknown): string[] {
  const values: string[] = [];
  collectStringValues(condition, values);
  return values;
}

function collectStringValues(value: unknown, values: string[]): void {
  if (typeof value === 'string') {
    values.push(value);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectStringValues(item, values));
    return;
  }

  if (typeof value !== 'object' || value === null) {
    return;
  }

  if (value.constructor?.name === 'Param' && 'value' in value) {
    collectStringValues((value as { value: unknown }).value, values);
    return;
  }

  if ('queryChunks' in value) {
    collectStringValues((value as { queryChunks: unknown }).queryChunks, values);
  }
}

function cloneStore(store: RowStore): RowStore {
  return {
    errorPatterns: store.errorPatterns.map((row) => ({
      ...row,
      createdAt: cloneDate(row.createdAt),
      updatedAt: cloneDate(row.updatedAt),
      mergedAt: cloneNullableDate(row.mergedAt),
    })),
    corrections: store.corrections.map((row) => ({ ...row })),
    rewriteTasks: store.rewriteTasks.map((row) => ({
      ...row,
      dueAt: cloneNullableDate(row.dueAt),
      completedAt: cloneNullableDate(row.completedAt),
      skippedAt: cloneNullableDate(row.skippedAt),
      createdAt: cloneDate(row.createdAt),
    })),
    rewriteChecks: store.rewriteChecks.map((row) => ({
      ...row,
      createdAt: cloneDate(row.createdAt),
      updatedAt: cloneDate(row.updatedAt),
      completedAt: cloneNullableDate(row.completedAt),
    })),
  };
}

function cloneDate(value: Date): Date {
  return new Date(value.getTime());
}

function cloneNullableDate(value: Date | null): Date | null {
  return value ? cloneDate(value) : null;
}

function parseExamples(pattern: ErrorPatternRow): string[] {
  const parsed = JSON.parse(pattern.recentExamplesJson) as unknown;
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.filter((value): value is string => typeof value === 'string');
}
