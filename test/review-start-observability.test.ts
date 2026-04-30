import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { corrections, writingAttempts, writingRevisions, reviewRuns } from '../src/main/db/schema';
import type {
  corrections as correctionsTable,
  writingAttempts as writingAttemptsTable,
  writingRevisions as writingRevisionsTable,
  reviewRuns as reviewRunsTable,
} from '../src/main/db/schema';
import type { db as appDatabase } from '../src/main/db/client';
import type { startReview as startReviewFunction } from '../src/main/services/review/procedures/start';
import type { ReviewAgent } from '../src/main/services/review/types';
import type { ReviewProgressEvent, ReviewRunSummary } from '../src/shared/types/review';

type AppDatabase = typeof appDatabase;
type WritingAttemptRow = typeof writingAttemptsTable.$inferSelect;
type WritingRevisionRow = typeof writingRevisionsTable.$inferSelect;
type ReviewRunRow = typeof reviewRunsTable.$inferSelect;
type CorrectionRow = typeof correctionsTable.$inferSelect;

type TableName = 'writingAttempts' | 'writingRevisions' | 'reviewRuns' | 'corrections';
type StoredRow = WritingAttemptRow | WritingRevisionRow | ReviewRunRow | CorrectionRow;

type RowStore = {
  writingAttempts: WritingAttemptRow[];
  writingRevisions: WritingRevisionRow[];
  reviewRuns: ReviewRunRow[];
  corrections: CorrectionRow[];
};

const now = new Date('2026-04-29T12:00:00.000Z');
const tableNames = new Map<object, TableName>([
  [writingAttempts, 'writingAttempts'],
  [writingRevisions, 'writingRevisions'],
  [reviewRuns, 'reviewRuns'],
  [corrections, 'corrections'],
]);

class FakeStartReviewDatabase {
  private store: RowStore = emptyStore();

  reset(): void {
    this.store = emptyStore();
  }

  seedWriting(): void {
    this.store.writingAttempts.push({
      id: 'journal_1',
      dateKey: '2026-04-29',
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
      contentHash: contentHash('Today I go home.'),
      createdAt: now,
    });
  }

  replaceActiveRevision(content = 'Today I went home already.'): void {
    const revision: WritingRevisionRow = {
      id: 'revision_2',
      writingAttemptId: 'journal_1',
      content,
      contentHash: contentHash(content),
      createdAt: now,
    };
    this.store.writingRevisions.push(revision);
    const entry = this.store.writingAttempts.find((candidate) => candidate.id === revision.writingAttemptId);
    if (!entry) {
      throw new Error('Seeded writing attempt was not found.');
    }
    entry.activeRevisionId = revision.id;
    entry.updatedAt = now;
  }

  select(): {
    from: (table: unknown) => {
      where: (condition: unknown) => { get: () => StoredRow | undefined; all: () => StoredRow[] };
      orderBy: () => { all: () => StoredRow[] };
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
          orderBy: () => ({ all: () => [...rows].reverse() }),
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
        const inserted = this.insertRow(tableName(table), value);
        return { returning: () => ({ get: () => inserted }) };
      },
    };
  }

  update(table: unknown): {
    set: (patch: unknown) => {
      where: (condition: unknown) => { returning: () => { get: () => StoredRow | undefined } };
    };
  } {
    return {
      set: (patch: unknown) => ({
        where: (condition: unknown) => {
          const updated = this.updateRow(tableName(table), extractId(condition), patch);
          return { returning: () => ({ get: () => updated }) };
        },
      }),
    };
  }

  reviewRun(): ReviewRunRow | undefined {
    return this.store.reviewRuns[0];
  }

  asAppDatabase(): AppDatabase {
    return this as unknown as AppDatabase;
  }

  private rowsFor(table: TableName): StoredRow[] {
    return this.store[table] as StoredRow[];
  }

  private insertRow(table: TableName, value: unknown): StoredRow {
    if (table !== 'reviewRuns') {
      throw new Error(`Unsupported insert table: ${table}`);
    }

    const row = {
      validationStatus: null,
      inputSnapshotJson: null,
      rawOutputJson: null,
      parsedOutputJson: null,
      previewOperationsJson: null,
      validationErrorsJson: null,
      summaryJson: null,
      createdAt: now,
      updatedAt: now,
      ...toRecord(value),
    } as ReviewRunRow;
    this.store.reviewRuns.push(row);
    return row;
  }

  private updateRow(table: TableName, id: string, patch: unknown): StoredRow | undefined {
    const row = this.rowsFor(table).find((candidate) => candidate.id === id);
    if (!row) {
      return undefined;
    }

    Object.assign(row, patch, table === 'reviewRuns' || table === 'writingAttempts' ? { updatedAt: now } : {});
    return row;
  }
}

