import { describe, expect, it } from 'vitest';
import { sanitizeE2eFailureText, selectorForE2e } from '../scripts/review-ui-e2e';

describe('review UI e2e helpers', () => {
  it('builds stable data-e2e attribute selectors', () => {
    expect(selectorForE2e('openai-compatible-save-settings')).toBe('[data-e2e="openai-compatible-save-settings"]');
    expect(selectorForE2e('quote"and\\slash')).toBe('[data-e2e="quote\\"and\\\\slash"]');
  });

  it('redacts obvious secrets from bounded failure text', () => {
    const text = 'Authorization: Bearer token-secret api_key=sk-secret123456789 e2e-mock-api-key ' + 'x'.repeat(3_000);

    const sanitized = sanitizeE2eFailureText(text);

    expect(sanitized).toContain('Authorization: Bearer [REDACTED]');
    expect(sanitized).toContain('api_key=[REDACTED]');
    expect(sanitized).toContain('[redacted-api-key]');
    expect(sanitized).not.toContain('e2e-mock-api-key');
    expect(sanitized.length).toBeLessThanOrEqual(2_000);
  });
});
