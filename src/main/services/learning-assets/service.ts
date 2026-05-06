import { randomUUID } from 'node:crypto';
import { and, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import { db } from '../../db/client';
import { corrections, errorPatterns, notebookEntries, rewriteChecks, rewriteTasks } from '../../db/schema';
import { arePatternRulesSimilar, normalizePatternKey } from '../../../shared/review-contract/patterns';
import type { ErrorPattern, PatternFingerprint } from '../../../shared/review-contract/schemas';
import type {
  PersistedPatternOperationSnapshot,
  PersistedPreviewOperationsSnapshot,
} from '../../../shared/types/review';
import {
  listErrorPatternsOutputSchema,
  listNotebookEntriesOutputSchema,
  mergeErrorPatternsInputSchema,
  mergeErrorPatternsResultSchema,
  type ErrorPatternSnapshot,
  type ListErrorPatternsOutput,
  type ListNotebookEntriesOutput,
  type MergeErrorPatternsResult,
  type NotebookEntrySnapshot,
  type PatternEvidenceCheckSummary,
  type PatternEvidenceRepairSummary,
  type PatternEvidenceStage,
  type PatternEvidenceSummary,
} from '../../../shared/types/learning-assets';
import type {
  RewriteCheckOutcome,
  RewriteCheckStatus,
  RewritePracticeStatus,
  WritingTemplateId,
} from '../../../shared/types/writing';

const RECENT_EXAMPLES_LIMIT = 5;
const LIST_LIMIT = 50;

type LearningAssetTx = Pick<typeof db, 'select' | 'insert' | 'update'>;
type LearningAssetDatabase = typeof db;
type ErrorPatternRow = typeof errorPatterns.$inferSelect;
type PatternMergeTargetMap = Map<string, string>;
type EvidenceRepairTask = {
  patternId: string;
  repair: PatternEvidenceRepairSummary;
  latestCompletedOutcome: RewriteCheckOutcome | null;
  latestCompletedRank: number | null;
  contextRank: number;
};
type EvidenceTransferTask = {
  patternId: string;
  stageOnCorrect: Extract<PatternEvidenceStage, 'transferred_once' | 'stable_after_spaced_reuse'>;
  latestCompletedOutcome: RewriteCheckOutcome | null;
  latestCompletedRank: number | null;
};
type RewriteTaskKind = 'rewrite_original' | 'new_context_reuse' | 'pattern_detection';

export type PatternEvidenceQueryRow = {
  patternId: string | null;
  rewriteTaskId: string;
  practiceKind: RewriteTaskKind;
  spacedStage: string;
  rewriteTaskStatus: RewritePracticeStatus;
  dueAt: Date | null;
  completedAt: Date | null;
  taskCreatedAt: Date;
  checkId: string | null;
  checkStatus: RewriteCheckStatus | null;
  checkOutcome: RewriteCheckOutcome | null;
  checkCompletedAt: Date | null;
  checkUpdatedAt: Date | null;
  checkCreatedAt: Date | null;
};

export type PersistedPatternLink = {
  patternId: string;
  rule: string;
};

class PatternMergeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PatternMergeValidationError';
  }
}

function createId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