const database = new FakeStartReviewDatabase();

async function loadStartReview(): Promise<typeof startReviewFunction> {
  vi.doMock('../src/main/db/client', () => ({
    db: database.asAppDatabase(),
    getDatabasePath: () => ':memory:',
    sqlite: {},
  }));
  vi.doMock('../src/main/services/settings/service', () => ({
    getSettingsSnapshot: async () => ({
      provider: 'openai-compatible',
      baseUrl: 'https://provider.example/v1',
      model: 'review-model',
      providerApiKeyStatus: 'configured',
      rawResponseStorageEnabled: true,
    }),
  }));
  vi.doMock('../src/main/services/review/lib/disclosure', () => ({
    hasReviewDisclosureAcknowledgement: () => true,
  }));
  const module = await import('../src/main/services/review/procedures/start');
  return module.startReview;
}

function successfulAgent(): ReviewAgent {
  return async () => ({
    output: {
      corrections: [
        {
          originalText: 'I go home',
          correctedText: 'I went home',
          explanation: 'Use past tense for a completed action.',
          category: 'tense',
          confidence: 'high',
          anchor: { exact: 'I go home', prefix: 'Today ', suffix: '.', occurrenceIndex: 0 },
          matchedPatternId: null,
          newPatternSuggestion: {
            category: 'tense',
            rule: 'Use past tense for completed actions.',
            canonicalExample: 'Yesterday I went home.',
          },
        },
      ],
      summary: {
        focusPattern: { correctionIndex: 0, reason: 'This tense pattern is reusable.' },
        whatWentWell: ['You expressed the main event clearly.'],
      },
      selfRepairTask: {
        correctionIndex: 0,
        prompt: 'Rewrite the sentence in past tense.',
        hint: 'Use the past form of the verb.',
      },
      inputBridge: { correctionIndex: 0, examples: ['Yesterday I went home.'] },
      referenceRewrites: [{ text: 'Today I went home.', noticeTheGap: 'The verb changes to past tense.' }],
      rewriteTasks: [{ kind: 'rewrite_original', prompt: 'Rewrite the original sentence.', focusCorrectionIndexes: [0] }],
      upgradeOpportunities: [],
    },
    rawOutput: { ok: true },
  });
}

function emptyStore(): RowStore {
  return { writingAttempts: [], writingRevisions: [], reviewRuns: [], corrections: [] };
}

