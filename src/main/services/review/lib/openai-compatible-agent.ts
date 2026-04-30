import { reviewOutputSchema } from '../../../../shared/review-contract/schemas';
import { generateStructuredObject, type AiProviderRuntimeConfig } from '../../ai';
import { buildAiRuntimeConfigForFeature } from '../../ai/runtime-config';
import { reviewAgentResponseSchema, type ReviewAgent, type ReviewAgentResponse } from '../types';

const DEFAULT_REQUEST_TIMEOUT_MS = 60_000;

type OpenAiCompatibleRuntimeConfig = {
  provider: 'openai-compatible';
  apiKey: string | null;
  baseUrl: string;
  model: string;
};

type ReviewStructuredGeneration = <Output>(
  input: Parameters<typeof generateStructuredObject<Output>>[0],
) => Promise<Awaited<ReturnType<typeof generateStructuredObject<Output>>>>;

type OpenAiCompatibleAgentOptions = Partial<Omit<OpenAiCompatibleRuntimeConfig, 'provider'>> & {
  apiKey?: string | null;
  timeoutMs?: number;
  getRuntimeConfig?: () => Promise<AiProviderRuntimeConfig>;
  generateStructured?: ReviewStructuredGeneration;
};

async function loadDefaultRuntimeConfig(): Promise<AiProviderRuntimeConfig> {
  return buildAiRuntimeConfigForFeature('review');
}

function buildRuntimeConfigFromOptions(
  options: OpenAiCompatibleAgentOptions,
  runtimeConfig: AiProviderRuntimeConfig | OpenAiCompatibleRuntimeConfig,
): AiProviderRuntimeConfig {
  if (runtimeConfig.provider !== 'openai-compatible') {
    return runtimeConfig;
  }

  const baseUrl = options.baseUrl ?? runtimeConfig.baseUrl;
  const model = options.model ?? runtimeConfig.model;
  const apiKey = options.apiKey ?? runtimeConfig.apiKey;

  if (!baseUrl || !model) {
    throw new Error('OpenAI-compatible provider base URL and model are required.');
  }

  if (!apiKey) {
    throw new Error('OpenAI-compatible provider API key is not configured. Add it in Settings before reviewing.');
  }

  return {
    provider: 'openai-compatible',
    apiKey,
    baseUrl,
    model,
  };
}

export function createOpenAiCompatibleReviewAgent(options: OpenAiCompatibleAgentOptions = {}): ReviewAgent {
  return async (request): Promise<ReviewAgentResponse> => {
    const runtimeConfig =
      options.apiKey !== undefined && options.baseUrl && options.model
        ? {
            provider: 'openai-compatible' as const,
            apiKey: options.apiKey,
            baseUrl: options.baseUrl,
            model: options.model,
          }
        : await (options.getRuntimeConfig ?? loadDefaultRuntimeConfig)();
    const generation = options.generateStructured ?? generateStructuredObject;
    const result = await generation({
      runtimeConfig: buildRuntimeConfigFromOptions(options, runtimeConfig),
      systemPrompt: request.systemPrompt,
      userPrompt: request.userPrompt,
      schema: reviewOutputSchema,
      schemaName: 'review_output',
      schemaDescription: 'Structured English writing review output matching the app review contract.',
      temperature: 0.2,
      maxOutputTokens: 2_500,
      timeoutMs: options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
      maxRetries: 0,
    });

    return reviewAgentResponseSchema.parse({
      output: result.output,
      rawOutput: result.rawOutput,
    });
  };
}

export const callOpenAiCompatibleReviewAgent: ReviewAgent = createOpenAiCompatibleReviewAgent();
