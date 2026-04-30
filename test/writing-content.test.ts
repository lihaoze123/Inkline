import { describe, expect, it } from 'vitest';
import { computeWritingContentHash, normalizeWritingContent } from '../src/shared/writing/content';

describe('writing content normalization and hashing', () => {
  it('normalizes CRLF and CR line endings to LF', () => {
    expect(normalizeWritingContent('Line one\r\nLine two\rLine three')).toBe('Line one\nLine two\nLine three');
  });

  it('computes the same hash for line-ending-equivalent content', () => {
    expect(computeWritingContentHash('I wrote this.\r\nIt stays mine.')).toBe(
      computeWritingContentHash('I wrote this.\nIt stays mine.'),
    );
  });
});
