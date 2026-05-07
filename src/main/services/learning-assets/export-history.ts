import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { app, dialog, type OpenDialogOptions, type SaveDialogOptions } from 'electron';
import packageJson from '../../../../package.json';
import { db } from '../../db/client';
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
} from '../../db/schema';
import {
  countLearningHistoryTables,
  exportLearningHistoryInputSchema,
  LEARNING_HISTORY_FORMAT,
  LEARNING_HISTORY_FORMAT_VERSION,
  RESET_LEARNING_HISTORY_CONFIRMATION_TEXT,
  learningHistoryExportDocumentSchema,
  learningHistoryExportResultSchema,
  learningHistoryExportTablesSchema,
  previewLearningHistoryImportResultSchema,
  resetLearningHistoryInputSchema,
  resetLearningHistoryResultSchema,
  type ExportLearningHistoryInput,
  type LearningHistoryExportDocument,
  type LearningHistoryExportManifest,
  type LearningHistoryExportResult,
  type LearningHistoryExportTables,
  type PreviewLearningHistoryImportResult,
  type ResetLearningHistoryResult,
} from '../../../shared/types/learning-assets';

type LearningHistoryDatabase = Pick<typeof db, 'select'>;
type LearningHistoryDeleteTarget = typeof learningEvents | typeof writingAttempts | typeof errorPatterns;
type LearningHistoryDeleteExecutor = {
  delete(table: LearningHistoryDeleteTarget): { run(): void };
};
type LearningHistoryResetDatabase = LearningHistoryDatabase & {
  transaction<T>(callback: (tx: LearningHistoryDeleteExecutor) => T): T;
};

type LearningHistoryFileSystem = {
  writeFile(filePath: string, data: string, encoding: 'utf8'): Promise<void>;
  readFile(filePath: string, encoding: 'utf8'): Promise<string>;
  mkdir(directoryPath: string, options: { recursive: true }): Promise<void>;
};

type LearningHistoryDialog = {
  showSaveDialog(options: SaveDialogOptions): Promise<{ canceled: boolean; filePath?: string }>;
  showOpenDialog(options: OpenDialogOptions): Promise<{ canceled: boolean; filePaths: string[] }>;
};

type BuildLearningHistoryExportDocumentInput = {
  includeRawProviderOutput: boolean;
  exportedAt?: Date;
  appVersion?: string;
  database?: LearningHistoryDatabase;
  tables?: LearningHistoryExportTables;
};

type LearningHistoryDocumentBuilder = (input: BuildLearningHistoryExportDocumentInput) => LearningHistoryExportDocument;

type LearningHistoryExportDependencies = {
  database?: LearningHistoryDatabase;
  dialog?: LearningHistoryDialog;
  fileSystem?: LearningHistoryFileSystem;
  documentBuilder?: LearningHistoryDocumentBuilder;
  getUserDataPath?: () => string;
  now?: () => Date;
  appVersion?: string;
};

type LearningHistoryResetDependencies = Omit<LearningHistoryExportDependencies, 'database'> & {
  database?: LearningHistoryResetDatabase;
};

type ImportPreviewValidationResult =
  | {
      success: true;
      document: LearningHistoryExportDocument;
      manifest: LearningHistoryExportManifest;
    }
  | {
      success: false;
      error: string;
    };

const nodeFileSystem: LearningHistoryFileSystem = {
  async writeFile(filePath: string, data: string, encoding: 'utf8'): Promise<void> {
    await writeFile(filePath, data, encoding);
  },
  async readFile(filePath: string, encoding: 'utf8'): Promise<string> {
    return readFile(filePath, encoding);
  },
  async mkdir(directoryPath: string, options: { recursive: true }): Promise<void> {
    await mkdir(directoryPath, options);
  },
};

function dateToMillis(value: Date | null): number | null {
  return value ? value.getTime() : null;
}

function sortRowsById<T extends { id: string }>(rows: T[]): T[] {
  return [...rows].sort((left, right) => left.id.localeCompare(right.id));
}

