import { randomUUID } from 'node:crypto';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  journalEntries,
  journalRevisions,
  reviewRuns,
  rewriteTasks,
  type JournalEntry,
  type JournalRevision,
  type ReviewRun,
  type rewriteTasks as rewriteTasksTable,
} from '../../db/schema';
import { computeJournalContentHash, getLocalDateKey, normalizeJournalContent } from '../../../shared/journal/content';
import {
  completeRewritePracticeInputSchema,
  skipRewritePracticeInputSchema,
  type CompleteRewritePracticeInput,
  type RewritePracticeSnapshot,
  type RewritePracticeUpdateResult,
  type SaveTodayJournalInput,
  type SaveTodayJournalResult,
  type SkipRewritePracticeInput,
  type TodayJournalSnapshot,
} from '../../../shared/types/journal';

function createId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

function toMillis(date: Date | null): number | null {
  return date ? date.getTime() : null;
}

function revisionToSnapshot(revision: JournalRevision): TodayJournalSnapshot['activeRevision'] {
  return {
    id: revision.id,
    journalEntryId: revision.journalEntryId,
    content: revision.content,
    contentHash: revision.contentHash,
    createdAt: revision.createdAt.getTime(),
  };
}

type RewriteTaskRow = typeof rewriteTasksTable.$inferSelect;

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const REWRITE_PRACTICE_MAX_AGE_MS = 7 * ONE_DAY_MS;

function staleReviewToSnapshot(reviewRun: ReviewRun | undefined): TodayJournalSnapshot['staleReview'] {
  if (!reviewRun) {
    return null;
  }

  return {
    id: reviewRun.id,
    reviewedContentHash: reviewRun.contentHash,
    createdAt: reviewRun.createdAt.getTime(),
  };
}

function rewriteTaskToSnapshot(task: RewriteTaskRow, nowMillis = Date.now()): RewritePracticeSnapshot {
  return {
    id: task.id,
    reviewRunId: task.reviewRunId,
    originalSentence: task.originalSentence,
    focusPattern: task.focusPattern,
    nativeModelSentence: task.nativeModelSentence,
    prompt: task.prompt,
    practiceKind: 'rewrite_original',
    spacedStage: 'D+1',
    status: task.status,
    userRewriteText: task.userRewriteText,
    dueAt: toMillis(task.dueAt),
    createdAt: task.createdAt.getTime(),
    isOlderThanSevenDays: nowMillis - task.createdAt.getTime() > REWRITE_PRACTICE_MAX_AGE_MS,
  };
}

function getActiveRevision(entry: JournalEntry): JournalRevision | null {
  if (!entry.activeRevisionId) {
    return null;
  }

  return db.select().from(journalRevisions).where(eq(journalRevisions.id, entry.activeRevisionId)).get() ?? null;
}

function getMostRecentStaleReview(entryId: string): ReviewRun | undefined {
  return db
    .select()
    .from(reviewRuns)
    .where(eq(reviewRuns.journalEntryId, entryId))
    .orderBy(desc(reviewRuns.updatedAt), desc(reviewRuns.createdAt))
    .all()
    .find((reviewRun) => reviewRun.status === 'stale');
}

function getPendingRewritePractice(now = new Date()): RewriteTaskRow | null {
  const cutoff = new Date(now.getTime() - REWRITE_PRACTICE_MAX_AGE_MS);

  return db
    .select()
    .from(rewriteTasks)
    .where(and(eq(rewriteTasks.status, 'pending'), eq(rewriteTasks.kind, 'rewrite_original'), lte(rewriteTasks.dueAt, now), gte(rewriteTasks.createdAt, cutoff)))
    .orderBy(desc(rewriteTasks.dueAt), desc(rewriteTasks.createdAt))
    .all()
    .find((task) => task.spacedStage === 'D+1') ?? null;
}

function buildSnapshot(entry: JournalEntry): TodayJournalSnapshot {
  const activeRevision = getActiveRevision(entry);
  const staleReview = getMostRecentStaleReview(entry.id);
  const pendingRewritePractice = getPendingRewritePractice();

  return {
    entryId: entry.id,
    dateKey: entry.dateKey,
    activeRevision: activeRevision ? revisionToSnapshot(activeRevision) : null,
    lastAutosaveAt: toMillis(activeRevision?.createdAt ?? null),
    lastReviewRunId: entry.lastReviewRunId,
    staleReview: staleReviewToSnapshot(staleReview),
    pendingRewritePractice: pendingRewritePractice ? rewriteTaskToSnapshot(pendingRewritePractice) : null,
  };
}

