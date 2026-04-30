import { net } from 'electron';
import { createAnthropic } from '@ai-sdk/anthropic';
import type { AnthropicProviderSettings } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import type { OpenAIProviderSettings } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import type { AiProviderRuntimeConfig } from './types';

type ProviderModel = {
  provider: AiProviderRuntimeConfig['provider'];
  model: string;
  languageModel: LanguageModel;
};

type AiSdkFetch = NonNullable<OpenAIProviderSettings['fetch'] | AnthropicProviderSettings['fetch']>;
type AiSdkFetchInput = Parameters<NonNullable<OpenAIProviderSettings['fetch']>>[0];
type AiSdkFetchInit = Parameters<NonNullable<OpenAIProviderSettings['fetch']>>[1];

const electronFetch: AiSdkFetch = async (input: AiSdkFetchInput, init: AiSdkFetchInit) => net.fetch(input instanceof URL ? input.toString() : input, init);

function normalizeOpenAiCompatibleBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

export function createAiProviderModel(config: AiProviderRuntimeConfig): ProviderModel {
  if (config.provider === 'openai-compatible') {
    const provider = createOpenAI({
      apiKey: config.apiKey,
      baseURL: normalizeOpenAiCompatibleBaseUrl(config.baseUrl),
      name: 'openai-compatible',
      fetch: electronFetch,
    });

    return {
      provider: config.provider,
      model: config.model,
      languageModel: provider.chat(config.model),
    };
  }

  const provider = createAnthropic({
    apiKey: config.apiKey,
    fetch: electronFetch,
  });

  return {
    provider: config.provider,
    model: config.model,
    languageModel: provider(config.model),
  };
}