export function computeLearningHistoryTablesChecksum(tables: LearningHistoryExportTables): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(tables)).digest('hex')}`;
}

function redactReviewRunsRawOutput(
  tables: LearningHistoryExportTables,
  includeRawProviderOutput: boolean,
): LearningHistoryExportTables {
  if (includeRawProviderOutput) {
    return tables;
  }

  return {
    ...tables,
    reviewRuns: tables.reviewRuns.map((reviewRun) => ({
      ...reviewRun,
      rawOutputJson: null,
    })),
  };
}

export function snapshotLearningHistoryTables(
  input: {
    includeRawProviderOutput?: boolean;
    database?: LearningHistoryDatabase;
  } = {},
): LearningHistoryExportTables {
  const database = input.database ?? db;
  const includeRawProviderOutput = input.includeRawProviderOutput === true;

  const tables: LearningHistoryExportTables = {
    writingAttempts: sortRowsById(
      database
        .select()
        .from(writingAttempts)
        .all()
        .map((row) => ({
          id: row.id,
          dateKey: row.dateKey,
          templateId: row.templateId,
          generatedPromptJson: row.generatedPromptJson,
          userGoal: row.userGoal,
          activeRevisionId: row.activeRevisionId,
          lastReviewRunId: row.lastReviewRunId,
          reviewedAt: dateToMillis(row.reviewedAt),
          createdAt: row.createdAt.getTime(),
          updatedAt: row.updatedAt.getTime(),
        })),
    ),
    writingRevisions: sortRowsById(
      database
        .select()
        .from(writingRevisions)
        .all()
        .map((row) => ({
          id: row.id,
          writingAttemptId: row.writingAttemptId,
          content: row.content,
          contentHash: row.contentHash,
          createdAt: row.createdAt.getTime(),
        })),
    ),
    reviewRuns: sortRowsById(
      database
        .select()
        .from(reviewRuns)
        .all()
        .map((row) => ({
          id: row.id,
          writingAttemptId: row.writingAttemptId,
          writingRevisionId: row.writingRevisionId,
          contentHash: row.contentHash,
          status: row.status,
          validationStatus: row.validationStatus,
          provider: row.provider,
          model: row.model,
          inputSnapshotJson: row.inputSnapshotJson,
          rawOutputJson: includeRawProviderOutput ? row.rawOutputJson : null,
          parsedOutputJson: row.parsedOutputJson,
          previewOperationsJson: row.previewOperationsJson,
          validationErrorsJson: row.validationErrorsJson,
          summaryJson: row.summaryJson,
          createdAt: row.createdAt.getTime(),
          updatedAt: row.updatedAt.getTime(),
        })),
    ),
    errorPatterns: sortRowsById(
      database
        .select()
        .from(errorPatterns)
        .all()
        .map((row) => ({
          id: row.id,
          patternKey: row.patternKey,
          category: row.category,
          rule: row.rule,
          canonicalExample: row.canonicalExample,
          count: row.count,
          firstSeenDateKey: row.firstSeenDateKey,
          lastSeenDateKey: row.lastSeenDateKey,
          recentExamplesJson: row.recentExamplesJson,
          fingerprintJson: row.fingerprintJson,
          mergedIntoPatternId: row.mergedIntoPatternId,
          mergedAt: dateToMillis(row.mergedAt),
          active: row.active,
          createdAt: row.createdAt.getTime(),
          updatedAt: row.updatedAt.getTime(),
        })),
    ),
    corrections: sortRowsById(
      database
        .select()
        .from(corrections)
        .all()
        .map((row) => ({
          id: row.id,
          reviewRunId: row.reviewRunId,
          patternId: row.patternId,
          pattern: row.pattern,
          originalText: row.originalText,
          correctedText: row.correctedText,
          explanation: row.explanation,
          category: row.category,
          status: row.status,
          startOffset: row.startOffset,
          endOffset: row.endOffset,
        })),
    ),
    notebookEntries: sortRowsById(
      database
        .select()
        .from(notebookEntries)
        .all()
        .map((row) => ({
          id: row.id,
          reviewRunId: row.reviewRunId,
          dateKey: row.dateKey,
          templateId: row.templateId,
          sourceText: row.sourceText,
          suggestedAlternativesJson: row.suggestedAlternativesJson,
          reason: row.reason,
          createdAt: row.createdAt.getTime(),
        })),
    ),
    selfRepairAttempts: sortRowsById(
      database
        .select()
        .from(selfRepairAttempts)
        .all()
        .map((row) => ({
          id: row.id,
          reviewRunId: row.reviewRunId,
          correctionId: row.correctionId,
          attemptText: row.attemptText,
          result: row.result,
          createdAt: row.createdAt.getTime(),
        })),
    ),
    referenceRewrites: sortRowsById(
      database
        .select()
        .from(referenceRewrites)
        .all()
        .map((row) => ({
          id: row.id,
          reviewRunId: row.reviewRunId,
          rewriteText: row.rewriteText,
          noticeTheGap: row.noticeTheGap,
          createdAt: row.createdAt.getTime(),
        })),
    ),
    rewriteTasks: sortRowsById(
      database
        .select()
        .from(rewriteTasks)
        .all()
        .map((row) => ({
          id: row.id,
          reviewRunId: row.reviewRunId,
          originalSentence: row.originalSentence,
          focusPattern: row.focusPattern,
          nativeModelSentence: row.nativeModelSentence,
          prompt: row.prompt,
          promptContractJson: row.promptContractJson,
          kind: row.kind,
          spacedStage: row.spacedStage,
          status: row.status,
          userRewriteText: row.userRewriteText,
          dueAt: dateToMillis(row.dueAt),
          completedAt: dateToMillis(row.completedAt),
          skippedAt: dateToMillis(row.skippedAt),
          createdAt: row.createdAt.getTime(),
        })),
    ),
    rewriteChecks: sortRowsById(
      database
        .select()
        .from(rewriteChecks)
        .all()
        .map((row) => ({
          id: row.id,
          rewriteTaskId: row.rewriteTaskId,
          status: row.status,
          outcome: row.outcome,
          feedback: row.feedback,
          provider: row.provider,
          model: row.model,
          validationErrorsJson: row.validationErrorsJson,
          errorMessage: row.errorMessage,
          diagnosticsJson: row.diagnosticsJson,
          createdAt: row.createdAt.getTime(),
          updatedAt: row.updatedAt.getTime(),
          completedAt: dateToMillis(row.completedAt),
        })),
    ),
    learningEvents: sortRowsById(
      database
        .select()
        .from(learningEvents)
        .all()
        .map((row) => ({
          id: row.id,
          eventType: row.eventType,
          occurredAt: row.occurredAt.getTime(),
          dedupeKey: row.dedupeKey,
          reviewRunId: row.reviewRunId,
          patternId: row.patternId,
          rewriteTaskId: row.rewriteTaskId,
          rewriteCheckId: row.rewriteCheckId,
          payloadJson: row.payloadJson,
          createdAt: row.createdAt.getTime(),
        })),
    ),
  };

  return learningHistoryExportTablesSchema.parse(tables);
}

export function buildLearningHistoryExportDocument(
  input: BuildLearningHistoryExportDocumentInput,
): LearningHistoryExportDocument {
  const includeRawProviderOutput = input.includeRawProviderOutput === true;
  const exportedAt = input.exportedAt ?? new Date();
  const exportedAtMs = exportedAt.getTime();
  const rawTables =
    input.tables ??
    snapshotLearningHistoryTables({
      database: input.database,
      includeRawProviderOutput,
    });
  const tables = redactReviewRunsRawOutput(rawTables, includeRawProviderOutput);
  const manifest: LearningHistoryExportManifest = {
    formatVersion: LEARNING_HISTORY_FORMAT_VERSION,
    exportedAt: exportedAtMs,
    includeRawProviderOutput,
    counts: countLearningHistoryTables(tables),
    tablesChecksum: computeLearningHistoryTablesChecksum(tables),
  };

  return learningHistoryExportDocumentSchema.parse({
    format: LEARNING_HISTORY_FORMAT,
    formatVersion: LEARNING_HISTORY_FORMAT_VERSION,
    appName: 'Inkline',
    appVersion: input.appVersion ?? packageJson.version,
    exportedAt: exportedAtMs,
    tables,
    manifest,
  });
}

export function serializeLearningHistoryExportDocument(document: LearningHistoryExportDocument): string {
  return `${JSON.stringify(learningHistoryExportDocumentSchema.parse(document), null, 2)}\n`;
}

export function validateLearningHistoryImportDocument(value: unknown): ImportPreviewValidationResult {
  const parseResult = learningHistoryExportDocumentSchema.safeParse(value);
  if (!parseResult.success) {
    return { success: false, error: 'Selected file is not a valid Inkline learning history export.' };
  }

  const document = parseResult.data;
  const expectedChecksum = computeLearningHistoryTablesChecksum(document.tables);
  if (document.manifest.tablesChecksum !== expectedChecksum) {
    return { success: false, error: 'Learning history export checksum does not match its table payload.' };
  }

  return {
    success: true,
    document,
    manifest: document.manifest,
  };
}

function parseInput(input: ExportLearningHistoryInput | undefined): Required<ExportLearningHistoryInput> {
  const parsedInput = exportLearningHistoryInputSchema.parse(input ?? {});
  return { includeRawProviderOutput: parsedInput.includeRawProviderOutput === true };
}

function formatBackupTimestamp(date: Date): string {
  const pad = (value: number, length = 2): string => String(value).padStart(length, '0');

  return [
    date.getUTCFullYear(),
    '-',
    pad(date.getUTCMonth() + 1),
    '-',
    pad(date.getUTCDate()),
    'T',
    pad(date.getUTCHours()),
    '-',
    pad(date.getUTCMinutes()),
    '-',
    pad(date.getUTCSeconds()),
    '-',
    pad(date.getUTCMilliseconds(), 3),
    'Z',
  ].join('');
}

function buildDefaultPath(exportedAt: Date): string {
  return `inkline-learning-history-${formatBackupTimestamp(exportedAt)}.json`;
}

function getDialog(dependencies: LearningHistoryExportDependencies): LearningHistoryDialog {
  return dependencies.dialog ?? dialog;
}

function getFileSystem(dependencies: LearningHistoryExportDependencies): LearningHistoryFileSystem {
  return dependencies.fileSystem ?? nodeFileSystem;
}

function getExportedAt(dependencies: LearningHistoryExportDependencies): Date {
  return dependencies.now?.() ?? new Date();
}

function buildDocument(
  input: Required<ExportLearningHistoryInput>,
  exportedAt: Date,
  dependencies: LearningHistoryExportDependencies,
): LearningHistoryExportDocument {
  const builder = dependencies.documentBuilder ?? buildLearningHistoryExportDocument;

  return builder({
    includeRawProviderOutput: input.includeRawProviderOutput,
    exportedAt,
    database: dependencies.database,
    appVersion: dependencies.appVersion,
  });
}

async function writeExportDocument(
  filePath: string,
  input: Required<ExportLearningHistoryInput>,
  exportedAt: Date,
  dependencies: LearningHistoryExportDependencies,
): Promise<LearningHistoryExportResult> {
  const fileSystem = getFileSystem(dependencies);
  const document = buildDocument(input, exportedAt, dependencies);
  const serialized = serializeLearningHistoryExportDocument(document);
  await fileSystem.writeFile(filePath, serialized, 'utf8');

  return learningHistoryExportResultSchema.parse({
    success: true,
    canceled: false,
    filePath,
    manifest: document.manifest,
    includeRawProviderOutput: input.includeRawProviderOutput,
    byteSize: Buffer.byteLength(serialized, 'utf8'),
  });
}

export async function exportLearningHistory(
  input?: ExportLearningHistoryInput,
  dependencies: LearningHistoryExportDependencies = {},
): Promise<LearningHistoryExportResult> {
  const parsedInput = parseInput(input);
  const exportedAt = getExportedAt(dependencies);

  try {
    const result = await getDialog(dependencies).showSaveDialog({
      title: 'Export learning history',
      defaultPath: buildDefaultPath(exportedAt),
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['createDirectory', 'showOverwriteConfirmation'],
    });

    if (result.canceled || !result.filePath) {
      return learningHistoryExportResultSchema.parse({ success: true, canceled: true });
    }

    return await writeExportDocument(result.filePath, parsedInput, exportedAt, dependencies);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to export learning history.';
    return learningHistoryExportResultSchema.parse({ success: false, error: message });
  }
}

export async function createLearningHistoryBackup(
  input?: ExportLearningHistoryInput,
  dependencies: LearningHistoryExportDependencies = {},
): Promise<LearningHistoryExportResult> {
  const parsedInput = parseInput(input);
  const exportedAt = getExportedAt(dependencies);
  const fileSystem = getFileSystem(dependencies);
  const getUserDataPath = dependencies.getUserDataPath ?? (() => app.getPath('userData'));

  try {
    const backupDirectory = path.join(getUserDataPath(), 'backups');
    await fileSystem.mkdir(backupDirectory, { recursive: true });
    const filePath = path.join(backupDirectory, buildDefaultPath(exportedAt));

    return await writeExportDocument(filePath, parsedInput, exportedAt, dependencies);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create learning history backup.';
    return learningHistoryExportResultSchema.parse({ success: false, error: message });
  }
}

function deleteResettableLearningHistoryRows(database: LearningHistoryResetDatabase): void {
  database.transaction((tx) => {
    tx.delete(learningEvents).run();
    tx.delete(writingAttempts).run();
    tx.delete(errorPatterns).run();
  });
}

export async function resetLearningHistory(
  input?: unknown,
  dependencies: LearningHistoryResetDependencies = {},
): Promise<ResetLearningHistoryResult> {
  const parseResult = resetLearningHistoryInputSchema.safeParse(input ?? {});
  if (!parseResult.success) {
    return resetLearningHistoryResultSchema.parse({
      success: false,
      error: `Type ${RESET_LEARNING_HISTORY_CONFIRMATION_TEXT} to reset local learning data.`,
    });
  }

  const parsedInput = parseResult.data;

  if (parsedInput.confirmationText !== RESET_LEARNING_HISTORY_CONFIRMATION_TEXT) {
    return resetLearningHistoryResultSchema.parse({
      success: false,
      error: `Type ${RESET_LEARNING_HISTORY_CONFIRMATION_TEXT} to reset local learning data.`,
    });
  }

  const includeRawProviderOutput = parsedInput.includeRawProviderOutput === true;
  const database = dependencies.database ?? db;
  const backupResult = await createLearningHistoryBackup(
    { includeRawProviderOutput },
    {
      ...dependencies,
      database,
    },
  );

  if (backupResult.success === false) {
    return resetLearningHistoryResultSchema.parse({
      success: false,
      error: backupResult.error,
    });
  }

  if (backupResult.canceled === true) {
    return resetLearningHistoryResultSchema.parse({
      success: false,
      error: 'Learning history backup was canceled before reset.',
    });
  }

  try {
    deleteResettableLearningHistoryRows(database);

    return resetLearningHistoryResultSchema.parse({
      success: true,
      backupFilePath: backupResult.filePath,
      backupManifest: backupResult.manifest,
      includeRawProviderOutput,
      resetCounts: backupResult.manifest.counts,
    });
  } catch {
    return resetLearningHistoryResultSchema.parse({
      success: false,
      error: 'Learning history backup was created, but reset failed.',
    });
  }
}

export async function previewLearningHistoryImport(
  dependencies: LearningHistoryExportDependencies = {},
): Promise<PreviewLearningHistoryImportResult> {
  try {
    const result = await getDialog(dependencies).showOpenDialog({
      title: 'Preview learning history import',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return previewLearningHistoryImportResultSchema.parse({ success: true, canceled: true });
    }

    const filePath = result.filePaths[0];
    if (!filePath) {
      return previewLearningHistoryImportResultSchema.parse({ success: true, canceled: true });
    }

    const raw = await getFileSystem(dependencies).readFile(filePath, 'utf8');
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw) as unknown;
    } catch {
      return previewLearningHistoryImportResultSchema.parse({
        success: false,
        error: 'Selected file is not valid JSON.',
      });
    }

    const validation = validateLearningHistoryImportDocument(parsedJson);
    if (validation.success === false) {
      return previewLearningHistoryImportResultSchema.parse(validation);
    }

    return previewLearningHistoryImportResultSchema.parse({
      success: true,
      canceled: false,
      filePath,
      manifest: validation.manifest,
      counts: validation.manifest.counts,
      formatVersion: validation.document.formatVersion,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to preview learning history import.';
    return previewLearningHistoryImportResultSchema.parse({ success: false, error: message });
  }
}
