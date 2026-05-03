import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  E2E_AI_MOCK_ENV,
  E2E_REWRITE_DUE_NOW_ENV,
  getE2eMockStructuredOutput,
  isE2eAiMockEnabled,
  RUNTIME_IS_PACKAGED_ENV,
  shouldForceE2eRewritePracticeDueNow,
} from '../src/main/services/ai/e2e-mock';
import { generateStructuredObject } from '../src/main/services/ai';
import { reviewOutputSchema } from '../src/shared/review-contract/schemas';
import { validateReviewResult, type ReviewInput } from '../src/shared/review-contract';
import { E2E_UI_REVIEW_OUTPUT, E2E_UI_SAMPLE_WRITING } from './fixtures/review-ui-e2e';

const originalEnv = {
  mock: process.env[E2E_AI_MOCK_ENV],
  dueNow: process.env[E2E_REWRITE_DUE_NOW_ENV],
  runtimeIsPackaged: process.env[RUNTIME_IS_PACKAGED_ENV],
  nodeEnv: process.env.NODE_ENV,
};

describe('e2e AI mock guard and fixtures', () => {
  afterEach(() => {
    restoreEnvValue(E2E_AI_MOCK_ENV, originalEnv.mock);
    restoreEnvValue(E2E_REWRITE_DUE_NOW_ENV, originalEnv.dueNow);
    restoreEnvValue(RUNTIME_IS_PACKAGED_ENV, originalEnv.runtimeIsPackaged);
    restoreEnvValue('NODE_ENV', originalEnv.nodeEnv);
  });

  it('enables the mock only for explicit non-production, non-packaged runtime', () => {
    expect(isE2eAiMockEnabled({ e2eAiMockFlag: '1', nodeEnv: 'test', isPackaged: false })).toBe(true);
    expect(isE2eAiMockEnabled({ e2eAiMockFlag: undefined, nodeEnv: 'test', isPackaged: false })).toBe(false);
    expect(isE2eAiMockEnabled({ e2eAiMockFlag: '1', nodeEnv: 'production', isPackaged: false })).toBe(false);
    expect(isE2eAiMockEnabled({ e2eAiMockFlag: '1', nodeEnv: 'test', isPackaged: true })).toBe(false);
  });

  it('does not return mock output in packaged runtime even when the e2e flag is present', async () => {
    process.env[E2E_AI_MOCK_ENV] = '1';
    process.env[RUNTIME_IS_PACKAGED_ENV] = '1';

    await expect(getE2eMockStructuredOutput('review_output')).resolves.toEqual({ enabled: false, output: null });
  });

  it('uses the deterministic review fixture through the structured generation boundary', async () => {
    process.env[E2E_AI_MOCK_ENV] = '1';
    process.env[RUNTIME_IS_PACKAGED_ENV] = '0';

    const result = await generateStructuredObject({
      runtimeConfig: {
        provider: 'openai-compatible',
        apiKey: 'mock-key',
        baseUrl: 'https://mock.invalid/v1',
        model: 'mock-model',
      },
      systemPrompt: 'Return JSON.',
      userPrompt: 'Review this writing.',
      schema: reviewOutputSchema,
      schemaName: 'review_output',
    });

    expect(result.output).toEqual(E2E_UI_REVIEW_OUTPUT);
    expect(result.rawOutput).toEqual({ e2eMock: true, schemaName: 'review_output' });
    expect(result.providerDiagnostics).toBeNull();
  });

  it('uses the deterministic rewrite-check fixture through the structured generation boundary', async () => {
    process.env[E2E_AI_MOCK_ENV] = '1';
    process.env[RUNTIME_IS_PACKAGED_ENV] = '0';
    const schema = z.object({
      outcome: z.enum(['correct', 'partly_correct', 'incorrect']),
      feedback: z.string().min(1),
    });

    const result = await generateStructuredObject({
      runtimeConfig: {
        provider: 'openai-compatible',
        apiKey: 'mock-key',
        baseUrl: 'https://mock.invalid/v1',
        model: 'mock-model',
      },
      systemPrompt: 'Return JSON.',
      userPrompt: 'Check this rewrite.',
      schema,
      schemaName: 'rewrite_check_evaluation',
    });

    expect(result.output).toEqual({
      outcome: 'correct',
      feedback: 'Good repair. The finished library visit now uses past tense clearly.',
    });
  });

  it('refuses unsupported schemas instead of falling through to a network provider in mock mode', async () => {
    process.env[E2E_AI_MOCK_ENV] = '1';
    process.env[RUNTIME_IS_PACKAGED_ENV] = '0';

    await expect(getE2eMockStructuredOutput('starter_prompt')).rejects.toThrow(
      'E2E AI mock has no fixture for schema "starter_prompt".',
    );
  });

  it('makes D+1 rewrite practice due immediately only in e2e mock mode', () => {
    process.env[E2E_AI_MOCK_ENV] = '1';
    process.env[E2E_REWRITE_DUE_NOW_ENV] = '1';
    process.env[RUNTIME_IS_PACKAGED_ENV] = '0';

    expect(shouldForceE2eRewritePracticeDueNow()).toBe(true);

    process.env.NODE_ENV = 'production';
    expect(shouldForceE2eRewritePracticeDueNow()).toBe(false);
  });

  it('keeps the UI e2e review fixture valid against the shared review contract', () => {
    const result = validateReviewResult(inputFor(E2E_UI_SAMPLE_WRITING), E2E_UI_REVIEW_OUTPUT);

    expect(result.schemaValid).toBe(true);
    expect(result.validationStatus).toBe('valid');
    expect(result.operations.corrections).toHaveLength(1);
    expect(result.operations.rewritePractice).toHaveLength(1);
  });
});

function inputFor(writingContent: string): ReviewInput {
  return {
    date: '2026-05-03',
    writingContent,
    contentHash: createHash('sha256').update(writingContent).digest('hex'),
    existingPatterns: [],
    maxCorrections: 5,
    maxReferenceRewrites: 1,
    maxRewriteTasks: 1,
    maxUpgradeOpportunities: 0,
    maxWhatWentWell: 3,
    maxInputExamples: 2,
  };
}

function restoreEnvValue(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
