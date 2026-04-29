import { randomUUID } from 'node:crypto';
import { desc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { journalEntries, journalRevisions, reviewRuns, type JournalEntry, type JournalRevision, type ReviewRun } from '../../db/schema';
import { computeJournalContentHash, getLocalDateKey, normalizeJournalContent } from '../../../shared/journal/content';
import type { SaveTodayJournalInput, SaveTodayJournalResult, TodayJournalSnapshot } from '../../../shared/types/journal';

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

function buildSnapshot(entry: JournalEntry): TodayJournalSnapshot {
  const activeRevision = getActiveRevision(entry);
  const staleReview = getMostRecentStaleReview(entry.id);

  return {
    entryId: entry.id,
    dateKey: entry.dateKey,
    activeRevision: activeRevision ? revisionToSnapshot(activeRevision) : null,
    lastAutosaveAt: toMillis(activeRevision?.createdAt ?? null),
    lastReviewRunId: entry.lastReviewRunId,
    staleReview: staleReviewToSnapshot(staleReview),
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
