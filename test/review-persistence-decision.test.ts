import { describe, expect, it } from 'vitest';
import { buildReviewPersistenceDecision } from '../src/main/services/review/lib/persistence-decision';
import type { ReviewValidationResult } from '../src/shared/review-contract';

function validationResult(status: ReviewValidationResult['validationStatus']): ReviewValidationResult {
  return {
    schemaValid: status !== 'invalid',
    validationStatus: status,
    issues: status === 'invalid' ? [{ severity: 'error', code: 'schema_invalid', message: 'Invalid output' }] : [],
    anchoringSuccessRate: status === 'invalid' ? 0 : 1,
    parsedOutput: null,
    operations: { corrections: [], patternOperations: [], referenceRewrites: [], selfRepair: null, rewritePractice: [], inputBridge: null },
  };
}

describe('review persistence decision', () => {
  it('keeps valid output ready without raw output when storage is disabled', () => {
    const decision = buildReviewPersistenceDecision({
      validation: validationResult('valid'),
      rawOutput: { containsJournal: 'Today I go home.' },
      rawResponseStorageEnabled: false,
    });

    expect(decision).toMatchObject({
      status: 'review_ready',
      validationStatus: 'valid',
      rawOutputJson: null,
    });
  });

  it('fails invalid output and prevents active review pointer updates', () => {
    const decision = buildReviewPersistenceDecision({
      validation: validationResult('invalid'),
      rawOutput: { invalid: true },
      rawResponseStorageEnabled: true,
    });

    expect(decision).toMatchObject({
      status: 'review_failed',
      validationStatus: 'invalid',
      rawOutputJson: JSON.stringify({ invalid: true }),
    });
    expect(JSON.parse(decision.validationErrorsJson)).toEqual(['schema_invalid: Invalid output']);
  });

  it('preserves valid_with_warnings for preview-stage diagnostics', () => {
    const decision = buildReviewPersistenceDecision({
      validation: validationResult('valid_with_warnings'),
      rawOutput: {},
      rawResponseStorageEnabled: false,
    });

    expect(decision.status).toBe('review_ready');
    expect(decision.validationStatus).toBe('valid_with_warnings');
  });
});
