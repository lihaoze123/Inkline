import { randomUUID } from 'node:crypto';
import { and, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  corrections,
  errorPatterns,
  learningEvents,
  notebookEntries,
  rewriteChecks,
  rewriteTasks,
} from '../../db/schema';
import { arePatternRulesSimilar, normalizePatternKey } from '../../../shared/review-contract/patterns';
import type { ErrorPattern, PatternFingerprint } from '../../../shared/review-contract/schemas';
import type {
  PersistedPatternOperationSnapshot,
  PersistedPreviewOperationsSnapshot,
} from '../../../shared/types/review';
import {
  learningEventPayloadSchema,
  listLearningEventsOutputSchema,
  listErrorPatternsOutputSchema,
  listNotebookEntriesOutputSchema,
  mergeErrorPatternsInputSchema,
  mergeErrorPatternsResultSchema,
  type ErrorPatternSnapshot,
  type LearningEventSnapshot,
  type LearningEventType,
  type ListErrorPatternsOutput,
  type ListLearningEventsOutput,
  type ListNotebookEntriesOutput,
  type MergeErrorPatternsResult,
  type NotebookEntrySnapshot,
  type PatternEvidenceCheckSummary,
  type PatternEvidenceRepairSummary,
  type PatternEvidenceStage,
  type PatternEvidenceSummary,
  type PatternEvidenceTransferSummary,
  type PatternLifecycleStatus,
  type PatternLifecycleSummary,
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
type LearningEventTx = Pick<typeof db, 'select' | 'insert'>;
type LearningAssetDatabase = typeof db;
type ErrorPatternRow = typeof errorPatterns.$inferSelect;
type LearningEventRow = typeof learningEvents.$inferSelect;
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
  transfer: PatternEvidenceTransferSummary;
  stageOnCorrect: Extract<PatternEvidenceStage, 'transferred_once' | 'stable_after_spaced_reuse'>;
  hasCorrectOutcome: boolean;
  contextRank: number;
};
type RewriteTaskKind = 'rewrite_original' | 'new_context_reuse' | 'pattern_detection';

export type AppendLearningEventInput = {
  eventType: LearningEventType;
  occurredAt?: Date;
  dedupeKey?: string | null;
  reviewRunId?: string | null;
  patternId?: string | null;
  rewriteTaskId?: string | null;
  rewriteCheckId?: string | null;
  payload?: Record<string, unknown>;
};

const lifecycleCopy: Record<PatternLifecycleStatus, { label: string; description: string }> = {
  repair_needed: {
    label: 'Repair needed',
    description: 'No D+1 repair has been checked as correct yet.',
  },
  repair_in_progress: {
    label: 'Repair in progress',
    description: 'A D+1 repair task or check is still in progress.',
  },
  ready_for_transfer: {
    label: 'Ready for transfer',
    description: 'The D+1 repair was correct; the next step is delayed new-context reuse.',
  },
  transfer_in_progress: {
    label: 'Transfer in progress',
    description: 'A D+3 new-context reuse task or check is still in progress.',
  },
  stabilizing: {
    label: 'Stabilizing',
    description: 'The pattern transferred once; D+7 spaced reuse is not checked correct yet.',
  },
  stable: {
    label: 'Stable',
    description: 'D+7 spaced reuse was checked correct.',
  },
  needs_attention: {
    label: 'Needs attention',
    description: 'The latest repair or transfer evidence needs follow-up before the next stage.',
  },
};

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
    lifecycle: derivePatternLifecycleSummary(evidence),
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
      const task = existingTask ?? createEvidenceTransferTask(row, row.patternId, transferStage);
      const check = checkSummaryFromRow(row);

      if (check) {
        const currentCheckRank = task.transfer.latestCheck ? checkContextRank(task.transfer.latestCheck) : null;
        const rowCheckRank = rowCheckContextRank(row);
        if (currentCheckRank === null || rowCheckRank > currentCheckRank) {
          task.transfer = { ...task.transfer, latestCheck: check };
        }

        if (check.status === 'completed' && check.outcome !== null) {
          if (check.outcome === 'correct') {
            task.hasCorrectOutcome = true;
          }
        }
      }

      task.contextRank = Math.max(task.contextRank, transferContextRank(task.transfer));
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

    summaries.set(task.patternId, { ...current, stage, latestRepair });
  });
  transferTasks.forEach((task) => {
    const current = summaries.get(task.patternId) ?? defaultEvidenceSummary();
    const stage = strongestEvidenceStage(current.stage, task.hasCorrectOutcome ? task.stageOnCorrect : 'needs_repair');
    const latestTransfer =
      current.latestTransfer && transferContextRank(current.latestTransfer) >= task.contextRank
        ? current.latestTransfer
        : task.transfer;

    summaries.set(task.patternId, { ...current, stage, latestTransfer });
  });

  return summaries;
}