function parseStringArray(value: string): string[] {
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function patternToSnapshot(pattern: ErrorPatternRow, evidence: PatternEvidenceSummary): ErrorPatternSnapshot {
  return {
    id: pattern.id,
    patternKey: pattern.patternKey,
    category: pattern.category,
    rule: pattern.rule,
    canonicalExample: pattern.canonicalExample,
    count: pattern.count,
    firstSeenDateKey: pattern.firstSeenDateKey,
    lastSeenDateKey: pattern.lastSeenDateKey,
    recentExamples: parseStringArray(pattern.recentExamplesJson),
    mergedIntoPatternId: pattern.mergedIntoPatternId,
    mergedAt: dateToMillis(pattern.mergedAt),
    active: pattern.active,
    createdAt: pattern.createdAt.getTime(),
    updatedAt: pattern.updatedAt.getTime(),
    evidence,
  };
}

function notebookEntryToSnapshot(entry: typeof notebookEntries.$inferSelect): NotebookEntrySnapshot {
  return {
    id: entry.id,
    reviewRunId: entry.reviewRunId,
    dateKey: entry.dateKey,
    templateId: entry.templateId,
    sourceText: entry.sourceText,
    suggestedAlternatives: parseStringArray(entry.suggestedAlternativesJson),
    reason: entry.reason,
    createdAt: entry.createdAt.getTime(),
  };
}

export function listErrorPatterns(database: LearningAssetDatabase = db): ListErrorPatternsOutput {
  const patternRows = database
    .select()
    .from(errorPatterns)
    .where(and(eq(errorPatterns.active, true), isNull(errorPatterns.mergedIntoPatternId)))
    .orderBy(desc(errorPatterns.count), desc(errorPatterns.updatedAt))
    .limit(LIST_LIMIT)
    .all();

  const patternIds = patternRows.map((pattern) => pattern.id);
  const mergeTargetBySourceId = selectPatternMergeTargetMap(database, patternIds);
  const evidencePatternIds = [...patternIds, ...mergeTargetBySourceId.keys()];
  const evidenceRows = selectPatternEvidenceRows(database, evidencePatternIds).map((row) => ({
    ...row,
    patternId: row.patternId ? (mergeTargetBySourceId.get(row.patternId) ?? row.patternId) : null,
  }));
  const evidenceByPatternId = derivePatternEvidenceSummaries(evidenceRows);
  const patterns = patternRows.map((pattern) =>
    patternToSnapshot(pattern, evidenceByPatternId.get(pattern.id) ?? defaultEvidenceSummary()),
  );

  return listErrorPatternsOutputSchema.parse(patterns);
}

function selectPatternMergeTargetMap(
  database: LearningAssetDatabase,
  targetPatternIds: string[],
): PatternMergeTargetMap {
  if (targetPatternIds.length === 0) {
    return new Map<string, string>();
  }

  const mergedRows = database
    .select({
      id: errorPatterns.id,
      mergedIntoPatternId: errorPatterns.mergedIntoPatternId,
    })
    .from(errorPatterns)
    .where(inArray(errorPatterns.mergedIntoPatternId, targetPatternIds))
    .all();

  return new Map(
    mergedRows.flatMap((pattern) =>
      pattern.mergedIntoPatternId ? [[pattern.id, pattern.mergedIntoPatternId] as const] : [],
    ),
  );
}

function selectPatternEvidenceRows(database: LearningAssetDatabase, patternIds: string[]): PatternEvidenceQueryRow[] {
  if (patternIds.length === 0) {
    return [];
  }

  return database
    .select({
      patternId: corrections.patternId,
      rewriteTaskId: rewriteTasks.id,
      practiceKind: rewriteTasks.kind,
      spacedStage: rewriteTasks.spacedStage,
      rewriteTaskStatus: rewriteTasks.status,
      dueAt: rewriteTasks.dueAt,
      completedAt: rewriteTasks.completedAt,
      taskCreatedAt: rewriteTasks.createdAt,
      checkId: rewriteChecks.id,
      checkStatus: rewriteChecks.status,
      checkOutcome: rewriteChecks.outcome,
      checkCompletedAt: rewriteChecks.completedAt,
      checkUpdatedAt: rewriteChecks.updatedAt,
      checkCreatedAt: rewriteChecks.createdAt,
    })
    .from(corrections)
    .innerJoin(rewriteTasks, eq(corrections.reviewRunId, rewriteTasks.reviewRunId))
    .leftJoin(rewriteChecks, eq(rewriteChecks.rewriteTaskId, rewriteTasks.id))
    .where(
      and(
        inArray(corrections.patternId, patternIds),
        eq(corrections.category, 'fix'),
        or(
          and(eq(rewriteTasks.kind, 'rewrite_original'), eq(rewriteTasks.spacedStage, 'D+1')),
          and(eq(rewriteTasks.kind, 'new_context_reuse'), eq(rewriteTasks.spacedStage, 'D+3')),
          and(eq(rewriteTasks.kind, 'new_context_reuse'), eq(rewriteTasks.spacedStage, 'D+7')),
        ),
      ),
    )
    .all();
}

export function derivePatternEvidenceSummaries(rows: PatternEvidenceQueryRow[]): Map<string, PatternEvidenceSummary> {
  const repairTasks = new Map<string, EvidenceRepairTask>();
  const transferTasks = new Map<string, EvidenceTransferTask>();

  rows.forEach((row) => {
    if (!row.patternId) {
      return;
    }

    const transferStage = transferStageForEvidenceRow(row);
    if (transferStage) {
      const taskKey = `${row.patternId}:${row.rewriteTaskId}`;
      const existingTask = transferTasks.get(taskKey);
      const task = existingTask ?? createEvidenceTransferTask(row.patternId, transferStage);
      const check = checkSummaryFromRow(row);

      if (check?.status === 'completed' && check.outcome !== null) {
        const completedRank = rowCompletedCheckRank(row);
        if (task.latestCompletedRank === null || completedRank > task.latestCompletedRank) {
          task.latestCompletedOutcome = check.outcome;
          task.latestCompletedRank = completedRank;
        }
      }

      transferTasks.set(taskKey, task);
      return;
    }

    if (!isD1RepairEvidenceRow(row)) {
      return;
    }

    const taskKey = `${row.patternId}:${row.rewriteTaskId}`;
    const existingTask = repairTasks.get(taskKey);
    const task = existingTask ?? createEvidenceRepairTask(row, row.patternId);
    const check = checkSummaryFromRow(row);

    if (check) {
      const currentCheckRank = task.repair.latestCheck ? checkContextRank(task.repair.latestCheck) : null;
      const rowCheckRank = rowCheckContextRank(row);
      if (currentCheckRank === null || rowCheckRank > currentCheckRank) {
        task.repair = { ...task.repair, latestCheck: check };
      }

      if (check.status === 'completed' && check.outcome !== null) {
        const completedRank = rowCompletedCheckRank(row);
        if (task.latestCompletedRank === null || completedRank > task.latestCompletedRank) {
          task.latestCompletedOutcome = check.outcome;
          task.latestCompletedRank = completedRank;
        }
      }
    }

    task.contextRank = Math.max(task.contextRank, repairContextRank(task.repair));
    repairTasks.set(taskKey, task);
  });

  const summaries = new Map<string, PatternEvidenceSummary>();
  repairTasks.forEach((task) => {
    const current = summaries.get(task.patternId) ?? defaultEvidenceSummary();
    const stage = strongestEvidenceStage(
      current.stage,
      task.latestCompletedOutcome === 'correct' ? 'repaired_once' : 'needs_repair',
    );
    const latestRepair =
      current.latestRepair && repairContextRank(current.latestRepair) >= task.contextRank
        ? current.latestRepair
        : task.repair;

    summaries.set(task.patternId, { stage, latestRepair });
  });
  transferTasks.forEach((task) => {
    const current = summaries.get(task.patternId) ?? defaultEvidenceSummary();
    const stage = strongestEvidenceStage(
      current.stage,
      task.latestCompletedOutcome === 'correct' ? task.stageOnCorrect : 'needs_repair',
    );
    summaries.set(task.patternId, { ...current, stage });
  });

  return summaries;
}

function isD1RepairEvidenceRow(row: PatternEvidenceQueryRow): boolean {
  return row.practiceKind === 'rewrite_original' && row.spacedStage === 'D+1';
}

function isD3TransferEvidenceRow(row: PatternEvidenceQueryRow): boolean {
  return row.practiceKind === 'new_context_reuse' && row.spacedStage === 'D+3';
}

function isD7StableEvidenceRow(row: PatternEvidenceQueryRow): boolean {
  return row.practiceKind === 'new_context_reuse' && row.spacedStage === 'D+7';
}

function transferStageForEvidenceRow(
  row: PatternEvidenceQueryRow,
): Extract<PatternEvidenceStage, 'transferred_once' | 'stable_after_spaced_reuse'> | null {
  if (isD3TransferEvidenceRow(row)) {
    return 'transferred_once';
  }

  if (isD7StableEvidenceRow(row)) {
    return 'stable_after_spaced_reuse';
  }

  return null;
}

function createEvidenceTransferTask(
  patternId: string,
  stageOnCorrect: Extract<PatternEvidenceStage, 'transferred_once' | 'stable_after_spaced_reuse'>,
): EvidenceTransferTask {
  return {
    patternId,
    stageOnCorrect,
    latestCompletedOutcome: null,
    latestCompletedRank: null,
  };
}

function createEvidenceRepairTask(row: PatternEvidenceQueryRow, patternId: string): EvidenceRepairTask {
  return {
    patternId,
    repair: {
      rewriteTaskId: row.rewriteTaskId,
      practiceKind: 'rewrite_original',
      spacedStage: 'D+1',
      status: row.rewriteTaskStatus,
      dueAt: dateToMillis(row.dueAt),
      completedAt: dateToMillis(row.completedAt),
      createdAt: row.taskCreatedAt.getTime(),
      latestCheck: null,
    },
    latestCompletedOutcome: null,
    latestCompletedRank: null,
    contextRank: taskContextRank(row),
  };
}

function checkSummaryFromRow(row: PatternEvidenceQueryRow): PatternEvidenceCheckSummary | null {
  if (!row.checkId || !row.checkStatus || !row.checkUpdatedAt) {
    return null;
  }

  return {
    id: row.checkId,
    status: row.checkStatus,
    outcome: row.checkStatus === 'completed' ? row.checkOutcome : null,
    completedAt: dateToMillis(row.checkCompletedAt),
    updatedAt: row.checkUpdatedAt.getTime(),
  };
}

function defaultEvidenceSummary(): PatternEvidenceSummary {
  return {
    stage: 'needs_repair',
    latestRepair: null,
  };
}

function strongestEvidenceStage(current: PatternEvidenceStage, next: PatternEvidenceStage): PatternEvidenceStage {
  if (current === 'stable_after_spaced_reuse' || next === 'stable_after_spaced_reuse') {
    return 'stable_after_spaced_reuse';
  }
  if (current === 'transferred_once' || next === 'transferred_once') {
    return 'transferred_once';
  }
  if (current === 'repaired_once' || next === 'repaired_once') {
    return 'repaired_once';
  }
  return 'needs_repair';
}

function repairContextRank(repair: PatternEvidenceRepairSummary): number {
  return Math.max(
    repair.latestCheck ? checkContextRank(repair.latestCheck) : 0,
    repair.completedAt ?? 0,
    repair.dueAt ?? 0,
    repair.createdAt,
  );
}

function checkContextRank(check: PatternEvidenceCheckSummary): number {
  return Math.max(check.completedAt ?? 0, check.updatedAt);
}

function taskContextRank(row: PatternEvidenceQueryRow): number {
  return Math.max(dateToMillis(row.completedAt) ?? 0, dateToMillis(row.dueAt) ?? 0, row.taskCreatedAt.getTime());
}

function rowCheckContextRank(row: PatternEvidenceQueryRow): number {
  return Math.max(
    dateToMillis(row.checkCompletedAt) ?? 0,
    dateToMillis(row.checkUpdatedAt) ?? 0,
    dateToMillis(row.checkCreatedAt) ?? 0,
  );
}

function rowCompletedCheckRank(row: PatternEvidenceQueryRow): number {
  return Math.max(
    dateToMillis(row.checkCompletedAt) ?? 0,
    dateToMillis(row.checkUpdatedAt) ?? 0,
    dateToMillis(row.checkCreatedAt) ?? 0,
  );
}

function dateToMillis(value: Date | null): number | null {
  return value ? value.getTime() : null;
}

export function listNotebookEntries(): ListNotebookEntriesOutput {
  const entries = db
    .select()
    .from(notebookEntries)
    .orderBy(desc(notebookEntries.createdAt))
    .limit(LIST_LIMIT)
    .all()
    .map(notebookEntryToSnapshot);

  return listNotebookEntriesOutputSchema.parse(entries);
}

export function mergeErrorPatterns(input: unknown, database: LearningAssetDatabase = db): MergeErrorPatternsResult {
  const parseResult = mergeErrorPatternsInputSchema.safeParse(input);
  if (!parseResult.success) {
    return { success: false, error: parseResult.error.issues[0]?.message ?? 'Invalid pattern merge request.' };
  }

  try {
    const updatedTarget = database.transaction((tx) => {
      const sourcePattern = tx
        .select()
        .from(errorPatterns)
        .where(eq(errorPatterns.id, parseResult.data.sourcePatternId))
        .get();
      const targetPattern = tx
        .select()
        .from(errorPatterns)
        .where(eq(errorPatterns.id, parseResult.data.targetPatternId))
        .get();

      const validMerge = validatePatternMerge(sourcePattern, targetPattern);

      const now = new Date();
      const [mergedTarget] = tx
        .update(errorPatterns)
        .set({
          count: validMerge.targetPattern.count + validMerge.sourcePattern.count,
          firstSeenDateKey: minDateKey(
            validMerge.targetPattern.firstSeenDateKey,
            validMerge.sourcePattern.firstSeenDateKey,
          ),
          lastSeenDateKey: maxDateKey(
            validMerge.targetPattern.lastSeenDateKey,
            validMerge.sourcePattern.lastSeenDateKey,
          ),
          recentExamplesJson: JSON.stringify(mergeRecentExamples(validMerge.targetPattern, validMerge.sourcePattern)),
          fingerprintJson: validMerge.targetPattern.fingerprintJson ?? validMerge.sourcePattern.fingerprintJson,
          updatedAt: now,
        })
        .where(eq(errorPatterns.id, validMerge.targetPattern.id))
        .returning()
        .all();

      if (!mergedTarget) {
        throw new Error('Merged target pattern was not returned.');
      }

      tx.update(errorPatterns)
        .set({
          active: false,
          mergedIntoPatternId: validMerge.targetPattern.id,
          mergedAt: now,
          updatedAt: now,
        })
        .where(eq(errorPatterns.id, validMerge.sourcePattern.id))
        .run();

      return mergedTarget;
    });

    const targetPattern = getErrorPatternSnapshot(database, updatedTarget.id);
    return mergeErrorPatternsResultSchema.parse({ success: true, targetPattern });
  } catch (error) {
    if (error instanceof PatternMergeValidationError) {
      return { success: false, error: error.message };
    }

    return { success: false, error: 'Failed to merge error patterns.' };
  }
}

function validatePatternMerge(
  sourcePattern: ErrorPatternRow | undefined,
  targetPattern: ErrorPatternRow | undefined,
): { sourcePattern: ErrorPatternRow; targetPattern: ErrorPatternRow } {
  if (!sourcePattern) {
    throw new PatternMergeValidationError('Source pattern was not found.');
  }

  if (!targetPattern) {
    throw new PatternMergeValidationError('Target pattern was not found.');
  }

  if (!sourcePattern.active || sourcePattern.mergedIntoPatternId) {
    throw new PatternMergeValidationError('Source pattern is already merged or inactive.');
  }

  if (!targetPattern.active || targetPattern.mergedIntoPatternId) {
    throw new PatternMergeValidationError('Target pattern is already merged or inactive.');
  }

  if (sourcePattern.category !== targetPattern.category) {
    throw new PatternMergeValidationError('Only patterns in the same category can be merged.');
  }

  return { sourcePattern, targetPattern };
}

function mergeRecentExamples(targetPattern: ErrorPatternRow, sourcePattern: ErrorPatternRow): string[] {
  return [...parseStringArray(targetPattern.recentExamplesJson), ...parseStringArray(sourcePattern.recentExamplesJson)]
    .filter((example, index, examples) => examples.indexOf(example) === index)
    .slice(0, RECENT_EXAMPLES_LIMIT);
}

function minDateKey(left: string, right: string): string {
  return left <= right ? left : right;
}

function maxDateKey(left: string, right: string): string {
  return left >= right ? left : right;
}

function getErrorPatternSnapshot(database: LearningAssetDatabase, patternId: string): ErrorPatternSnapshot {
  const pattern = database.select().from(errorPatterns).where(eq(errorPatterns.id, patternId)).get();
  if (!pattern) {
    throw new Error(`Error pattern was not found: ${patternId}`);
  }

  const mergeTargetBySourceId = selectPatternMergeTargetMap(database, [pattern.id]);
  const evidencePatternIds = [pattern.id, ...mergeTargetBySourceId.keys()];
  const evidenceRows = selectPatternEvidenceRows(database, evidencePatternIds).map((row) => ({
    ...row,
    patternId: row.patternId ? (mergeTargetBySourceId.get(row.patternId) ?? row.patternId) : null,
  }));
  const evidenceByPatternId = derivePatternEvidenceSummaries(evidenceRows);

  return patternToSnapshot(pattern, evidenceByPatternId.get(pattern.id) ?? defaultEvidenceSummary());
}

export function selectActiveReviewPatterns(database: LearningAssetDatabase = db, limit = 30): ErrorPattern[] {
  return database
    .select()
    .from(errorPatterns)
    .orderBy(desc(errorPatterns.count), desc(errorPatterns.updatedAt))
    .all()
    .filter((pattern) => pattern.active && !pattern.mergedIntoPatternId && pattern.category !== 'spelling')
    .slice(0, limit)
    .map((pattern) => ({
      id: pattern.id,
      category: pattern.category,
      rule: pattern.rule,
      canonicalExample: pattern.canonicalExample,
      patternKey: pattern.patternKey,
      count: pattern.count,
      firstSeenDateKey: pattern.firstSeenDateKey,
      lastSeenDateKey: pattern.lastSeenDateKey,
      recentExamples: parseStringArray(pattern.recentExamplesJson),
      active: pattern.active,
    }));
}

export function persistPatternOperations(params: {
  tx: LearningAssetTx;
  operations: PersistedPreviewOperationsSnapshot;
  reviewRunId: string;
  dateKey: string;
}): Map<number, PersistedPatternLink> {
  const links = new Map<number, PersistedPatternLink>();
  const focusCorrectionIndex = params.operations.selfRepair?.correctionIndex ?? null;

  params.operations.patternOperations.forEach((operation) => {
    const correction = params.operations.corrections.find(
      (candidate) => candidate.correctionIndex === operation.correctionIndex,
    );
    if (!correction || correction.status === 'low_confidence') {
      return;
    }

    const example = `${correction.originalText} -> ${correction.correctedText}`;
    const fingerprint = operation.correctionIndex === focusCorrectionIndex ? operation.fingerprint : undefined;
    const pattern = persistOnePatternOperation(params.tx, operation, params.dateKey, example, fingerprint);
    links.set(operation.correctionIndex, { patternId: pattern.id, rule: pattern.rule });
  });

  return links;
}

export function persistNotebookEntries(params: {
  tx: LearningAssetTx;
  operations: PersistedPreviewOperationsSnapshot;
  reviewRunId: string;
  dateKey: string;
  templateId: WritingTemplateId;
}): void {
  params.operations.upgradeOpportunities.forEach((operation) => {
    params.tx
      .insert(notebookEntries)
      .values({
        id: createId('notebook'),
        reviewRunId: params.reviewRunId,
        dateKey: params.dateKey,
        templateId: params.templateId,
        sourceText: operation.sourceText,
        suggestedAlternativesJson: JSON.stringify(operation.suggestedAlternatives),
        reason: operation.reason,
      })
      .run();
  });
}

function persistOnePatternOperation(
  tx: LearningAssetTx,
  operation: PersistedPatternOperationSnapshot,
  dateKey: string,
  example: string,
  fingerprint: PatternFingerprint | undefined,
): ErrorPatternRow {
  if (operation.kind === 'reuse_pattern') {
    const pattern = tx.select().from(errorPatterns).where(eq(errorPatterns.id, operation.patternId)).get();
    if (!pattern) {
      throw new Error(`Matched error pattern was not found: ${operation.patternId}`);
    }

    return incrementPattern(tx, pattern, dateKey, example, fingerprint);
  }

  const existingPatternId = operation.duplicateOfPatternId;
  const existingPattern =
    (existingPatternId
      ? resolveWritablePattern(tx, tx.select().from(errorPatterns).where(eq(errorPatterns.id, existingPatternId)).get())
      : undefined) ?? findPatternForSuggestion(tx, operation);

  if (existingPattern) {
    return incrementPattern(tx, existingPattern, dateKey, example, fingerprint);
  }

  return tx
    .insert(errorPatterns)
    .values({
      id: createId('pattern'),
      patternKey: operation.patternKey || normalizePatternKey(operation.category, operation.rule),
      category: operation.category,
      rule: operation.rule,
      canonicalExample: operation.canonicalExample,
      count: 1,
      firstSeenDateKey: dateKey,
      lastSeenDateKey: dateKey,
      recentExamplesJson: JSON.stringify([example]),
      fingerprintJson: fingerprint ? JSON.stringify(fingerprint) : null,
      mergedIntoPatternId: null,
      mergedAt: null,
      active: true,
    })
    .returning()
    .get();
}

function findPatternForSuggestion(
  tx: LearningAssetTx,
  operation: Extract<PersistedPatternOperationSnapshot, { kind: 'suggest_new_pattern' }>,
): ErrorPatternRow | undefined {
  const exactPattern = tx.select().from(errorPatterns).where(eq(errorPatterns.patternKey, operation.patternKey)).get();
  if (exactPattern) {
    return resolveWritablePattern(tx, exactPattern);
  }

  return tx
    .select()
    .from(errorPatterns)
    .all()
    .find(
      (pattern) =>
        pattern.active &&
        !pattern.mergedIntoPatternId &&
        pattern.category === operation.category &&
        arePatternRulesSimilar(pattern.rule, operation.rule),
    );
}

function resolveWritablePattern(
  tx: LearningAssetTx,
  pattern: ErrorPatternRow | undefined,
): ErrorPatternRow | undefined {
  if (!pattern?.mergedIntoPatternId) {
    return pattern;
  }

  const targetPattern = tx.select().from(errorPatterns).where(eq(errorPatterns.id, pattern.mergedIntoPatternId)).get();
  if (!targetPattern || !targetPattern.active || targetPattern.mergedIntoPatternId) {
    return undefined;
  }

  return targetPattern;
}

function incrementPattern(
  tx: LearningAssetTx,
  pattern: ErrorPatternRow,
  dateKey: string,
  example: string,
  fingerprint: PatternFingerprint | undefined,
): ErrorPatternRow {
  const recentExamples = [
    example,
    ...parseStringArray(pattern.recentExamplesJson).filter((item) => item !== example),
  ].slice(0, RECENT_EXAMPLES_LIMIT);

  return tx
    .update(errorPatterns)
    .set({
      count: pattern.count + 1,
      lastSeenDateKey: dateKey,
      recentExamplesJson: JSON.stringify(recentExamples),
      fingerprintJson: pattern.fingerprintJson ?? (fingerprint ? JSON.stringify(fingerprint) : null),
      active: true,
      updatedAt: new Date(),
    })
    .where(eq(errorPatterns.id, pattern.id))
    .returning()
    .get();
}
