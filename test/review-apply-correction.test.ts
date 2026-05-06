import { describe, expect, it, vi } from 'vitest';
import { learningEvents, reviewRuns, writingAttempts, writingRevisions } from '../src/main/db/schema';
import type {
  learningEvents as learningEventsTable,
  reviewRuns as reviewRunsTable,
  writingAttempts as writingAttemptsTable,
  writingRevisions as writingRevisionsTable,
} from '../src/main/db/schema';
import type { db as appDatabase } from '../src/main/db/client';
import type { applyReviewCorrection as applyReviewCorrectionFunction } from '../src/main/services/review/procedures/apply-correction';
import {
  applyReviewCorrectionInputSchema,
  applyReviewCorrectionOutputSchema,
  type PersistedPreviewOperationsSnapshot,
} from '../src/shared/types/review';
import type { WritingAttemptSnapshot } from '../src/shared/types/writing';
import { computeWritingContentHash } from '../src/shared/writing/content';
import { getWritingTemplate } from '../src/shared/writing/templates';

vi.mock('../src/main/db/client', () => ({
  db: {},
  getDatabasePath: () => ':memory:',
  sqlite: {},
}));

type AppDatabase = typeof appDatabase;
type WritingAttemptRow = typeof writingAttemptsTable.$inferSelect;
type WritingRevisionRow = typeof writingRevisionsTable.$inferSelect;
type ReviewRunRow = typeof reviewRunsTable.$inferSelect;
type LearningEventRow = typeof learningEventsTable.$inferSelect;
type StoredRow = WritingAttemptRow | WritingRevisionRow | ReviewRunRow | LearningEventRow;
type TableName = 'writingAttempts' | 'writingRevisions' | 'reviewRuns' | 'learningEvents';

type RowStore = {
  writingAttempts: WritingAttemptRow[];
  writingRevisions: WritingRevisionRow[];
  reviewRuns: ReviewRunRow[];
  learningEvents: LearningEventRow[];
};

const now = new Date('2026-05-06T09:00:00.000Z');
vi.setSystemTime(now);

const reviewedContent = 'Today I go home.';
const reviewedHash = computeWritingContentHash(reviewedContent);

const tableNames = new Map<object, TableName>([
  [writingAttempts, 'writingAttempts'],
  [writingRevisions, 'writingRevisions'],
  [reviewRuns, 'reviewRuns'],
  [learningEvents, 'learningEvents'],
]);

class FakeApplyCorrectionDatabase {
  private store: RowStore = emptyStore();