export function derivePatternLifecycleSummary(evidence: PatternEvidenceSummary): PatternLifecycleSummary {
  const attentionReason = latestAttentionReason(evidence);
  if (attentionReason) {
    return lifecycleSummary('needs_attention', attentionReason);
  }

  if (evidence.stage === 'stable_after_spaced_reuse') {
    return lifecycleSummary('stable');
  }

  const latestTransfer = evidence.latestTransfer;
  if (evidence.stage === 'transferred_once') {
    return lifecycleSummary('stabilizing');
  }

  if (latestTransfer) {
    return lifecycleSummary(latestTransfer.spacedStage === 'D+7' ? 'stabilizing' : 'transfer_in_progress');
  }

  if (evidence.stage === 'repaired_once') {
    return lifecycleSummary('ready_for_transfer');
  }

  const latestRepair = evidence.latestRepair;
  if (latestRepair && isActiveEvidenceContext(latestRepair.status, latestRepair.latestCheck)) {
    return lifecycleSummary('repair_in_progress');
  }

  return lifecycleSummary('repair_needed');
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
  row: PatternEvidenceQueryRow,
  patternId: string,
  stageOnCorrect: Extract<PatternEvidenceStage, 'transferred_once' | 'stable_after_spaced_reuse'>,
): EvidenceTransferTask {
  return {
    patternId,
    transfer: {
      rewriteTaskId: row.rewriteTaskId,
      practiceKind: 'new_context_reuse',
      spacedStage: row.spacedStage === 'D+7' ? 'D+7' : 'D+3',
      status: row.rewriteTaskStatus,
      dueAt: dateToMillis(row.dueAt),
      completedAt: dateToMillis(row.completedAt),
      createdAt: row.taskCreatedAt.getTime(),
      latestCheck: null,
    },
    stageOnCorrect,
    hasCorrectOutcome: false,
    contextRank: taskContextRank(row),
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
    latestTransfer: null,
  };
}

function lifecycleSummary(status: PatternLifecycleStatus, blockingReason?: string): PatternLifecycleSummary {
  const summary = {
    status,
    ...lifecycleCopy[status],
  };

  return blockingReason ? { ...summary, blockingReason } : summary;
}

function latestAttentionReason(evidence: PatternEvidenceSummary): string | null {
  const candidates: Array<{ rank: number; reason: string }> = [];
  const repairAttentionReason = evidence.latestRepair ? attentionReasonForRepair(evidence.latestRepair) : null;
  if (evidence.latestRepair && repairAttentionReason) {
    candidates.push({ rank: repairContextRank(evidence.latestRepair), reason: repairAttentionReason });
  }

  const transferAttentionReason = evidence.latestTransfer ? attentionReasonForTransfer(evidence.latestTransfer) : null;
  if (evidence.latestTransfer && transferAttentionReason) {
    candidates.push({ rank: transferContextRank(evidence.latestTransfer), reason: transferAttentionReason });
  }

  if (candidates.length === 0) {
    return null;
  }

  const latestOverallRank = latestEvidenceContextRank(evidence);
  const latestCandidate = candidates.reduce((latest, candidate) => (candidate.rank > latest.rank ? candidate : latest));

  return latestCandidate.rank >= latestOverallRank ? latestCandidate.reason : null;
}

function latestEvidenceContextRank(evidence: PatternEvidenceSummary): number {
  return Math.max(
    evidence.latestRepair ? repairContextRank(evidence.latestRepair) : 0,
    evidence.latestTransfer ? transferContextRank(evidence.latestTransfer) : 0,
  );
}

function attentionReasonForRepair(repair: PatternEvidenceRepairSummary): string | null {
  const checkReason = attentionReasonForCheck('D+1 repair', repair.latestCheck);
  if (checkReason) {
    return checkReason;
  }

  return attentionReasonForTask('D+1 repair', repair.status);
}

function attentionReasonForTransfer(transfer: PatternEvidenceTransferSummary): string | null {
  const label = transfer.spacedStage === 'D+7' ? 'D+7 spaced reuse' : 'D+3 transfer';
  const checkReason = attentionReasonForCheck(label, transfer.latestCheck);
  if (checkReason) {
    return checkReason;
  }

  return attentionReasonForTask(label, transfer.status);
}

