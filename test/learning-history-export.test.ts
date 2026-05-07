import path from 'node:path';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  corrections,
  errorPatterns,
  learningEvents,
  notebookEntries,
  referenceRewrites,
  reviewRuns,
  rewriteChecks,
  rewriteTasks,
  selfRepairAttempts,
  writingAttempts,
  writingRevisions,
} from '../src/main/db/schema';
import {
  learningHistoryExportDocumentSchema,
  learningHistoryExportResultSchema,
  previewLearningHistoryImportResultSchema,
  resetLearningHistoryInputSchema,
  resetLearningHistoryResultSchema,
  type LearningHistoryExportDocument,
  type LearningHistoryExportTables,
} from '../src/shared/types/learning-assets';
import {
  buildLearningHistoryExportDocument,
  computeLearningHistoryTablesChecksum,
  createLearningHistoryBackup,
  exportLearningHistory,
  previewLearningHistoryImport,
  resetLearningHistory,
  serializeLearningHistoryExportDocument,
  snapshotLearningHistoryTables,
  validateLearningHistoryImportDocument,
} from '../src/main/services/learning-assets/export-history';
import { IPC_CHANNELS } from '../src/shared/constants/channels';

vi.mock('electron', () => ({
  app: {
    getPath(name: string): string {
      if (name !== 'userData') {
        throw new Error(`Unexpected Electron path lookup: ${name}`);
      }
      return '/tmp/inkline-user-data';
    },
  },
  dialog: {
    showSaveDialog: vi.fn(),
    showOpenDialog: vi.fn(),
  },
}));

vi.mock('../src/main/db/client', () => ({
  db: {
    select(): never {
      throw new Error('Default database should not be used in learning history export tests.');
    },
  },
  getDatabasePath: () => ':memory:',
  sqlite: {},
}));

const exportedAt = new Date('2026-05-06T09:10:11.123Z');
const rawProviderOutput = '{"secret":"raw-provider-output"}';
const rawProviderOutputMarker = 'raw-provider-output';

type SnapshotInput = NonNullable<Parameters<typeof snapshotLearningHistoryTables>[0]>;
type FakeWrite = { filePath: string; data: string; encoding: 'utf8' };
type FakeFileSystem = {
  writes: FakeWrite[];
  directories: string[];
  files: Map<string, string>;
  writeFile(filePath: string, data: string, encoding: 'utf8'): Promise<void>;
  readFile(filePath: string, encoding: 'utf8'): Promise<string>;
  mkdir(directoryPath: string, options: { recursive: true }): Promise<void>;
};

function makeEmptyTables(overrides: Partial<LearningHistoryExportTables> = {}): LearningHistoryExportTables {
  return {
    writingAttempts: [],
    writingRevisions: [],
    reviewRuns: [],
    errorPatterns: [],
    corrections: [],
    notebookEntries: [],
    selfRepairAttempts: [],
    referenceRewrites: [],
    rewriteTasks: [],
    rewriteChecks: [],
    learningEvents: [],
    ...overrides,
  };
}

function makeReviewRunRow(rawOutputJson: string | null): LearningHistoryExportTables['reviewRuns'][number] {
  return {
    id: 'review_1',
    writingAttemptId: 'attempt_1',
    writingRevisionId: 'revision_1',
    contentHash: 'hash_1',
    status: 'review_saved',
    validationStatus: 'valid',
    provider: 'openai-compatible',
    model: 'test-model',
    inputSnapshotJson: '{"writingContent":"User writing"}',
    rawOutputJson,
    parsedOutputJson: '{"summary":{}}',
    previewOperationsJson: '{"operations":[]}',
    validationErrorsJson: null,
    summaryJson: '{"providerDiagnostics":{"finishReason":"stop"}}',
    createdAt: exportedAt.getTime(),
    updatedAt: exportedAt.getTime(),
  };
}

function makeDocument(tables: LearningHistoryExportTables = makeEmptyTables()): LearningHistoryExportDocument {
  return buildLearningHistoryExportDocument({
    includeRawProviderOutput: false,
    exportedAt,
    appVersion: '0.1.6-test',
    tables,
  });
}

