import { clearTimeout, setTimeout } from 'node:timers';
import { net } from 'electron';
import { reviewAgentResponseSchema, type ReviewAgent, type ReviewAgentResponse } from '../types';

const DEFAULT_REQUEST_TIMEOUT_MS = 60_000;

type ChatMessage = {
  role: 'system' | 'user';
  content: string;
};

type OpenAiCompatibleRequest = {
  model: string;
  messages: ChatMessage[];
  temperature: number;
  response_format: { type: 'json_object' };
  max_tokens: number;
};

type OpenAiCompatibleRuntimeConfig = {
  apiKey: string | null;
  baseUrl: string;
  model: string;
};

type OpenAiCompatibleAgentOptions = Partial<OpenAiCompatibleRuntimeConfig> & {
  fetchImpl?: typeof globalThis.fetch;
  timeoutMs?: number;
  getRuntimeConfig?: () => Promise<OpenAiCompatibleRuntimeConfig>;
};

function buildChatCompletionsUrl(baseUrl: string): string {
  const trimmedBaseUrl = baseUrl.trim().replace(/\/+$/, '');
  if (trimmedBaseUrl.endsWith('/chat/completions')) {
    return trimmedBaseUrl;
  }

  return `${trimmedBaseUrl}/chat/completions`;
}

function extractContent(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null || !('choices' in payload) || !Array.isArray(payload.choices)) {
    throw new Error('Provider response did not include chat completion choices.');
  }

  const firstChoice = payload.choices[0] as unknown;
  if (typeof firstChoice !== 'object' || firstChoice === null || !('message' in firstChoice)) {
    throw new Error('Provider response did not include a message.');
  }

  const message = firstChoice.message;
  if (typeof message !== 'object' || message === null || !('content' in message) || typeof message.content !== 'string') {
    throw new Error('Provider response message did not include JSON content.');
  }

  return message.content;
}

function parseJsonContent(content: string): ReviewAgentResponse {
  const trimmedContent = content.trim();
  const fencedJsonMatch = trimmedContent.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const jsonContent = fencedJsonMatch?.[1] ?? trimmedContent;

  try {
    return reviewAgentResponseSchema.parse({
      output: JSON.parse(jsonContent) as unknown,
      rawOutput: content,
    });
  } catch (error) {
    const message = error instanceof SyntaxError ? 'Provider returned invalid JSON.' : 'Provider JSON did not match the review response boundary.';
    throw new Error(message);
  }
}

async function loadDefaultRuntimeConfig(): Promise<OpenAiCompatibleRuntimeConfig> {
  const [{ getProviderApiKey }, { getSettingsSnapshot }] = await Promise.all([
    import('../../credentials/service'),
    import('../../settings/service'),
  ]);
  const settings = await getSettingsSnapshot();
  return {
    apiKey: await getProviderApiKey(),
    baseUrl: settings.baseUrl,
    model: settings.model,
  };
}

export function createOpenAiCompatibleReviewAgent(options: OpenAiCompatibleAgentOptions = {}): ReviewAgent {
  return async (request) => {
    const runtimeConfig = options.apiKey !== undefined && options.baseUrl && options.model
      ? { apiKey: options.apiKey, baseUrl: options.baseUrl, model: options.model }
      : await (options.getRuntimeConfig ?? loadDefaultRuntimeConfig)();
    const baseUrl = options.baseUrl ?? runtimeConfig.baseUrl;
    const model = options.model ?? runtimeConfig.model;
    const apiKey = options.apiKey ?? runtimeConfig.apiKey;

    if (!baseUrl || !model) {
      throw new Error('OpenAI-compatible provider base URL and model are required.');
    }

    if (!apiKey) {
      throw new Error('OpenAI-compatible provider API key is not configured. Add it in Settings before reviewing.');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS);
    const body: OpenAiCompatibleRequest = {
      model,
      messages: [
        { role: 'system', content: request.systemPrompt },
        { role: 'user', content: request.userPrompt },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
      max_tokens: 2_500,
    };

    try {
      const fetchImpl = options.fetchImpl ?? net.fetch;
      const response = await fetchImpl(buildChatCompletionsUrl(baseUrl), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        const detail = errorText.trim().slice(0, 300);
        throw new Error(detail ? `Provider review request failed (${response.status}): ${detail}` : `Provider review request failed (${response.status}).`);
      }

      const payload = (await response.json()) as unknown;
      return parseJsonContent(extractContent(payload));
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Provider review request timed out.');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  };
}

export const callOpenAiCompatibleReviewAgent: ReviewAgent = createOpenAiCompatibleReviewAgent();