function attentionReasonForCheck(label: string, check: PatternEvidenceCheckSummary | null): string | null {
  if (!check) {
    return null;
  }

  if (check.status === 'failed' || check.status === 'retryable') {
    return `Latest ${label} check needs retry before evidence can advance.`;
  }

  if (check.status !== 'completed') {
    return null;
  }

  switch (check.outcome) {
    case 'partly_correct':
      return `Latest ${label} check was partly correct; try the same stage again.`;
    case 'incorrect':
      return `Latest ${label} check was incorrect; try the same stage again.`;
    case 'correct':
    case null:
      return null;
  }
}

function attentionReasonForTask(label: string, status: RewritePracticeStatus): string | null {
  switch (status) {
    case 'skipped':
      return `Latest ${label} task was skipped; evidence is unchanged.`;
    case 'expired':
      return `Latest ${label} window expired; evidence is unchanged.`;
    case 'pending':
    case 'in_progress':
    case 'completed':
    case 'snoozed':
      return null;
  }
}

function isActiveEvidenceContext(status: RewritePracticeStatus, check: PatternEvidenceCheckSummary | null): boolean {
  if (status === 'pending' || status === 'in_progress' || status === 'snoozed') {
    return true;
  }

  if (status !== 'completed') {
    return false;
  }

  return !check || check.status === 'pending' || check.status === 'in_progress';
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

function transferContextRank(transfer: PatternEvidenceTransferSummary): number {
  return Math.max(
    transfer.latestCheck ? checkContextRank(transfer.latestCheck) : 0,
    transfer.completedAt ?? 0,
    transfer.dueAt ?? 0,
    transfer.createdAt,
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

function parsePayloadObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function learningEventToSnapshot(event: LearningEventRow): LearningEventSnapshot {
  return {
    id: event.id,
    eventType: event.eventType,
    occurredAt: event.occurredAt.getTime(),
    dedupeKey: event.dedupeKey,
    reviewRunId: event.reviewRunId,
    patternId: event.patternId,
    rewriteTaskId: event.rewriteTaskId,
    rewriteCheckId: event.rewriteCheckId,
    payload: parsePayloadObject(event.payloadJson),
    createdAt: event.createdAt.getTime(),
  };
}

export function appendLearningEvent(
  input: AppendLearningEventInput,
  database: LearningEventTx = db,
): LearningEventSnapshot | null {
  const dedupeKey = input.dedupeKey?.trim() || null;
  if (dedupeKey) {
    const existing = database.select().from(learningEvents).where(eq(learningEvents.dedupeKey, dedupeKey)).get();
    if (existing) {
      return null;
    }
  }

  const event = database
    .insert(learningEvents)
    .values({
      id: createId('learning_event'),
      eventType: input.eventType,
      occurredAt: input.occurredAt ?? new Date(),
      dedupeKey,
      reviewRunId: input.reviewRunId ?? null,
      patternId: input.patternId ?? null,
      rewriteTaskId: input.rewriteTaskId ?? null,
      rewriteCheckId: input.rewriteCheckId ?? null,
      payloadJson: JSON.stringify(learningEventPayloadSchema.parse(input.payload ?? {})),
    })
    .returning()
    .get();

  return learningEventToSnapshot(event);
}

export function listLearningEvents(database: LearningAssetDatabase = db): ListLearningEventsOutput {
  const events = database
    .select()
    .from(learningEvents)
    .orderBy(desc(learningEvents.occurredAt), desc(learningEvents.createdAt))
    .limit(LIST_LIMIT)
    .all()
    .map(learningEventToSnapshot);

  return listLearningEventsOutputSchema.parse(events);
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

      appendLearningEvent(
        {
          eventType: 'pattern_merged',
          occurredAt: now,
          dedupeKey: `pattern_merged:${validMerge.sourcePattern.id}:${validMerge.targetPattern.id}`,
          patternId: validMerge.targetPattern.id,
          payload: {
            sourcePatternId: validMerge.sourcePattern.id,
            targetPatternId: validMerge.targetPattern.id,
            category: validMerge.targetPattern.category,
            sourceCount: validMerge.sourcePattern.count,
            targetCountBefore: validMerge.targetPattern.count,
            targetCountAfter: mergedTarget.count,
          },
        },
        tx,
      );

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