function makeFileSystem(files: Record<string, string> = {}): FakeFileSystem {
  const fileMap = new Map(Object.entries(files));
  return {
    writes: [],
    directories: [],
    files: fileMap,
    async writeFile(filePath: string, data: string, encoding: 'utf8'): Promise<void> {
      this.writes.push({ filePath, data, encoding });
      this.files.set(filePath, data);
    },
    async readFile(filePath: string, encoding: 'utf8'): Promise<string> {
      expect(encoding).toBe('utf8');
      const data = this.files.get(filePath);
      if (data === undefined) {
        throw new Error(`Missing fake file: ${filePath}`);
      }
      return data;
    },
    async mkdir(directoryPath: string, options: { recursive: true }): Promise<void> {
      expect(options).toEqual({ recursive: true });
      this.directories.push(directoryPath);
    },
  };
}

function makeFakeSnapshotRowsByTable(): Map<unknown, unknown[]> {
  const rowsByTable = new Map<unknown, unknown[]>([
    [
      writingAttempts,
      [
        {
          id: 'attempt_1',
          dateKey: '2026-05-06',
          templateId: 'journal',
          generatedPromptJson: null,
          userGoal: null,
          activeRevisionId: 'revision_1',
          lastReviewRunId: 'review_1',
          reviewedAt: exportedAt,
          createdAt: exportedAt,
          updatedAt: exportedAt,
        },
      ],
    ],
    [
      writingRevisions,
      [
        {
          id: 'revision_1',
          writingAttemptId: 'attempt_1',
          content: 'User writing',
          contentHash: 'hash_1',
          createdAt: exportedAt,
        },
      ],
    ],
    [
      reviewRuns,
      [
        {
          id: 'review_1',
          writingAttemptId: 'attempt_1',
          writingRevisionId: 'revision_1',
          contentHash: 'hash_1',
          status: 'review_saved',
          validationStatus: 'valid',
          provider: 'openai-compatible',
          model: 'test-model',
          inputSnapshotJson: '{"writingContent":"User writing"}',
          rawOutputJson: rawProviderOutput,
          parsedOutputJson: '{"summary":{}}',
          previewOperationsJson: '{"operations":[]}',
          validationErrorsJson: null,
          summaryJson: '{"providerDiagnostics":{"finishReason":"stop"}}',
          createdAt: exportedAt,
          updatedAt: exportedAt,
        },
      ],
    ],
    [
      errorPatterns,
      [
        {
          id: 'pattern_1',
          patternKey: 'tense:past',
          category: 'tense',
          rule: 'Use past tense for finished events.',
          canonicalExample: 'I went yesterday.',
          count: 1,
          firstSeenDateKey: '2026-05-06',
          lastSeenDateKey: '2026-05-06',
          recentExamplesJson: '["I go yesterday."]',
          fingerprintJson: null,
          mergedIntoPatternId: null,
          mergedAt: null,
          active: true,
          createdAt: exportedAt,
          updatedAt: exportedAt,
        },
      ],
    ],
    [
      corrections,
      [
        {
          id: 'correction_1',
          reviewRunId: 'review_1',
          patternId: 'pattern_1',
          pattern: 'Past tense',
          originalText: 'I go yesterday.',
          correctedText: 'I went yesterday.',
          explanation: 'Use past tense.',
          category: 'fix',
          status: 'kept',
          startOffset: 0,
          endOffset: 15,
        },
      ],
    ],
    [
      notebookEntries,
      [
        {
          id: 'notebook_1',
          reviewRunId: 'review_1',
          dateKey: '2026-05-06',
          templateId: 'journal',
          sourceText: 'very good',
          suggestedAlternativesJson: '["excellent"]',
          reason: 'More precise.',
          createdAt: exportedAt,
        },
      ],
    ],
    [
      selfRepairAttempts,
      [
        {
          id: 'self_repair_1',
          reviewRunId: 'review_1',
          correctionId: 'correction_1',
          attemptText: 'I went yesterday.',
          result: 'correct',
          createdAt: exportedAt,
        },
      ],
    ],
    [
      referenceRewrites,
      [
        {
          id: 'reference_rewrite_1',
          reviewRunId: 'review_1',
          rewriteText: 'I went yesterday.',
          noticeTheGap: 'Past tense changed.',
          createdAt: exportedAt,
        },
      ],
    ],
    [
      rewriteTasks,
      [
        {
          id: 'rewrite_task_1',
          reviewRunId: 'review_1',
          originalSentence: 'I go yesterday.',
          focusPattern: 'Past tense',
          nativeModelSentence: 'I went yesterday.',
          prompt: 'Rewrite with past tense.',
          promptContractJson: null,
          kind: 'rewrite_original',
          spacedStage: 'D+1',
          status: 'completed',
          userRewriteText: 'I went yesterday.',
          dueAt: exportedAt,
          completedAt: exportedAt,
          skippedAt: null,
          createdAt: exportedAt,
        },
      ],
    ],
    [
      rewriteChecks,
      [
        {
          id: 'rewrite_check_1',
          rewriteTaskId: 'rewrite_task_1',
          status: 'completed',
          outcome: 'correct',
          feedback: '{"message":"Good repair."}',
          provider: 'openai-compatible',
          model: 'test-model',
          validationErrorsJson: null,
          errorMessage: null,
          diagnosticsJson: '{"finishReason":"stop"}',
          createdAt: exportedAt,
          updatedAt: exportedAt,
          completedAt: exportedAt,
        },
      ],
    ],
    [
      learningEvents,
      [
        {
          id: 'learning_event_1',
          eventType: 'review_saved',
          occurredAt: exportedAt,
          dedupeKey: 'review_saved:review_1',
          reviewRunId: 'review_1',
          patternId: 'pattern_1',
          rewriteTaskId: 'rewrite_task_1',
          rewriteCheckId: 'rewrite_check_1',
          payloadJson: '{"status":"review_saved"}',
          createdAt: exportedAt,
        },
      ],
    ],
  ]);

  return rowsByTable;
}

