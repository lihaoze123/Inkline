import { describe, expect, it } from 'vitest';
import { computeJournalContentHash, normalizeJournalContent } from '../src/shared/journal/content';

type RevisionRecord = {
  id: string;
  journalEntryId: string;
  content: string;
  contentHash: string;
};

type ReviewRecord = {
  id: string;
  contentHash: string;
  status: 'review_saved' | 'stale';
};

type EntryRecord = {
  id: string;
  activeRevisionId: string | null;
  lastReviewRunId: string | null;
};

function createRevision(id: string, journalEntryId: string, rawContent: string): RevisionRecord {
  const content = normalizeJournalContent(rawContent);

  return {
    id,
    journalEntryId,
    content,
    contentHash: computeJournalContentHash(content),
  };
}

function applyActiveRevisionChange(entry: EntryRecord, review: ReviewRecord, revision: RevisionRecord): {
  entry: EntryRecord;
  review: ReviewRecord;
} {
  if (entry.lastReviewRunId === review.id && review.status === 'review_saved' && review.contentHash !== revision.contentHash) {
    return {
      entry: { ...entry, activeRevisionId: revision.id, lastReviewRunId: null },
      review: { ...review, status: 'stale' },
    };
  }

  return {
    entry: { ...entry, activeRevisionId: revision.id },
    review,
  };
}

describe('journal revision persistence contract', () => {
  it('creates a journal entry with an active LF-normalized revision', () => {
    const revision = createRevision('revision_1', 'entry_1', 'Hello\r\nworld');
    const entry: EntryRecord = { id: 'entry_1', activeRevisionId: revision.id, lastReviewRunId: null };

    expect(revision.content).toBe('Hello\nworld');
    expect(revision.contentHash).toBe(computeJournalContentHash('Hello\nworld'));
    expect(entry.activeRevisionId).toBe('revision_1');
  });

  it('marks the saved review stale when a new active revision changes content hash', () => {
    const firstRevision = createRevision('revision_1', 'entry_1', 'First version');
    const secondRevision = createRevision('revision_2', 'entry_1', 'Second version');
    const entry: EntryRecord = { id: 'entry_1', activeRevisionId: firstRevision.id, lastReviewRunId: 'review_1' };
    const review: ReviewRecord = { id: 'review_1', contentHash: firstRevision.contentHash, status: 'review_saved' };

    const result = applyActiveRevisionChange(entry, review, secondRevision);

    expect(result.review.status).toBe('stale');
    expect(result.review.contentHash).toBe(firstRevision.contentHash);
    expect(result.entry.activeRevisionId).toBe('revision_2');
    expect(result.entry.lastReviewRunId).toBeNull();
  });
});
