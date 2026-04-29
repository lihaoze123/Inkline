import { type ValidationStatus, type ReviewValidationResult } from '../../../../shared/review-contract';

export type ReviewPersistenceDecision = {
  status: 'review_ready' | 'review_failed';
  validationStatus: ValidationStatus;
  validationErrorsJson: string;
  rawOutputJson: string | null;
};

export function buildReviewPersistenceDecision(params: {
  validation: ReviewValidationResult;
  rawOutput: unknown;
  rawResponseStorageEnabled: boolean;
}): ReviewPersistenceDecision {
  const status = params.validation.validationStatus === 'invalid' ? 'review_failed' : 'review_ready';

  return {
    status,
    validationStatus: params.validation.validationStatus,
    validationErrorsJson: JSON.stringify(validationIssuesToMessages(params.validation)),
    rawOutputJson: params.rawResponseStorageEnabled ? JSON.stringify(params.rawOutput) : null,
  };
}

function validationIssuesToMessages(validation: ReviewValidationResult): string[] {
  return validation.issues.map((issue) => `${issue.code}: ${issue.message}`);
}