function makeFakeSnapshotDatabase(): NonNullable<SnapshotInput['database']> {
  const rowsByTable = makeFakeSnapshotRowsByTable();

  return {
    select(): { from(table: unknown): { all(): unknown[] } } {
      return {
        from(table: unknown): { all(): unknown[] } {
          return {
            all(): unknown[] {
              return [...(rowsByTable.get(table) ?? [])];
            },
          };
        },
      };
    },
  } as unknown as NonNullable<SnapshotInput['database']>;
}

type ResetDependencies = NonNullable<Parameters<typeof resetLearningHistory>[1]>;
type ResetDatabase = NonNullable<ResetDependencies['database']>;
type LearningHistoryResetTableName =
  | 'writingAttempts'
  | 'writingRevisions'
  | 'reviewRuns'
  | 'errorPatterns'
  | 'corrections'
  | 'notebookEntries'
  | 'selfRepairAttempts'
  | 'referenceRewrites'
  | 'rewriteTasks'
  | 'rewriteChecks'
  | 'learningEvents';

const resetTableNames = new Map<unknown, LearningHistoryResetTableName>([
  [writingAttempts, 'writingAttempts'],
  [writingRevisions, 'writingRevisions'],
  [reviewRuns, 'reviewRuns'],
  [errorPatterns, 'errorPatterns'],
  [corrections, 'corrections'],
  [notebookEntries, 'notebookEntries'],
  [selfRepairAttempts, 'selfRepairAttempts'],
  [referenceRewrites, 'referenceRewrites'],
  [rewriteTasks, 'rewriteTasks'],
  [rewriteChecks, 'rewriteChecks'],
  [learningEvents, 'learningEvents'],
]);

class FakeResetLearningHistoryDatabase {
  public failOnDeleteTable: LearningHistoryResetTableName | null = null;
  public operations: string[] = [];
  private rowsByTable: Map<unknown, unknown[]>;

