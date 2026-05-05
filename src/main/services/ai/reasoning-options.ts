import type { ProviderOptions } from '@ai-sdk/provider-utils';
import { aiReasoningEffortSchema, type AiReasoningEffort } from '../../../shared/types/ai';
import type { AiProviderId } from '../../../shared/types/credentials';

export const DISABLED_REASONING_EFFORT: AiReasoningEffort = 'none';
export const ENABLED_REASONING_EFFORT: AiReasoningEffort = 'medium';

type BuildProviderReasoningOptionsInput = {
  providerId: AiProviderId;
  model: string;
  thinkingEnabled: boolean;
  baseUrl?: string | null;
};

type ReasoningDiagnosticsHint = {
  reasoningEnabled: boolean;
  reasoningEffort: AiReasoningEffort;
};

export function buildProviderReasoningOptions({
  providerId,
  model,
  thinkingEnabled,
  baseUrl,
}: BuildProviderReasoningOptionsInput): ProviderOptions | undefined {
  switch (providerId) {
    case 'openai':
      return buildOpenAiReasoningOptions(model, thinkingEnabled);
    case 'deepseek':
      return {
        deepseek: {
          thinking: { type: thinkingEnabled ? 'enabled' : 'disabled' },
        },
      };
    case 'anthropic':
      return {
        anthropic: {
          effort: thinkingEnabled ? ENABLED_REASONING_EFFORT : 'low',
        },
      };
    case 'google':
      return buildGoogleReasoningOptions(model, thinkingEnabled);
    case 'xai':
      return buildXaiReasoningOptions(model, thinkingEnabled);
    case 'openrouter':
      return {
        openrouter: {
          reasoning: {
            effort: thinkingEnabled ? ENABLED_REASONING_EFFORT : DISABLED_REASONING_EFFORT,
            exclude: !thinkingEnabled,
          },
        },
      };
    case 'openai-compatible':
      if (isDeepSeekCompatibleEndpoint({ baseUrl, model })) {
        return {
          openaiCompatible: {
            thinking: { type: thinkingEnabled ? 'enabled' : 'disabled' },
          },
        };
      }

      return {
        openaiCompatible: {
          reasoningEffort: thinkingEnabled ? ENABLED_REASONING_EFFORT : DISABLED_REASONING_EFFORT,
        },
      };
  }
}

export function extractReasoningDiagnosticsHint(
  providerOptions: ProviderOptions | undefined,
): ReasoningDiagnosticsHint | null {
  const openAiEffort = extractReasoningEffort(providerOptions?.openai);
  if (openAiEffort) {
    return effortToDiagnosticsHint(openAiEffort);
  }

  const openAiCompatibleEffort =
    extractOpenAiCompatibleReasoningHint(providerOptions?.openaiCompatible) ??
    extractOpenAiCompatibleReasoningHint(providerOptions?.['openai-compatible']);
  if (openAiCompatibleEffort) {
    return openAiCompatibleEffort;
  }

  const deepSeekThinking = stringProperty(toRecord(providerOptions?.deepseek)?.thinking, 'type');
  if (deepSeekThinking === 'disabled') {
    return effortToDiagnosticsHint(DISABLED_REASONING_EFFORT);
  }
  if (deepSeekThinking === 'enabled') {
    return effortToDiagnosticsHint(ENABLED_REASONING_EFFORT);
  }

  const anthropicOptions = toRecord(providerOptions?.anthropic);
  const anthropicThinking = stringProperty(anthropicOptions?.thinking, 'type');
  if (anthropicThinking === 'disabled') {
    return effortToDiagnosticsHint(DISABLED_REASONING_EFFORT);
  }
  const anthropicEffort = extractReasoningEffort(anthropicOptions);
  if (anthropicEffort) {
    return effortToDiagnosticsHint(anthropicEffort);
  }

  const googleThinkingConfig = toRecord(toRecord(providerOptions?.google)?.thinkingConfig);
  const googleBudget = numberProperty(googleThinkingConfig, 'thinkingBudget');
  if (googleBudget === 0) {
    return effortToDiagnosticsHint(DISABLED_REASONING_EFFORT);
  }
  const googleThinkingLevel = extractReasoningEffortFromValue(googleThinkingConfig?.thinkingLevel);
  if (googleThinkingLevel) {
    return effortToDiagnosticsHint(googleThinkingLevel);
  }
  if (googleBudget !== null && googleBudget > 0) {
    return effortToDiagnosticsHint(ENABLED_REASONING_EFFORT);
  }

  const xaiEffort = extractReasoningEffort(providerOptions?.xai);
  if (xaiEffort) {
    return effortToDiagnosticsHint(xaiEffort);
  }

  const openRouterReasoning = toRecord(toRecord(providerOptions?.openrouter)?.reasoning);
  const openRouterEffort = extractReasoningEffortFromValue(openRouterReasoning?.effort);
  if (openRouterEffort) {
    return effortToDiagnosticsHint(openRouterEffort);
  }

  return null;
}

