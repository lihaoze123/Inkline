import { randomUUID } from 'node:crypto';
import { desc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { errorPatterns, notebookEntries } from '../../db/schema';
import { arePatternRulesSimilar, normalizePatternKey } from '../../../shared/review-contract/patterns';
import type { ErrorPattern } from '../../../shared/review-contract/schemas';
import type { PatternOperationSnapshot, PreviewOperationsSnapshot } from '../../../shared/types/review';
import {
  listErrorPatternsOutputSchema,
  listNotebookEntriesOutputSchema,
  type ErrorPatternSnapshot,
  type ListErrorPatternsOutput,
  type ListNotebookEntriesOutput,
  type NotebookEntrySnapshot,
} from '../../../shared/types/learning-assets';
import type { WritingTemplateId } from '../../../shared/types/writing';

const RECENT_EXAMPLES_LIMIT = 5;
const LIST_LIMIT = 50;

type LearningAssetTx = Pick<typeof db, 'select' | 'insert' | 'update'>;
type ErrorPatternRow = typeof errorPatterns.$inferSelect;

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

function patternToSnapshot(pattern: ErrorPatternRow): ErrorPatternSnapshot {
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

export function listErrorPatterns(): ListErrorPatternsOutput {
  const patterns = db
    .select()
    .from(errorPatterns)
    .orderBy(desc(errorPatterns.count), desc(errorPatterns.updatedAt))
    .limit(LIST_LIMIT)
    .all()
    .map(patternToSnapshot);

  return listErrorPatternsOutputSchema.parse(patterns);
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
  operations: PreviewOperationsSnapshot;
  reviewRunId: string;
  dateKey: string;
}): Map<number, PersistedPatternLink> {
  const links = new Map<number, PersistedPatternLink>();

  params.operations.patternOperations.forEach((operation) => {
    const correction = params.operations.corrections.find(
      (candidate) => candidate.correctionIndex === operation.correctionIndex,
    );
    if (!correction || correction.status === 'low_confidence') {
      return;
    }

    const example = `${correction.originalText} -> ${correction.correctedText}`;
    const pattern = persistOnePatternOperation(params.tx, operation, params.dateKey, example);
    links.set(operation.correctionIndex, { patternId: pattern.id, rule: pattern.rule });
  });

  return links;
}

export function persistNotebookEntries(params: {
  tx: LearningAssetTx;
  operations: PreviewOperationsSnapshot;
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
  operation: PatternOperationSnapshot,
  dateKey: string,
  example: string,
): ErrorPatternRow {
  if (operation.kind === 'reuse_pattern') {
    const pattern = tx.select().from(errorPatterns).where(eq(errorPatterns.id, operation.patternId)).get();
    if (!pattern) {
      throw new Error(`Matched error pattern was not found: ${operation.patternId}`);
    }

    return incrementPattern(tx, pattern, dateKey, example);
  }

  const existingPatternId = operation.duplicateOfPatternId;
  const existingPattern =
    (existingPatternId
      ? tx.select().from(errorPatterns).where(eq(errorPatterns.id, existingPatternId)).get()
      : undefined) ?? findPatternForSuggestion(tx, operation);

  if (existingPattern) {
    return incrementPattern(tx, existingPattern, dateKey, example);
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
      active: true,
    })
    .returning()
    .get();
}

function findPatternForSuggestion(
  tx: LearningAssetTx,
  operation: Extract<PatternOperationSnapshot, { kind: 'suggest_new_pattern' }>,
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
      active: true,
      updatedAt: new Date(),
    })
    .where(eq(errorPatterns.id, pattern.id))
    .returning()
    .get();
}