  constructor() {
    const snapshotRowsByTable = makeFakeSnapshotRowsByTable();
    this.rowsByTable = new Map(
      Array.from(resetTableNames.keys()).map((table) => [table, [...(snapshotRowsByTable.get(table) ?? [])]]),
    );
  }

  select(): { from: (table: unknown) => { all: () => unknown[] } } {
    return {
      from: (table: unknown) => ({
        all: () => [...this.rowsFor(table)],
      }),
    };
  }

  delete(table: unknown): { run: () => void } {
    return {
      run: () => {
        const tableName = resetTableName(table);
        if (this.failOnDeleteTable === tableName) {
          throw new Error(`Delete failed for ${tableName}`);
        }

        this.operations.push(`delete:${tableName}`);
        this.rowsByTable.set(table, []);

        if (tableName === 'writingAttempts') {
          this.clearCascadeFromWritingAttempts();
        }
      },
    };
  }

  transaction<T>(callback: (tx: FakeResetLearningHistoryDatabase) => T): T {
    const snapshot = this.cloneRowsByTable();
    try {
      return callback(this);
    } catch (error) {
      this.rowsByTable = snapshot;
      throw error;
    }
  }

  count(table: unknown): number {
    return this.rowsFor(table).length;
  }

  asResetDatabase(): ResetDatabase {
    return this as unknown as ResetDatabase;
  }

  private rowsFor(table: unknown): unknown[] {
    return this.rowsByTable.get(table) ?? [];
  }

  private cloneRowsByTable(): Map<unknown, unknown[]> {
    return new Map(Array.from(this.rowsByTable.entries()).map(([table, rows]) => [table, [...rows]]));
  }

  private clearCascadeFromWritingAttempts(): void {
    [
      writingRevisions,
      reviewRuns,
      corrections,
      notebookEntries,
      selfRepairAttempts,
      referenceRewrites,
      rewriteTasks,
      rewriteChecks,
    ].forEach((table) => this.rowsByTable.set(table, []));
  }
}

function resetTableName(table: unknown): LearningHistoryResetTableName {
  const tableName = resetTableNames.get(table);
  if (!tableName) {
    throw new Error('Unknown reset table.');
  }

  return tableName;
}

function expectSuccessfulExportResult(
  result: Awaited<ReturnType<typeof createLearningHistoryBackup>>,
): asserts result is Extract<
  Awaited<ReturnType<typeof createLearningHistoryBackup>>,
  { success: true; canceled: false }
> {
  if (result.success !== true || result.canceled !== false) {
    throw new Error(`Expected successful export result, received ${JSON.stringify(result)}`);
  }
}