function contentHash(content: string): string {
  return createHash('sha256').update(content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')).digest('hex');
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

describe('startReview observability', () => {
  it('emits real progress events and persists a structured success summary', async () => {
    database.reset();
    database.seedWriting();
    const events: ReviewProgressEvent[] = [];
    const startReview = await loadStartReview();

    const result = await startReview(
      { writingAttemptId: 'journal_1', writingRevisionId: 'revision_1' },
      {
        agent: successfulAgent(),
        hasDisclosureAcknowledgement: () => true,
        settings: {
          provider: 'openai-compatible',
          baseUrl: 'https://provider.example/v1',
          model: 'review-model',
          providerApiKeyStatus: 'configured',
          rawResponseStorageEnabled: true,
        },
        onProgress: (event) => events.push(event),
      }
    );

    expect(result.success).toBe(true);
    expect(events.map((event) => `${event.phase}:${event.event}`)).toEqual([
      'preparing:started',
      'preparing:completed',
      'requesting:started',
      'requesting:completed',
      'waiting:started',
      'waiting:completed',
      'checking:started',
      'checking:completed',
      'building_preview:started',
      'building_preview:completed',
    ]);
    expect(new Set(events.map((event) => event.runId)).size).toBe(1);
    expect(result.reviewRun?.summary).toMatchObject({
      resultKind: 'ready',
      errorCategory: null,
      rawSaved: true,
      reviewStats: {
        anchoredCorrections: 1,
        lowConfidenceCorrections: 0,
        generatedRewriteTasks: 1,
        generatedSelfRepairAttempts: 1,
        generatedReferenceRewrites: 1,
      },
    });

    const persistedSummary = JSON.parse(database.reviewRun()?.summaryJson ?? 'null') as ReviewRunSummary;
    expect(persistedSummary.phaseTimings).toMatchObject({
      preparing: expect.any(Number),
      requesting: expect.any(Number),
      waiting: expect.any(Number),
      checking: expect.any(Number),
      building_preview: expect.any(Number),
    });
  });

  it('persists categorized failure metadata without raw output', async () => {
    database.reset();
    database.seedWriting();
    const events: ReviewProgressEvent[] = [];
    const startReview = await loadStartReview();

    const result = await startReview(
      { writingAttemptId: 'journal_1', writingRevisionId: 'revision_1' },
      {
        agent: async () => {
          throw new Error('Provider review request timed out.');
        },
        hasDisclosureAcknowledgement: () => true,
        settings: {
          provider: 'openai-compatible',
          baseUrl: 'https://provider.example/v1',
          model: 'review-model',
          providerApiKeyStatus: 'configured',
          rawResponseStorageEnabled: true,
        },
        onProgress: (event) => events.push(event),
      }
    );

    expect(result).toMatchObject({ success: false, error: 'AI service took too long. Try again in a moment.' });
    expect(events.at(-1)).toMatchObject({ phase: 'waiting', event: 'failed', errorCategory: 'timeout' });
    expect(result.reviewRun?.summary).toMatchObject({
      resultKind: 'failed',
      errorCategory: 'timeout',
      rawSaved: false,
      reviewStats: {
        anchoredCorrections: 0,
        lowConfidenceCorrections: 0,
        generatedRewriteTasks: 0,
        generatedSelfRepairAttempts: 0,
        generatedReferenceRewrites: 0,
      },
    });
    expect(database.reviewRun()?.rawOutputJson).toBeNull();
  });

  it('preserves actionable missing-key configuration errors from the selected provider', async () => {
    database.reset();
    database.seedWriting();
    const events: ReviewProgressEvent[] = [];
    const startReview = await loadStartReview();

    const result = await startReview(
      { writingAttemptId: 'journal_1', writingRevisionId: 'revision_1' },
      {
        agent: async () => {
          throw new Error('Anthropic Claude provider API key is not configured. Add it in Settings before continuing.');
        },
        hasDisclosureAcknowledgement: () => true,
        settings: {
          provider: 'Anthropic Claude',
          baseUrl: 'https://api.openai.com/v1',
          model: 'claude-sonnet-4-5',
          providerApiKeyStatus: 'not-configured',
          rawResponseStorageEnabled: false,
        },
        onProgress: (event) => events.push(event),
      }
    );

    expect(result).toMatchObject({
      success: false,
      error: 'Anthropic Claude provider API key is not configured. Add it in Settings before continuing.',
    });
    expect(events.at(-1)).toMatchObject({ phase: 'waiting', event: 'failed', errorCategory: 'missing_config' });
    expect(result.reviewRun?.summary).toMatchObject({
      resultKind: 'failed',
      errorCategory: 'missing_config',
      rawSaved: false,
    });
    expect(database.reviewRun()?.rawOutputJson).toBeNull();
  });

  it('marks completed reviews stale when the active revision changes while review is in flight', async () => {
    database.reset();
    database.seedWriting();
    const events: ReviewProgressEvent[] = [];
    const startReview = await loadStartReview();

    const result = await startReview(
      { writingAttemptId: 'journal_1', writingRevisionId: 'revision_1' },
      {
        agent: async (request) => {
          database.replaceActiveRevision();
          return successfulAgent()(request);
        },
        hasDisclosureAcknowledgement: () => true,
        settings: {
          provider: 'openai-compatible',
          baseUrl: 'https://provider.example/v1',
          model: 'review-model',
          providerApiKeyStatus: 'configured',
          rawResponseStorageEnabled: true,
        },
        onProgress: (event) => events.push(event),
      }
    );

    expect(result.success).toBe(true);
    expect(result.reviewRun).toMatchObject({ status: 'review_ready', validationStatus: 'valid' });
    expect(result.reviewRun?.summary).toMatchObject({
      resultKind: 'stale',
      errorCategory: 'stale_content',
      rawSaved: true,
      reviewStats: {
        anchoredCorrections: 1,
        lowConfidenceCorrections: 0,
        generatedRewriteTasks: 1,
        generatedSelfRepairAttempts: 1,
        generatedReferenceRewrites: 1,
      },
    });

    const persistedRun = database.reviewRun();
    const persistedSummary = JSON.parse(persistedRun?.summaryJson ?? 'null') as ReviewRunSummary;
    expect(persistedRun).toMatchObject({ status: 'review_ready', validationStatus: 'valid' });
    expect(persistedSummary).toMatchObject({ resultKind: 'stale', errorCategory: 'stale_content' });
    expect(persistedRun?.previewOperationsJson).toEqual(expect.any(String));
    expect(events.map((event) => `${event.phase}:${event.event}`)).toContain('building_preview:completed');
  });
});
