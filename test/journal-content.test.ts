import { describe, expect, it } from 'vitest';
import { computeJournalContentHash, normalizeJournalContent } from '../src/shared/journal/content';

describe('journal content normalization and hashing', () => {
  it('normalizes CRLF and CR line endings to LF', () => {
    expect(normalizeJournalContent('Line one\r\nLine two\rLine three')).toBe('Line one\nLine two\nLine three');
  });

  it('computes the same hash for line-ending-equivalent content', () => {
    expect(computeJournalContentHash('I wrote this.\r\nIt stays mine.')).toBe(
      computeJournalContentHash('I wrote this.\nIt stays mine.')
    );
  });
});