  transaction<T>(callback: (tx: FakeApplyCorrectionDatabase) => T): T {
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
      all: () => StoredRow[];
    };
  } {
    return {
      from: (table: unknown) => {
        const rows = this.rowsFor(tableName(table));
        return {
          where: (condition: unknown) => {
            const value = extractWhereStringValue(condition);
            const filtered = rows.filter((row) => rowHasStringValue(row, value));
            return {
              get: () => filtered[0],
              all: () => [...filtered],
            };
          },
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
          const updated = this.updateRow(tableName(table), extractWhereStringValue(condition), patch);
          return {
            run: () => undefined,
            returning: () => ({ get: () => updated }),
          };
        },
      }),
    };
  }

  seedSavedReview(
    options: {
      status?: ReviewRunRow['status'];
      operations?: PersistedPreviewOperationsSnapshot;
      activeContent?: string;
      activeRevisionId?: string;
      activeContentHash?: string;
    } = {},
  ): void {
    const activeContent = options.activeContent ?? reviewedContent;
    const activeRevisionId = options.activeRevisionId ?? 'revision_reviewed';
    const activeContentHash = options.activeContentHash ?? reviewedHash;
    this.store.writingAttempts.push({
      id: 'writing_1',
      dateKey: '2026-05-06',
      templateId: 'journal',
      generatedPromptJson: null,
      userGoal: null,
      activeRevisionId,
      lastReviewRunId: 'review_1',
      reviewedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    this.store.writingRevisions.push({
      id: activeRevisionId,
      writingAttemptId: 'writing_1',
      content: activeContent,
      contentHash: activeContentHash,
      createdAt: now,
    });
    this.store.reviewRuns.push({
      id: 'review_1',
      writingAttemptId: 'writing_1',
      writingRevisionId: 'revision_reviewed',
      contentHash: reviewedHash,
      status: options.status ?? 'review_saved',
      validationStatus: 'valid',
      provider: 'test-provider',
      model: 'test-model',
      inputSnapshotJson: null,
      rawOutputJson: null,
      parsedOutputJson: null,
      previewOperationsJson: JSON.stringify(options.operations ?? baseOperations()),
      validationErrorsJson: JSON.stringify([]),
      summaryJson: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  asAppDatabase(): AppDatabase {
    return this as unknown as AppDatabase;
  }

  writingAttempt(): WritingAttemptRow {
    const attempt = this.store.writingAttempts[0];
    if (!attempt) {
      throw new Error('Missing test writing attempt.');
    }
    return attempt;
  }

  activeRevision(): WritingRevisionRow {
    const attempt = this.writingAttempt();
    const revision = this.store.writingRevisions.find((row) => row.id === attempt.activeRevisionId);
    if (!revision) {
      throw new Error('Missing test active revision.');
    }
    return revision;
  }

  reviewRun(): ReviewRunRow {
    const run = this.store.reviewRuns[0];
    if (!run) {
      throw new Error('Missing test review run.');
    }
    return run;
  }

  revisions(): WritingRevisionRow[] {
    return [...this.store.writingRevisions];
  }

  learningEvents(): LearningEventRow[] {
    return [...this.store.learningEvents];
  }

  currentWritingSnapshot(): WritingAttemptSnapshot {
    const attempt = this.writingAttempt();
    const activeRevision = this.activeRevision();
    const staleReview = this.store.reviewRuns.find(
      (run) => run.writingAttemptId === attempt.id && run.status === 'stale',
    );
    return {
      attemptId: attempt.id,
      dateKey: attempt.dateKey,
      templateId: attempt.templateId,
      template: getWritingTemplate(attempt.templateId),
      generatedPrompt: null,
      userGoal: null,
      activeRevision: {
        id: activeRevision.id,
        writingAttemptId: activeRevision.writingAttemptId,
        content: activeRevision.content,
        contentHash: activeRevision.contentHash,
        createdAt: activeRevision.createdAt.getTime(),
      },
      lastAutosaveAt: activeRevision.createdAt.getTime(),
      lastReviewRunId: attempt.lastReviewRunId,
      staleReview: staleReview
        ? {
            id: staleReview.id,
            reviewedContentHash: staleReview.contentHash,
            createdAt: staleReview.createdAt.getTime(),
          }
        : null,
      pendingRewritePractice: null,
    };
  }

  private rowsFor(table: TableName): StoredRow[] {
    return this.store[table] as StoredRow[];
  }

  private insertRow(table: TableName, value: unknown): StoredRow {
    const row = toRecord(value);
    switch (table) {
      case 'writingRevisions': {
        const inserted = { ...row, createdAt: now } as WritingRevisionRow;
        this.store.writingRevisions.push(inserted);
        return inserted;
      }
      case 'learningEvents': {
        const inserted = { ...row, createdAt: now } as LearningEventRow;
        this.store.learningEvents.push(inserted);
        return inserted;
      }
      default:
        throw new Error(`Unsupported insert table: ${table}`);
    }
  }

  private updateRow(table: TableName, id: string, patch: unknown): StoredRow | undefined {
    const row = this.rowsFor(table).find((candidate) => 'id' in candidate && candidate.id === id);
    if (!row) {
      return undefined;
    }

    Object.assign(row, patch, table === 'writingAttempts' || table === 'reviewRuns' ? { updatedAt: now } : {});
    return row;
  }
}

describe('applyReviewCorrection', () => {
  it('parses the shared apply-correction input and output schemas', () => {
    const database = new FakeApplyCorrectionDatabase();
    database.seedSavedReview();
    const parsedInput = applyReviewCorrectionInputSchema.parse({
      reviewRunId: 'review_1',
      correctionIndex: 0,
      writingRevisionId: 'revision_reviewed',
    });

    expect(parsedInput).toMatchObject({ correctionIndex: 0 });
    expect(
      applyReviewCorrectionOutputSchema.parse({
        success: true,
        writing: database.currentWritingSnapshot(),
        reviewRun: reviewRunSnapshot(database.reviewRun()),
        appliedRevision: {
          id: 'revision_reviewed',
          writingAttemptId: 'writing_1',
          content: reviewedContent,
          contentHash: reviewedHash,
          createdAt: now.getTime(),
        },
      }),
    ).toMatchObject({ success: true });
    expect(applyReviewCorrectionOutputSchema.parse({ success: false, error: 'Nope.' })).toEqual({
      success: false,
      error: 'Nope.',
    });
  });

  it('creates a user-approved writing revision, stales the review, clears current pointers, and logs a compact event', async () => {
    const database = new FakeApplyCorrectionDatabase();
    database.seedSavedReview();
    const applyReviewCorrection = await loadApplyReviewCorrection();

    const result = applyReviewCorrection(
      {
        reviewRunId: 'review_1',
        correctionIndex: 0,
        writingRevisionId: 'revision_reviewed',
      },
      { database: database.asAppDatabase(), getWritingAttemptSnapshot: () => database.currentWritingSnapshot() },
    );

    expect(result.success).toBe(true);
    if (result.success !== true) {
      throw new Error('Expected correction apply to succeed.');
    }
    expect(result.appliedRevision.content).toBe('Today I went home.');
    expect(result.writing.activeRevision?.id).toBe(result.appliedRevision.id);
    expect(result.writing.lastReviewRunId).toBeNull();
    expect(result.writing.staleReview).toMatchObject({ id: 'review_1', reviewedContentHash: reviewedHash });
    expect(database.writingAttempt()).toMatchObject({
      activeRevisionId: result.appliedRevision.id,
      lastReviewRunId: null,
      reviewedAt: null,
    });
    expect(database.reviewRun().status).toBe('stale');
    expect(database.revisions()).toHaveLength(2);
    expect(database.learningEvents()).toHaveLength(1);
    expect(database.learningEvents()[0]).toMatchObject({
      eventType: 'correction_applied',
      reviewRunId: 'review_1',
      dedupeKey: `correction_applied:review_1:0:revision_reviewed`,
    });
    expect(JSON.parse(database.learningEvents()[0].payloadJson)).toEqual({
      correctionIndex: 0,
      previousContentHash: reviewedHash,
      nextContentHash: result.appliedRevision.contentHash,
      appliedRevisionId: result.appliedRevision.id,
    });
    expect(database.learningEvents()[0].payloadJson).not.toContain('I went home');
    expect(database.learningEvents()[0].payloadJson).not.toContain(reviewedContent);
  });

  it('requires the review to be saved before applying', async () => {
    const database = new FakeApplyCorrectionDatabase();
    database.seedSavedReview({ status: 'review_ready' });
    const applyReviewCorrection = await loadApplyReviewCorrection();

    const result = applyReviewCorrection(
      { reviewRunId: 'review_1', correctionIndex: 0, writingRevisionId: 'revision_reviewed' },
      { database: database.asAppDatabase(), getWritingAttemptSnapshot: () => database.currentWritingSnapshot() },
    );

    expect(result).toEqual({ success: false, error: 'Save this review before applying a correction.' });
    expect(database.revisions()).toHaveLength(1);
    expect(database.learningEvents()).toHaveLength(0);
  });

  it('rejects stale active draft revisions', async () => {
    const database = new FakeApplyCorrectionDatabase();
    database.seedSavedReview({
      activeRevisionId: 'revision_current',
      activeContent: 'Today I went home already.',
      activeContentHash: computeWritingContentHash('Today I went home already.'),
    });
    const applyReviewCorrection = await loadApplyReviewCorrection();

    const result = applyReviewCorrection(
      { reviewRunId: 'review_1', correctionIndex: 0, writingRevisionId: 'revision_reviewed' },
      { database: database.asAppDatabase(), getWritingAttemptSnapshot: () => database.currentWritingSnapshot() },
    );

    expect(result).toEqual({
      success: false,
      error: 'This draft changed before the correction could be applied. Review the current draft first.',
    });
    expect(database.revisions()).toHaveLength(1);
    expect(database.reviewRun().status).toBe('review_saved');
  });

  it('rejects when the approved revision id no longer matches the active draft', async () => {
    const database = new FakeApplyCorrectionDatabase();
    database.seedSavedReview();
    const applyReviewCorrection = await loadApplyReviewCorrection();

    const result = applyReviewCorrection(
      { reviewRunId: 'review_1', correctionIndex: 0, writingRevisionId: 'revision_not_active' },
      { database: database.asAppDatabase(), getWritingAttemptSnapshot: () => database.currentWritingSnapshot() },
    );

    expect(result).toEqual({
      success: false,
      error: 'This draft changed before the correction could be applied. Review the current draft first.',
    });
    expect(database.revisions()).toHaveLength(1);
    expect(database.learningEvents()).toHaveLength(0);
  });

  it('rejects saved corrections that are not the review focus correction', async () => {
    const database = new FakeApplyCorrectionDatabase();
    database.seedSavedReview({
      operations: baseOperations({
        corrections: [
          baseOperations().corrections[0],
          {
            ...baseOperations().corrections[0],
            correctionIndex: 1,
            originalText: 'home',
            correctedText: 'back home',
            explanation: 'A secondary suggestion should not be applyable in this flow.',
            startOffset: 11,
            endOffset: 15,
          },
        ],
      }),
    });
    const applyReviewCorrection = await loadApplyReviewCorrection();

    const result = applyReviewCorrection(
      { reviewRunId: 'review_1', correctionIndex: 1, writingRevisionId: 'revision_reviewed' },
      { database: database.asAppDatabase(), getWritingAttemptSnapshot: () => database.currentWritingSnapshot() },
    );

    expect(result).toEqual({
      success: false,
      error: 'Only the saved focus correction can be applied to the draft.',
    });
    expect(database.revisions()).toHaveLength(1);
    expect(database.learningEvents()).toHaveLength(0);
  });

  it('rejects unknown saved correction indexes', async () => {
    const database = new FakeApplyCorrectionDatabase();
    database.seedSavedReview();
    const applyReviewCorrection = await loadApplyReviewCorrection();

    const result = applyReviewCorrection(
      { reviewRunId: 'review_1', correctionIndex: 99, writingRevisionId: 'revision_reviewed' },
      { database: database.asAppDatabase(), getWritingAttemptSnapshot: () => database.currentWritingSnapshot() },
    );

    expect(result).toEqual({ success: false, error: 'Saved correction was not found.' });
    expect(database.revisions()).toHaveLength(1);
    expect(database.learningEvents()).toHaveLength(0);
  });

  it('rejects low-confidence or unanchored corrections', async () => {
    const database = new FakeApplyCorrectionDatabase();
    database.seedSavedReview({
      operations: baseOperations({
        corrections: [
          {
            ...baseOperations().corrections[0],
            status: 'low_confidence',
            confidence: 'low',
            startOffset: null,
            endOffset: null,
          },
        ],
      }),
    });
    const applyReviewCorrection = await loadApplyReviewCorrection();

    const result = applyReviewCorrection(
      { reviewRunId: 'review_1', correctionIndex: 0, writingRevisionId: 'revision_reviewed' },
      { database: database.asAppDatabase(), getWritingAttemptSnapshot: () => database.currentWritingSnapshot() },
    );

    expect(result).toEqual({
      success: false,
      error: 'This correction cannot be applied because it is not safely anchored.',
    });
    expect(database.revisions()).toHaveLength(1);
  });

  it('rejects anchor text mismatches without creating another revision', async () => {
    const database = new FakeApplyCorrectionDatabase();
    database.seedSavedReview({
      operations: baseOperations({
        corrections: [
          {
            ...baseOperations().corrections[0],
            originalText: 'I come home',
          },
        ],
      }),
    });
    const applyReviewCorrection = await loadApplyReviewCorrection();

    const result = applyReviewCorrection(
      { reviewRunId: 'review_1', correctionIndex: 0, writingRevisionId: 'revision_reviewed' },
      { database: database.asAppDatabase(), getWritingAttemptSnapshot: () => database.currentWritingSnapshot() },
    );

    expect(result).toEqual({ success: false, error: 'The draft text no longer matches this saved correction.' });
    expect(database.revisions()).toHaveLength(1);
    expect(database.learningEvents()).toHaveLength(0);
  });

  it('does not apply the same saved correction twice', async () => {
    const database = new FakeApplyCorrectionDatabase();
    database.seedSavedReview();
    const applyReviewCorrection = await loadApplyReviewCorrection();

    const firstResult = applyReviewCorrection(
      { reviewRunId: 'review_1', correctionIndex: 0, writingRevisionId: 'revision_reviewed' },
      { database: database.asAppDatabase(), getWritingAttemptSnapshot: () => database.currentWritingSnapshot() },
    );
    const secondResult = applyReviewCorrection(
      { reviewRunId: 'review_1', correctionIndex: 0, writingRevisionId: 'revision_reviewed' },
      { database: database.asAppDatabase(), getWritingAttemptSnapshot: () => database.currentWritingSnapshot() },
    );

    expect(firstResult.success).toBe(true);
    expect(secondResult).toEqual({ success: false, error: 'Review current draft before applying this correction.' });
    expect(database.revisions()).toHaveLength(2);
    expect(database.learningEvents()).toHaveLength(1);
  });
});

async function loadApplyReviewCorrection(): Promise<typeof applyReviewCorrectionFunction> {
  const module = await import('../src/main/services/review/procedures/apply-correction');
  return module.applyReviewCorrection;
}

function baseOperations(
  overrides: Partial<PersistedPreviewOperationsSnapshot> = {},
): PersistedPreviewOperationsSnapshot {
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
        contentHash: reviewedHash,
        matchedPatternId: null,
        newPatternSuggestion: {
          category: 'tense',
          rule: 'Use past tense for completed actions.',
          canonicalExample: 'I go home -> I went home',
        },
      },
    ],
    patternOperations: [],
    referenceRewrites: [],
    selfRepair: {
      correctionIndex: 0,
      prompt: 'Rewrite the sentence in past tense.',
      hint: 'Use the past form of the verb.',
      updatesLongTermStats: false,
    },
    rewritePractice: [],
    upgradeOpportunities: [],
    inputBridge: null,
    ...overrides,
  };
}

function reviewRunSnapshot(run: ReviewRunRow): {
  id: string;
  writingAttemptId: string;
  writingRevisionId: string | null;
  contentHash: string;
  status: ReviewRunRow['status'];
  validationStatus: ReviewRunRow['validationStatus'];
  provider: string;
  model: string;
  validationErrors: string[];
  summary: null;
  createdAt: number;
  updatedAt: number;
} {
  return {
    id: run.id,
    writingAttemptId: run.writingAttemptId,
    writingRevisionId: run.writingRevisionId,
    contentHash: run.contentHash,
    status: run.status,
    validationStatus: run.validationStatus,
    provider: run.provider,
    model: run.model,
    validationErrors: [],
    summary: null,
    createdAt: run.createdAt.getTime(),
    updatedAt: run.updatedAt.getTime(),
  };
}

function emptyStore(): RowStore {
  return {
    writingAttempts: [],
    writingRevisions: [],
    reviewRuns: [],
    learningEvents: [],
  };
}

function cloneStore(store: RowStore): RowStore {
  return {
    writingAttempts: store.writingAttempts.map((row) => ({
      ...row,
      createdAt: cloneDate(row.createdAt),
      updatedAt: cloneDate(row.updatedAt),
      reviewedAt: cloneNullableDate(row.reviewedAt),
    })),
    writingRevisions: store.writingRevisions.map((row) => ({ ...row, createdAt: cloneDate(row.createdAt) })),
    reviewRuns: store.reviewRuns.map((row) => ({
      ...row,
      createdAt: cloneDate(row.createdAt),
      updatedAt: cloneDate(row.updatedAt),
    })),
    learningEvents: store.learningEvents.map((row) => ({
      ...row,
      occurredAt: cloneDate(row.occurredAt),
      createdAt: cloneDate(row.createdAt),
    })),
  };
}

function tableName(table: unknown): TableName {
  const name = typeof table === 'object' && table !== null ? tableNames.get(table) : undefined;
  if (!name) {
    throw new Error('Unknown table');
  }
  return name;
}

function extractWhereStringValue(condition: unknown): string {
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

function rowHasStringValue(row: StoredRow, value: string): boolean {
  return Object.values(row).some((item) => item === value);
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
