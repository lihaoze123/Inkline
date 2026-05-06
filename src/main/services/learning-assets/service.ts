import { randomUUID } from 'node:crypto';
import { and, desc, eq, inArray, or } from 'drizzle-orm';
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
  type ErrorPatternSnapshot,
  type ListErrorPatternsOutput,
  type ListNotebookEntriesOutput,
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
type ErrorPatternRow = typeof errorPatterns.$inferSelect;
type EvidenceRepairTask = {
  patternId: string;
  repair: PatternEvidenceRepairSummary;
  latestCompletedOutcome: RewriteCheckOutcome | null;
  latestCompletedRank: number | null;
  contextRank: number;
};
type EvidenceTransferTask = {
  patternId: string;
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

export function listErrorPatterns(database: typeof db = db): ListErrorPatternsOutput {
  const patternRows = database
    .select()
    .from(errorPatterns)
    .orderBy(desc(errorPatterns.count), desc(errorPatterns.updatedAt))
    .limit(LIST_LIMIT)
    .all();

  const patternIds = patternRows.map((pattern) => pattern.id);
  const evidenceByPatternId = derivePatternEvidenceSummaries(selectPatternEvidenceRows(database, patternIds));
  const patterns = patternRows.map((pattern) =>
    patternToSnapshot(pattern, evidenceByPatternId.get(pattern.id) ?? defaultEvidenceSummary()),
  );

  return listErrorPatternsOutputSchema.parse(patterns);
}

function selectPatternEvidenceRows(database: typeof db, patternIds: string[]): PatternEvidenceQueryRow[] {
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

    if (isD3TransferEvidenceRow(row)) {
      const taskKey = `${row.patternId}:${row.rewriteTaskId}`;
      const existingTask = transferTasks.get(taskKey);
      const task = existingTask ?? createEvidenceTransferTask(row.patternId);
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
      task.latestCompletedOutcome === 'correct' ? 'transferred_once' : 'needs_repair',
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

function createEvidenceTransferTask(patternId: string): EvidenceTransferTask {
  return {
    patternId,
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

export function selectActiveReviewPatterns(database: typeof db = db, limit = 30): ErrorPattern[] {
  return database
    .select()
    .from(errorPatterns)
    .orderBy(desc(errorPatterns.count), desc(errorPatterns.updatedAt))
    .all()
    .filter((pattern) => pattern.active && pattern.category !== 'spelling')
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
      ? tx.select().from(errorPatterns).where(eq(errorPatterns.id, existingPatternId)).get()
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
    return exactPattern;
  }

  return tx
    .select()
    .from(errorPatterns)
    .all()
    .find((pattern) => pattern.category === operation.category && arePatternRulesSimilar(pattern.rule, operation.rule));
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