describe('learning history export foundation', () => {
  it('snapshots every learning-history table with millisecond timestamps and default raw-output redaction', () => {
    const tables = snapshotLearningHistoryTables({ database: makeFakeSnapshotDatabase() });

    expect(Object.keys(tables)).toEqual([
      'writingAttempts',
      'writingRevisions',
      'reviewRuns',
      'errorPatterns',
      'corrections',
      'notebookEntries',
      'selfRepairAttempts',
      'referenceRewrites',
      'rewriteTasks',
      'rewriteChecks',
      'learningEvents',
    ]);
    expect(Object.values(tables).map((rows) => rows.length)).toEqual(Array.from({ length: 11 }, () => 1));
    expect(tables.writingAttempts[0]?.reviewedAt).toBe(exportedAt.getTime());
    expect(tables.reviewRuns[0]?.rawOutputJson).toBeNull();
  });

  it('builds a schema-valid export envelope with manifest counts and checksum', () => {
    const document = makeDocument(makeEmptyTables({ reviewRuns: [makeReviewRunRow(null)] }));

    expect(learningHistoryExportDocumentSchema.parse(document)).toEqual(document);
    expect(document.manifest.counts.reviewRuns).toBe(1);
    expect(document.manifest.tablesChecksum).toBe(computeLearningHistoryTablesChecksum(document.tables));
    expect(document.manifest.includeRawProviderOutput).toBe(false);
  });

  it('redacts review raw provider output by default and includes it only with explicit opt-in', () => {
    const tables = makeEmptyTables({ reviewRuns: [makeReviewRunRow(rawProviderOutput)] });
    const redactedDocument = buildLearningHistoryExportDocument({
      includeRawProviderOutput: false,
      exportedAt,
      appVersion: '0.1.6-test',
      tables,
    });
    const rawDocument = buildLearningHistoryExportDocument({
      includeRawProviderOutput: true,
      exportedAt,
      appVersion: '0.1.6-test',
      tables,
    });

    expect(redactedDocument.tables.reviewRuns[0]?.rawOutputJson).toBeNull();
    expect(serializeLearningHistoryExportDocument(redactedDocument)).not.toContain(rawProviderOutputMarker);
    expect(rawDocument.tables.reviewRuns[0]?.rawOutputJson).toBe(rawProviderOutput);
    expect(serializeLearningHistoryExportDocument(rawDocument)).toContain(rawProviderOutputMarker);
  });

  it('returns a non-error canceled result when the save dialog is canceled', async () => {
    const fileSystem = makeFileSystem();
    const result = await exportLearningHistory(undefined, {
      dialog: {
        async showSaveDialog() {
          return { canceled: true };
        },
        async showOpenDialog() {
          throw new Error('Open dialog should not be used.');
        },
      },
      fileSystem,
      now: () => exportedAt,
      documentBuilder: () => makeDocument(),
    });

    expect(result).toEqual({ success: true, canceled: true });
    expect(fileSystem.writes).toEqual([]);
  });

  it('creates backups under userData/backups with lexically sortable timestamped filenames', async () => {
    const fileSystem = makeFileSystem();
    const result = await createLearningHistoryBackup(undefined, {
      fileSystem,
      getUserDataPath: () => '/user/data/Inkline',
      now: () => exportedAt,
      documentBuilder: () => makeDocument(),
    });

    expectSuccessfulExportResult(result);
    expect(fileSystem.directories).toEqual([path.join('/user/data/Inkline', 'backups')]);
    expect(result.filePath).toBe(
      path.join('/user/data/Inkline', 'backups', 'inkline-learning-history-2026-05-06T09-10-11-123Z.json'),
    );
    expect(result.byteSize).toBeGreaterThan(0);
    expect(learningHistoryExportResultSchema.parse(result)).toEqual(result);
  });

  it('parses reset input while leaving incorrect confirmation as a safe service failure', async () => {
    const database = new FakeResetLearningHistoryDatabase();
    const fileSystem = makeFileSystem();

    expect(resetLearningHistoryInputSchema.parse({ confirmationText: 'RESET' })).toEqual({
      confirmationText: 'RESET',
    });

    const result = await resetLearningHistory(
      { confirmationText: 'reset', includeRawProviderOutput: true },
      {
        database: database.asResetDatabase(),
        fileSystem,
        getUserDataPath: () => '/user/data/Inkline',
        now: () => exportedAt,
      },
    );

    expect(result).toEqual({ success: false, error: 'Type RESET to reset local learning data.' });
    expect(fileSystem.writes).toEqual([]);
    expect(database.operations).toEqual([]);
    expect(database.count(writingAttempts)).toBe(1);
  });

  it('returns a safe reset failure for malformed input without backup or deletes', async () => {
    const database = new FakeResetLearningHistoryDatabase();
    const fileSystem = makeFileSystem();

    const result = await resetLearningHistory('RESET', {
      database: database.asResetDatabase(),
      fileSystem,
      getUserDataPath: () => '/user/data/Inkline',
      now: () => exportedAt,
    });

    expect(result).toEqual({ success: false, error: 'Type RESET to reset local learning data.' });
    expect(fileSystem.writes).toEqual([]);
    expect(database.operations).toEqual([]);
    expect(database.count(writingAttempts)).toBe(1);
  });

  it('creates a backup before resetting local learning-history rows', async () => {
    const database = new FakeResetLearningHistoryDatabase();
    const fileSystem = makeFileSystem();
    const originalWriteFile = fileSystem.writeFile.bind(fileSystem);
    fileSystem.writeFile = async (filePath: string, data: string, encoding: 'utf8'): Promise<void> => {
      database.operations.push('backup:write');
      await originalWriteFile(filePath, data, encoding);
    };

    const result = await resetLearningHistory(
      { confirmationText: 'RESET', includeRawProviderOutput: false },
      {
        database: database.asResetDatabase(),
        fileSystem,
        getUserDataPath: () => '/user/data/Inkline',
        now: () => exportedAt,
        appVersion: '0.1.6-test',
      },
    );

    if (result.success !== true) {
      throw new Error(`Expected reset success, received ${JSON.stringify(result)}`);
    }

    expect(resetLearningHistoryResultSchema.parse(result)).toEqual(result);
    expect(database.operations[0]).toBe('backup:write');
    expect(database.operations.slice(1)).toEqual([
      'delete:learningEvents',
      'delete:writingAttempts',
      'delete:errorPatterns',
    ]);
    expect(result.backupFilePath).toBe(
      path.join('/user/data/Inkline', 'backups', 'inkline-learning-history-2026-05-06T09-10-11-123Z.json'),
    );
    expect(Object.values(result.resetCounts)).toEqual(Array.from({ length: 11 }, () => 1));
    expect(database.count(writingAttempts)).toBe(0);
    expect(database.count(writingRevisions)).toBe(0);
    expect(database.count(reviewRuns)).toBe(0);
    expect(database.count(errorPatterns)).toBe(0);
    expect(database.count(learningEvents)).toBe(0);
    expect(JSON.stringify(result)).not.toContain('User writing');
    expect(JSON.stringify(result)).not.toContain(rawProviderOutputMarker);
  });

  it('does not delete rows when backup creation fails', async () => {
    const database = new FakeResetLearningHistoryDatabase();
    const fileSystem = makeFileSystem();
    fileSystem.writeFile = async (): Promise<void> => {
      throw new Error('Disk is full.');
    };

    const result = await resetLearningHistory(
      { confirmationText: 'RESET' },
      {
        database: database.asResetDatabase(),
        fileSystem,
        getUserDataPath: () => '/user/data/Inkline',
        now: () => exportedAt,
      },
    );

    expect(result).toEqual({ success: false, error: 'Disk is full.' });
    expect(database.operations).toEqual([]);
    expect(database.count(writingAttempts)).toBe(1);
    expect(database.count(errorPatterns)).toBe(1);
  });

  it('rolls back reset deletes if the destructive transaction fails after backup', async () => {
    const database = new FakeResetLearningHistoryDatabase();
    const fileSystem = makeFileSystem();
    database.failOnDeleteTable = 'writingAttempts';

    const result = await resetLearningHistory(
      { confirmationText: 'RESET' },
      {
        database: database.asResetDatabase(),
        fileSystem,
        getUserDataPath: () => '/user/data/Inkline',
        now: () => exportedAt,
      },
    );

    expect(result).toEqual({ success: false, error: 'Learning history backup was created, but reset failed.' });
    expect(fileSystem.writes).toHaveLength(1);
    expect(database.count(learningEvents)).toBe(1);
    expect(database.count(writingAttempts)).toBe(1);
    expect(database.count(errorPatterns)).toBe(1);
  });

  it('previews a selected export file without database access or mutation', async () => {
    const document = makeDocument(makeEmptyTables({ reviewRuns: [makeReviewRunRow(null)] }));
    const fileSystem = makeFileSystem({
      '/exports/learning-history.json': serializeLearningHistoryExportDocument(document),
    });
    const result = await previewLearningHistoryImport({
      dialog: {
        async showSaveDialog() {
          throw new Error('Save dialog should not be used.');
        },
        async showOpenDialog() {
          return { canceled: false, filePaths: ['/exports/learning-history.json'] };
        },
      },
      fileSystem,
    });

    expect(result).toEqual({
      success: true,
      canceled: false,
      filePath: '/exports/learning-history.json',
      manifest: document.manifest,
      counts: document.manifest.counts,
      formatVersion: document.formatVersion,
    });
    expect(previewLearningHistoryImportResultSchema.parse(result)).toEqual(result);
  });

  it('returns validation failures for invalid import preview files', async () => {
    const invalidJsonResult = await previewLearningHistoryImport({
      dialog: {
        async showSaveDialog() {
          throw new Error('Save dialog should not be used.');
        },
        async showOpenDialog() {
          return { canceled: false, filePaths: ['/exports/broken.json'] };
        },
      },
      fileSystem: makeFileSystem({ '/exports/broken.json': '{not-json' }),
    });
    const wrongFormatResult = await previewLearningHistoryImport({
      dialog: {
        async showSaveDialog() {
          throw new Error('Save dialog should not be used.');
        },
        async showOpenDialog() {
          return { canceled: false, filePaths: ['/exports/wrong-format.json'] };
        },
      },
      fileSystem: makeFileSystem({ '/exports/wrong-format.json': JSON.stringify({ format: 'other-app' }) }),
    });

    expect(invalidJsonResult).toEqual({ success: false, error: 'Selected file is not valid JSON.' });
    expect(wrongFormatResult.success).toBe(false);
  });

  it('rejects unsupported versions, invalid table shapes, and tampered import checksums', () => {
    const document = makeDocument(makeEmptyTables({ reviewRuns: [makeReviewRunRow(null)] }));

    const unsupportedVersion = {
      ...document,
      formatVersion: 2,
      manifest: {
        ...document.manifest,
        formatVersion: 2,
      },
    };
    const invalidTableShape = {
      ...document,
      tables: {
        ...document.tables,
        writingAttempts: {},
      },
    };
    const tamperedChecksum = {
      ...document,
      tables: {
        ...document.tables,
        reviewRuns: [{ ...document.tables.reviewRuns[0], model: 'tampered-model' }],
      },
    };

    expect(validateLearningHistoryImportDocument(unsupportedVersion).success).toBe(false);
    expect(validateLearningHistoryImportDocument(invalidTableShape).success).toBe(false);
    expect(validateLearningHistoryImportDocument(tamperedChecksum)).toEqual({
      success: false,
      error: 'Learning history export checksum does not match its table payload.',
    });
  });

  it('keeps learning-history file APIs on narrow IPC channels and away from credential stores', () => {
    const exportServiceSource = readFileSync('src/main/services/learning-assets/export-history.ts', 'utf8');
    const preloadSource = readFileSync('src/preload/index.ts', 'utf8');
    const rendererSource = readFileSync('src/renderer/App.tsx', 'utf8');

    expect(IPC_CHANNELS.LEARNING_ASSETS.EXPORT_LEARNING_HISTORY).toBe('learningAssets:exportLearningHistory');
    expect(IPC_CHANNELS.LEARNING_ASSETS.CREATE_LEARNING_HISTORY_BACKUP).toBe(
      'learningAssets:createLearningHistoryBackup',
    );
    expect(IPC_CHANNELS.LEARNING_ASSETS.PREVIEW_LEARNING_HISTORY_IMPORT).toBe(
      'learningAssets:previewLearningHistoryImport',
    );
    expect(IPC_CHANNELS.LEARNING_ASSETS.RESET_LEARNING_HISTORY).toBe('learningAssets:resetLearningHistory');
    expect(preloadSource).toContain('exportLearningHistory:');
    expect(preloadSource).toContain('createLearningHistoryBackup:');
    expect(preloadSource).toContain('previewLearningHistoryImport:');
    expect(preloadSource).toContain('resetLearningHistory:');
    expect(rendererSource).not.toContain('showOpenDialog');
    expect(rendererSource).not.toContain('showSaveDialog');
    expect(rendererSource).not.toContain('node:fs');
    expect(rendererSource).not.toContain('confirm(');
    expect(rendererSource).not.toContain('prompt(');
    expect(rendererSource).not.toContain('alert(');
    expect(exportServiceSource).not.toContain('../settings');
    expect(exportServiceSource).not.toContain('../credentials');
    expect(exportServiceSource).not.toContain('keytar');
    expect(exportServiceSource).not.toContain('electron-store');
  });
});