function getOrCreateTodayEntry(): JournalEntry {
  const dateKey = getLocalDateKey();
  const existing = db.select().from(journalEntries).where(eq(journalEntries.dateKey, dateKey)).get();

  if (existing) {
    return existing;
  }

  return db
    .insert(journalEntries)
    .values({
      id: createId('journal'),
      dateKey,
    })
    .returning()
    .get();
}

export function getTodayJournal(): TodayJournalSnapshot {
  const entry = getOrCreateTodayEntry();
  return buildSnapshot(entry);
}

export function getDueRewritePracticeForToday(now = new Date()): RewritePracticeSnapshot | null {
  const practice = getPendingRewritePractice(now);
  return practice ? rewriteTaskToSnapshot(practice, now.getTime()) : null;
}

export function saveTodayJournal(input: SaveTodayJournalInput): SaveTodayJournalResult {
  const normalizedContent = normalizeJournalContent(input.content);
  const contentHash = computeJournalContentHash(normalizedContent);
  const entry = getOrCreateTodayEntry();
  const activeRevision = getActiveRevision(entry);

  if (activeRevision?.contentHash === contentHash) {
    return { ...buildSnapshot(entry), saved: false };
  }

  const updatedEntry = db.transaction((tx) => {
    const revision = tx
      .insert(journalRevisions)
      .values({
        id: createId('revision'),
        journalEntryId: entry.id,
        content: normalizedContent,
        contentHash,
      })
      .returning()
      .get();

    tx.update(journalEntries).set({ activeRevisionId: revision.id }).where(eq(journalEntries.id, entry.id)).run();

    if (entry.lastReviewRunId) {
      const lastReviewRun = tx.select().from(reviewRuns).where(eq(reviewRuns.id, entry.lastReviewRunId)).get();

      if (lastReviewRun?.status === 'review_saved' && lastReviewRun.contentHash !== contentHash) {
        tx.update(reviewRuns).set({ status: 'stale' }).where(eq(reviewRuns.id, lastReviewRun.id)).run();
        tx
          .update(journalEntries)
          .set({ lastReviewRunId: null, reviewedAt: null })
          .where(eq(journalEntries.id, entry.id))
          .run();
      }
    }

    const savedEntry = tx.select().from(journalEntries).where(eq(journalEntries.id, entry.id)).get();

    if (!savedEntry) {
      throw new Error('Unable to load saved journal entry.');
    }

    return savedEntry;
  });

  return { ...buildSnapshot(updatedEntry), saved: true };
}

export function completeRewritePractice(input: CompleteRewritePracticeInput): RewritePracticeUpdateResult {
  const parseResult = completeRewritePracticeInputSchema.safeParse(input);
  if (!parseResult.success) {
    return { success: false, error: parseResult.error.issues[0].message };
  }

  const task = db.select().from(rewriteTasks).where(eq(rewriteTasks.id, parseResult.data.rewriteTaskId)).get();
  if (!task) {
    return { success: false, error: 'Rewrite practice was not found.' };
  }

  if (task.status !== 'pending' && task.status !== 'in_progress') {
    return { success: true, journal: getTodayJournal(), rewritePractice: rewriteTaskToSnapshot(task) };
  }

  const updatedTask = db
    .update(rewriteTasks)
    .set({
      status: 'completed',
      userRewriteText: parseResult.data.userRewriteText.trim(),
      completedAt: new Date(),
    })
    .where(eq(rewriteTasks.id, parseResult.data.rewriteTaskId))
    .returning()
    .get();

  return { success: true, journal: getTodayJournal(), rewritePractice: rewriteTaskToSnapshot(updatedTask) };
}

export function skipRewritePractice(input: SkipRewritePracticeInput): RewritePracticeUpdateResult {
  const parseResult = skipRewritePracticeInputSchema.safeParse(input);
  if (!parseResult.success) {
    return { success: false, error: parseResult.error.issues[0].message };
  }

  const task = db.select().from(rewriteTasks).where(eq(rewriteTasks.id, parseResult.data.rewriteTaskId)).get();
  if (!task) {
    return { success: false, error: 'Rewrite practice was not found.' };
  }

  if (task.status !== 'pending' && task.status !== 'in_progress') {
    return { success: true, journal: getTodayJournal(), rewritePractice: rewriteTaskToSnapshot(task) };
  }

  const updatedTask = db
    .update(rewriteTasks)
    .set({
      status: 'skipped',
      skippedAt: new Date(),
    })
    .where(eq(rewriteTasks.id, parseResult.data.rewriteTaskId))
    .returning()
    .get();

  return { success: true, journal: getTodayJournal(), rewritePractice: rewriteTaskToSnapshot(updatedTask) };
}
