import type { CorrectionAnchor } from './schemas';

export type AnchorLocation = {
  startOffset: number;
  endOffset: number;
  matchedText: string;
  usedFallback: boolean;
};

export type AnchorFailure = {
  reason: string;
};

export type AnchorResult = { success: true; location: AnchorLocation } | { success: false; failure: AnchorFailure };

type Candidate = {
  startOffset: number;
  endOffset: number;
};

const CURLY_QUOTE_MAP: Record<string, string> = {
  '‘': "'",
  '’': "'",
  '“': '"',
  '”': '"',
};

export function normalizeWritingContent(content: string): string {
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export function locateAnchor(content: string, anchor: CorrectionAnchor): AnchorResult {
  const normalizedContent = normalizeWritingContent(content);
  const normalizedAnchor = {
    exact: normalizeWritingContent(anchor.exact),
    prefix: normalizeWritingContent(anchor.prefix),
    suffix: normalizeWritingContent(anchor.suffix),
    occurrenceIndex: anchor.occurrenceIndex,
  };

  const exactResult = locateNormalizedAnchor(normalizedContent, normalizedAnchor, false);
  if (exactResult.success === true) {
    return exactResult;
  }

  const quoteFallbackResult = locateNormalizedAnchor(
    normalizeCurlyQuotes(normalizedContent),
    {
      exact: normalizeCurlyQuotes(normalizedAnchor.exact),
      prefix: normalizeCurlyQuotes(normalizedAnchor.prefix),
      suffix: normalizeCurlyQuotes(normalizedAnchor.suffix),
      occurrenceIndex: normalizedAnchor.occurrenceIndex,
    },
    true,
  );

  if (quoteFallbackResult.success === true) {
    return quoteFallbackResult;
  }

  return exactResult;
}

function locateNormalizedAnchor(content: string, anchor: CorrectionAnchor, usedFallback: boolean): AnchorResult {
  const candidates = findExactCandidates(content, anchor.exact);
  if (candidates.length === 0) {
    return { success: false, failure: { reason: 'exact text was not found in the journal content' } };
  }

  const hasContextAnchor = anchor.prefix.length > 0 || anchor.suffix.length > 0;
  const contextualCandidates = hasContextAnchor ? candidates.filter((candidate) => hasContext(content, candidate, anchor)) : candidates;
  if (contextualCandidates.length === 0) {
    return { success: false, failure: { reason: 'prefix and suffix did not match surrounding journal text' } };
  }

  const selectedCandidate = selectCandidate(candidates, contextualCandidates, anchor.occurrenceIndex);
  if (!selectedCandidate) {
    return { success: false, failure: { reason: 'occurrenceIndex did not match any exact text occurrence' } };
  }

  return {
    success: true,
    location: {
      startOffset: selectedCandidate.startOffset,
      endOffset: selectedCandidate.endOffset,
      matchedText: content.slice(selectedCandidate.startOffset, selectedCandidate.endOffset),
      usedFallback,
    },
  };
}

function findExactCandidates(content: string, exact: string): Candidate[] {
  const candidates: Candidate[] = [];
  let searchFrom = 0;

  while (searchFrom <= content.length) {
    const index = content.indexOf(exact, searchFrom);
    if (index === -1) {
      break;
    }

    candidates.push({ startOffset: index, endOffset: index + exact.length });
    searchFrom = index + Math.max(exact.length, 1);
  }

  return candidates;
}

function hasContext(content: string, candidate: Candidate, anchor: CorrectionAnchor): boolean {
  const prefixMatches = anchor.prefix.length === 0 || content.slice(0, candidate.startOffset).endsWith(anchor.prefix);
  const suffixMatches = anchor.suffix.length === 0 || content.slice(candidate.endOffset).startsWith(anchor.suffix);
  return prefixMatches && suffixMatches;
}

function selectCandidate(candidates: Candidate[], contextualCandidates: Candidate[], occurrenceIndex: number | undefined): Candidate | undefined {
  if (occurrenceIndex === undefined) {
    return contextualCandidates.length === 1 ? contextualCandidates[0] : undefined;
  }

  const selectedByOccurrence = candidates[occurrenceIndex];
  if (!selectedByOccurrence) {
    return undefined;
  }

  return contextualCandidates.find((candidate) => candidate.startOffset === selectedByOccurrence.startOffset && candidate.endOffset === selectedByOccurrence.endOffset);
}

function normalizeCurlyQuotes(value: string): string {
  return value.replace(/[‘’“”]/g, (quote) => CURLY_QUOTE_MAP[quote] ?? quote);
}
