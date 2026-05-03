export const E2E_AI_MOCK_ENV = 'INKLINE_E2E_AI_MOCK';
export const E2E_REWRITE_DUE_NOW_ENV = 'INKLINE_E2E_REWRITE_DUE_NOW';
export const RUNTIME_IS_PACKAGED_ENV = 'INKLINE_RUNTIME_IS_PACKAGED';

type E2eRuntimeOptions = {
  e2eAiMockFlag?: string;
  nodeEnv?: string;
  isPackaged?: boolean;
};

type E2eMockStructuredOutput =
  | { enabled: false; output: null }
  | { enabled: true; output: unknown; rawOutput: Record<string, unknown> };

export function isE2eAiMockEnabled(options: E2eRuntimeOptions = {}): boolean {
  const flag = options.e2eAiMockFlag ?? process.env[E2E_AI_MOCK_ENV];
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV;
  const isPackaged = options.isPackaged ?? process.env[RUNTIME_IS_PACKAGED_ENV] === '1';

  return isTruthyEnvValue(flag) && nodeEnv !== 'production' && !isPackaged;
}

export function shouldForceE2eRewritePracticeDueNow(): boolean {
  return isE2eAiMockEnabled() && isTruthyEnvValue(process.env[E2E_REWRITE_DUE_NOW_ENV]);
}

export async function getE2eMockStructuredOutput(schemaName: string): Promise<E2eMockStructuredOutput> {
  if (!isE2eAiMockEnabled()) {
    return { enabled: false, output: null };
  }

  const fixture = await import('../../../../test/fixtures/review-ui-e2e');

  if (schemaName === 'review_output') {
    return {
      enabled: true,
      output: fixture.E2E_UI_REVIEW_OUTPUT,
      rawOutput: { e2eMock: true, schemaName },
    };
  }

  if (schemaName === 'rewrite_check_evaluation') {
    return {
      enabled: true,
      output: fixture.E2E_UI_REWRITE_CHECK_EVALUATION,
      rawOutput: { e2eMock: true, schemaName },
    };
  }

  throw new Error(`E2E AI mock has no fixture for schema "${schemaName}".`);
}

function isTruthyEnvValue(value: string | undefined): boolean {
  return value === '1' || value?.toLowerCase() === 'true' || value?.toLowerCase() === 'yes';
}
