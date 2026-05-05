import { net } from 'electron';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createXai } from '@ai-sdk/xai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { FetchFunction } from '@ai-sdk/provider-utils';
import type { LanguageModel } from 'ai';
import { normalizeOpenAiCompatibleBaseUrl } from './openai-compatible';
import type { AiProviderRuntimeConfig } from './types';

type ProviderModel = {
  provider: AiProviderRuntimeConfig['provider'];
  model: string;
  languageModel: LanguageModel;
};

const electronFetch: FetchFunction = async (input, init) =>
  net.fetch(input instanceof URL ? input.toString() : input, init);

export function createAiProviderModel(config: AiProviderRuntimeConfig): ProviderModel {
  switch (config.provider) {
    case 'openai': {
      const provider = createOpenAI({
        apiKey: config.apiKey,
        fetch: electronFetch,
      });

      return {
        provider: config.provider,
        model: config.model,
        languageModel: provider(config.model),
      };
    }
    case 'deepseek': {
      const provider = createDeepSeek({
        apiKey: config.apiKey,
        fetch: electronFetch,
      });

      return {
        provider: config.provider,
        model: config.model,
        languageModel: provider(config.model),
      };
    }
    case 'anthropic': {
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
    case 'google': {
      const provider = createGoogleGenerativeAI({
        apiKey: config.apiKey,
        fetch: electronFetch,
      });

      return {
        provider: config.provider,
        model: config.model,
        languageModel: provider(config.model),
      };
    }
    case 'xai': {
      const provider = createXai({
        apiKey: config.apiKey,
        fetch: electronFetch,
      });

      return {
        provider: config.provider,
        model: config.model,
        languageModel: provider(config.model),
      };
    }
    case 'openrouter': {
      const provider = createOpenRouter({
        apiKey: config.apiKey,
        appName: 'Inkline',
        fetch: electronFetch,
      });

      return {
        provider: config.provider,
        model: config.model,
        languageModel: provider.chat(config.model),
      };
    }
    case 'openai-compatible': {
      const provider = createOpenAICompatible({
        apiKey: config.apiKey,
        baseURL: normalizeOpenAiCompatibleBaseUrl(config.baseUrl),
        name: 'openai-compatible',
        fetch: electronFetch,
      });

      return {
        provider: config.provider,
        model: config.model,
        languageModel: provider.chatModel(config.model),
      };
    }
  }
}
