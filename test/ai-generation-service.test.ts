import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

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

vi.mock('ai', () => ({
  generateText: mocks.generateText,
  Output: {
    object: vi.fn(() => ({ name: 'object' })),
  },
}));

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

    expect(mocks.createOpenAI).toHaveBeenCalledWith(expect.objectContaining({
      apiKey: 'test-key',
      baseURL: 'https://provider.example/v1',
      name: 'openai-compatible',
    }));
    expect(mocks.openAiChat).toHaveBeenCalledWith('review-model');
    expect(mocks.generateText).toHaveBeenCalledWith(expect.objectContaining({
      model: { provider: 'openai-compatible', model: 'review-model' },
      system: 'Return one prompt.',
      prompt: 'Create a prompt.',
      output: expect.objectContaining({ name: 'object' }),
      temperature: 0.7,
      maxOutputTokens: 500,
      maxRetries: 0,
      timeout: 1_000,
    }));
    expect(result).toMatchObject({
      provider: 'openai-compatible',
      model: 'review-model',
      output: { prompt: 'Write about a memorable walk.' },
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

    expect(mocks.createAnthropic).toHaveBeenCalledWith(expect.objectContaining({
      apiKey: 'test-key',
    }));
    expect(mocks.anthropicModel).toHaveBeenCalledWith('claude-sonnet-4-6');
    expect(mocks.generateText).toHaveBeenCalledWith(expect.objectContaining({
      model: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
      maxRetries: 1,
    }));
  });
});
