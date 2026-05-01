export function normalizePatternKey(category: string, rule: string): string {
  const normalizedRule = rule
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return `${category}:${normalizedRule || 'pattern'}`;
}

export function arePatternRulesSimilar(left: string, right: string): boolean {
  const leftTokens = tokenizePatternRule(left);
  const rightTokens = tokenizePatternRule(right);
  const smallerSize = Math.min(leftTokens.size, rightTokens.size);

  if (smallerSize < 2) {
    return false;
  }

  const overlap = tokenOverlap(leftTokens, rightTokens);
  return overlap >= 2 && overlap / smallerSize >= 0.67;
}

const PATTERN_RULE_STOP_WORDS = new Set(['and', 'for', 'instead', 'into', 'not', 'the', 'use', 'with']);

function tokenizePatternRule(rule: string): Set<string> {
  return new Set(
    rule
      .toLowerCase()
      .match(/[a-z]{3,}/g)
      ?.filter((token) => !PATTERN_RULE_STOP_WORDS.has(token)) ?? [],
  );
}

function tokenOverlap(left: Set<string>, right: Set<string>): number {
  let count = 0;
  left.forEach((token) => {
    if (right.has(token)) {
      count += 1;
    }
  });
  return count;
}
