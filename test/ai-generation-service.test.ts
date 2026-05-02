import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type * as AiModule from 'ai';

const mocks = vi.hoisted(() => {
  const generateText = vi.fn();
  const openAiChat = vi.fn((model: string) => ({ provider: 'openai-compatible', model }));
  const anthropicModel = vi.fn((model: string) => ({ provider: 'anthropic', model }));
  const createOpenAI = vi.fn(() => ({ chat: openAiChat }));
  const createAnthropic = vi.fn(() => anthropicModel);

  return {
    anthropicModel,
    createAnthropic,
    createOpenAI,
    generateText,
    openAiChat,
  };
});

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof AiModule>();

  return {
    ...actual,
    generateText: mocks.generateText,
    Output: {
      ...actual.Output,
      json: vi.fn(() => ({ name: 'json' })),
      object: vi.fn(() => ({ name: 'object' })),
    },
  };
});

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: mocks.createOpenAI,
}));

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: mocks.createAnthropic,
}));

import { generateStructuredObject } from '../src/main/services/ai';

describe('AI generation service', () => {
  beforeEach((): void => {
    vi.clearAllMocks();
    mocks.generateText.mockResolvedValue({
      output: { prompt: 'Write about a memorable walk.' },
      finishReason: 'stop',
      usage: { inputTokens: 10, outputTokens: 8, totalTokens: 18 },
      warnings: undefined,
      request: {},
      response: { id: 'response_1', timestamp: new Date('2026-04-30T00:00:00.000Z'), modelId: 'model_1' },
      providerMetadata: undefined,
    });
  });

  it('creates an OpenAI-compatible chat model with custom base URL and structured schema', async () => {
    const schema = z.object({ prompt: z.string().min(1) });

    const result = await generateStructuredObject({
      runtimeConfig: {
        provider: 'openai-compatible',
        apiKey: 'test-key',
        baseUrl: 'https://provider.example/v1/',
        model: 'review-model',
      },
      systemPrompt: 'Return one prompt.',
      userPrompt: 'Create a prompt.',
      schema,
      schemaName: 'starter_prompt',
      temperature: 0.7,
      maxOutputTokens: 500,
      timeoutMs: 1_000,
    });

    expect(mocks.createOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'test-key',
        baseURL: 'https://provider.example/v1',
        name: 'openai-compatible',
      }),
    );
    expect(mocks.openAiChat).toHaveBeenCalledWith('review-model');
    expect(mocks.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: { provider: 'openai-compatible', model: 'review-model' },
        system: expect.stringContaining('Return one prompt.\n\nReturn only a JSON object'),
        prompt: 'Create a prompt.',
        output: expect.objectContaining({ name: 'json' }),
        temperature: 0.7,
        maxOutputTokens: 500,
        maxRetries: 0,
        timeout: 1_000,
      }),
    );
    expect(result).toMatchObject({
      provider: 'openai-compatible',
      model: 'review-model',
      output: { prompt: 'Write about a memorable walk.' },
      providerDiagnostics: {
        finishReason: 'stop',
        usage: {
          inputTokens: 10,
          outputTokens: 8,
          totalTokens: 18,
        },
        responseId: 'response_1',
        responseModelId: 'model_1',
        failureKind: null,
      },
    });
    expect(result.rawOutput).toMatchObject({
      providerDiagnostics: {
        finishReason: 'stop',
        responseId: 'response_1',
      },
    });
  });

  it('creates an Anthropic model through the same structured generation boundary', async () => {
    const schema = z.object({ prompt: z.string().min(1) });

    await generateStructuredObject({
      runtimeConfig: {
        provider: 'anthropic',
        apiKey: 'test-key',
        model: 'claude-sonnet-4-6',
      },
      systemPrompt: 'Return one prompt.',
      userPrompt: 'Create a prompt.',
      schema,
      schemaName: 'starter_prompt',
      maxRetries: 1,
    });

    expect(mocks.createAnthropic).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'test-key',
      }),
    );
    expect(mocks.anthropicModel).toHaveBeenCalledWith('claude-sonnet-4-6');
    expect(mocks.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
        system: 'Return one prompt.',
        output: expect.objectContaining({ name: 'object' }),
        maxRetries: 1,
      }),
    );
  });

  it('passes provider options through to generateText and records reasoning diagnostics', async () => {
    const schema = z.object({ prompt: z.string().min(1) });

    const result = await generateStructuredObject({
      runtimeConfig: {
        provider: 'openai-compatible',
        apiKey: 'test-key',
        baseUrl: 'https://provider.example/v1',
        model: 'review-model',
      },
      systemPrompt: 'Return one prompt.',
      userPrompt: 'Create a prompt.',
      schema,
      schemaName: 'starter_prompt',
      providerOptions: {
        openai: {
          reasoningEffort: 'none',
        },
      },
    });

    expect(mocks.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        providerOptions: {
          openai: {
            reasoningEffort: 'none',
          },
        },
      }),
    );
    expect(result.providerDiagnostics).toMatchObject({
      reasoningEnabled: false,
      reasoningEffort: 'none',
      reasoningRequestedEffort: 'none',
      reasoningEffectiveEffort: 'none',
      reasoningFallbackUsed: false,
    });
  });

  it('retries once without reasoningEffort when OpenAI-compatible provider rejects none', async () => {
    const schema = z.object({ prompt: z.string().min(1) });
    const compatibilityError = new Error(
      'Failed to deserialize the JSON body into the target type: reasoning_effort: unknown variant `none`, expected one of high, low, medium, max, xhigh',
    );
    compatibilityError.name = 'AI_APICallError';
    mocks.generateText.mockRejectedValueOnce(compatibilityError);

    const result = await generateStructuredObject({
      runtimeConfig: {
        provider: 'openai-compatible',
        apiKey: 'test-key',
        baseUrl: 'https://provider.example/v1',
        model: 'review-model',
      },
      systemPrompt: 'Return one prompt.',
      userPrompt: 'Create a prompt.',
      schema,
      schemaName: 'starter_prompt',
      providerOptions: {
        openai: {
          reasoningEffort: 'none',
        },
      },
    });

    expect(mocks.generateText).toHaveBeenCalledTimes(2);
    expect(mocks.generateText.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        providerOptions: {
          openai: {
            reasoningEffort: 'none',
          },
        },
      }),
    );
    expect(mocks.generateText.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        providerOptions: undefined,
      }),
    );
    expect(result.providerDiagnostics).toMatchObject({
      reasoningEnabled: null,
      reasoningEffort: null,
      reasoningRequestedEffort: 'none',
      reasoningEffectiveEffort: null,
      reasoningFallbackUsed: true,
      reasoningFallbackReason: 'Provider rejected reasoningEffort none; retried without reasoningEffort.',
      warnings: ['Provider rejected reasoningEffort none; retried without reasoningEffort.'],
      failureKind: null,
    });
    expect(result.output).toEqual({ prompt: 'Write about a memorable walk.' });
  });

  it('classifies schema validation errors after provider completion', async () => {
    const schema = z.object({ prompt: z.string().min(1) });
    mocks.generateText.mockResolvedValueOnce({
      output: { prompt: '' },
      finishReason: 'stop',
      rawFinishReason: 'stop',
      usage: {
        inputTokens: 10,
        outputTokens: 8,
        totalTokens: 18,
        outputTokenDetails: { reasoningTokens: 6, textTokens: 2 },
      },
      warnings: undefined,
      request: {},
      response: { id: 'response_schema', modelId: 'review-model' },
      providerMetadata: undefined,
    });

    await expect(
      generateStructuredObject({
        runtimeConfig: {
          provider: 'openai-compatible',
          apiKey: 'test-key',
          baseUrl: 'https://provider.example/v1',
          model: 'review-model',
        },
        systemPrompt: 'Return one prompt.',
        userPrompt: 'Create a prompt.',
        schema,
        schemaName: 'starter_prompt',
        providerOptions: {
          openai: {
            reasoningEffort: 'medium',
          },
        },
      }),
    ).rejects.toMatchObject({
      providerDiagnostics: {
        finishReason: 'stop',
        responseId: 'response_schema',
        reasoningEnabled: true,
        reasoningEffort: 'medium',
        errorMessage: 'Provider output failed app validation.',
        failureKind: 'validation_failed',
      },
    });
  });

  it('attaches provider diagnostics when long reasoning exhausts output before JSON exists', async () => {
    const schema = z.object({ prompt: z.string().min(1) });
    const stepEvent = {
      finishReason: 'length',
      rawFinishReason: 'length',
      usage: {
        inputTokens: 123,
        outputTokens: 16_000,
        totalTokens: 16_123,
        outputTokenDetails: { reasoningTokens: 15_000, textTokens: 1_000 },
        inputTokenDetails: { cacheReadTokens: 12 },
      },
      warnings: [
        {
          type: 'provider-warning',
          message: 'Raw body included user writing Today I go home and api_key=sk-secret123456789.',
        },
      ],
      request: {},
      response: { id: 'response_length', modelId: 'deepseek-v4-flash' },
      providerMetadata: { deepseek: { finish: 'length' } },
    };
    mocks.generateText.mockImplementationOnce(async (options: { onStepFinish?: (event: typeof stepEvent) => void }) => {
      options.onStepFinish?.(stepEvent);
      const noOutputError = new Error('No output generated.');
      noOutputError.name = 'AI_NoOutputGeneratedError';

      return {
        ...stepEvent,
        get output(): unknown {
          throw noOutputError;
        },
      };
    });

    await expect(
      generateStructuredObject({
        runtimeConfig: {
          provider: 'openai-compatible',
          apiKey: 'test-key',
          baseUrl: 'https://api.deepseek.com/v1',
          model: 'deepseek-v4-flash',
        },
        systemPrompt: 'Return one prompt.',
        userPrompt: 'Create a prompt.',
        schema,
        schemaName: 'starter_prompt',
        maxOutputTokens: 16_000,
        timeoutMs: 240_000,
        providerOptions: {
          openai: {
            reasoningEffort: 'medium',
          },
        },
      }),
    ).rejects.toMatchObject({
      providerDiagnostics: {
        finishReason: 'length',
        rawFinishReason: 'length',
        usage: {
          inputTokens: 123,
          outputTokens: 16_000,
          totalTokens: 16_123,
          reasoningTokens: 15_000,
          textTokens: 1_000,
          cachedInputTokens: 12,
        },
        responseId: 'response_length',
        responseModelId: 'deepseek-v4-flash',
        providerMetadataKeys: ['deepseek'],
        warnings: ['provider-warning'],
        reasoningEnabled: true,
        reasoningEffort: 'medium',
        errorName: 'AI_NoOutputGeneratedError',
        errorMessage: 'Provider returned no usable output.',
        failureKind: 'no_output',
      },
    });
  });
});