function buildOpenAiReasoningOptions(model: string, thinkingEnabled: boolean): ProviderOptions | undefined {
  if (thinkingEnabled) {
    if (!isLikelyOpenAiReasoningModel(model)) {
      return undefined;
    }

    return {
      openai: {
        reasoningEffort: ENABLED_REASONING_EFFORT,
      },
    };
  }

  if (isOpenAiNoneReasoningModel(model)) {
    return {
      openai: {
        reasoningEffort: DISABLED_REASONING_EFFORT,
      },
    };
  }

  if (!isLikelyOpenAiReasoningModel(model)) {
    return undefined;
  }

  return {
    openai: {
      reasoningEffort: 'minimal',
    },
  };
}

function buildGoogleReasoningOptions(model: string, thinkingEnabled: boolean): ProviderOptions {
  if (isGeminiThreeModel(model)) {
    return {
      google: {
        thinkingConfig: {
          thinkingLevel: geminiThreeThinkingLevel(model, thinkingEnabled),
          includeThoughts: false,
        },
      },
    };
  }

  return {
    google: {
      thinkingConfig: {
        thinkingBudget: thinkingEnabled ? 8192 : 0,
        includeThoughts: false,
      },
    },
  };
}

function buildXaiReasoningOptions(model: string, thinkingEnabled: boolean): ProviderOptions | undefined {
  if (!thinkingEnabled && model.toLowerCase().includes('non-reasoning')) {
    return undefined;
  }

  return {
    xai: {
      reasoningEffort: thinkingEnabled ? 'high' : 'low',
    },
  };
}

function isOpenAiNoneReasoningModel(model: string): boolean {
  return /^gpt-5\.1(?:-|$)/i.test(model.trim());
}

function isLikelyOpenAiReasoningModel(model: string): boolean {
  const normalized = model.trim().toLowerCase();
  return normalized.startsWith('gpt-5') || /^o\d/.test(normalized);
}

function isGeminiThreeModel(model: string): boolean {
  return /^gemini-3(?:\.|-|$)/i.test(model.trim());
}

function geminiThreeThinkingLevel(model: string, thinkingEnabled: boolean): 'minimal' | 'low' | 'medium' | 'high' {
  const normalized = model.trim().toLowerCase();
  if (!thinkingEnabled) {
    return normalized.includes('flash') ? 'minimal' : 'low';
  }

  return normalized.startsWith('gemini-3.1') || normalized.includes('flash') ? 'medium' : 'high';
}

function isDeepSeekCompatibleEndpoint({ baseUrl, model }: { baseUrl?: string | null; model: string }): boolean {
  const normalizedBaseUrl = baseUrl?.trim().toLowerCase() ?? '';
  const normalizedModel = model.trim().toLowerCase();
  return normalizedBaseUrl.includes('deepseek.com') || normalizedModel.startsWith('deepseek-');
}

function effortToDiagnosticsHint(reasoningEffort: AiReasoningEffort): ReasoningDiagnosticsHint {
  return {
    reasoningEnabled: reasoningEffort !== DISABLED_REASONING_EFFORT,
    reasoningEffort,
  };
}

function extractReasoningEffort(value: unknown): AiReasoningEffort | null {
  return extractReasoningEffortFromValue(toRecord(value)?.reasoningEffort ?? toRecord(value)?.effort);
}

function extractOpenAiCompatibleReasoningHint(value: unknown): ReasoningDiagnosticsHint | null {
  const options = toRecord(value);
  const thinking = stringProperty(options?.thinking, 'type');
  if (thinking === 'disabled') {
    return effortToDiagnosticsHint(DISABLED_REASONING_EFFORT);
  }
  if (thinking === 'enabled') {
    return effortToDiagnosticsHint(ENABLED_REASONING_EFFORT);
  }

  const effort = extractReasoningEffort(options);
  return effort ? effortToDiagnosticsHint(effort) : null;
}

function extractReasoningEffortFromValue(value: unknown): AiReasoningEffort | null {
  const parseResult = aiReasoningEffortSchema.safeParse(value);
  return parseResult.success ? parseResult.data : null;
}

function stringProperty(value: unknown, key: string): string | null {
  const record = toRecord(value);
  const property = record?.[key];
  return typeof property === 'string' ? property : null;
}

function numberProperty(value: unknown, key: string): number | null {
  const record = toRecord(value);
  const property = record?.[key];
  return typeof property === 'number' && Number.isFinite(property) ? property : null;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}
