import { describe, expect, it } from 'vitest';
import {
  buildProviderReasoningOptions,
  extractReasoningDiagnosticsHint,
} from '../src/main/services/ai/reasoning-options';

describe('provider reasoning options', () => {
  it('uses documented DeepSeek thinking toggles', () => {
    const disabled = buildProviderReasoningOptions({
      providerId: 'deepseek',
      model: 'deepseek-chat',
      thinkingEnabled: false,
    });
    const enabled = buildProviderReasoningOptions({
      providerId: 'deepseek',
      model: 'deepseek-chat',
      thinkingEnabled: true,
    });

    expect(disabled).toEqual({ deepseek: { thinking: { type: 'disabled' } } });
    expect(enabled).toEqual({ deepseek: { thinking: { type: 'enabled' } } });
    expect(extractReasoningDiagnosticsHint(disabled)).toEqual({ reasoningEnabled: false, reasoningEffort: 'none' });
  });

  it('uses OpenAI none only for models that document it and minimizes other reasoning models', () => {
    expect(
      buildProviderReasoningOptions({
        providerId: 'openai',
        model: 'gpt-5.1',
        thinkingEnabled: false,
      }),
    ).toEqual({ openai: { reasoningEffort: 'none' } });
    expect(
      buildProviderReasoningOptions({
        providerId: 'openai',
        model: 'gpt-5',
        thinkingEnabled: false,
      }),
    ).toEqual({ openai: { reasoningEffort: 'minimal' } });
    expect(
      buildProviderReasoningOptions({
        providerId: 'openai',
        model: 'gpt-4o-mini',
        thinkingEnabled: false,
      }),
    ).toBeUndefined();
    expect(
      buildProviderReasoningOptions({
        providerId: 'openai',
        model: 'gpt-4o-mini',
        thinkingEnabled: true,
      }),
    ).toBeUndefined();
    expect(
      buildProviderReasoningOptions({
        providerId: 'openai',
        model: 'gpt-5',
        thinkingEnabled: true,
      }),
    ).toEqual({ openai: { reasoningEffort: 'medium' } });
  });

  it('uses provider-specific controls for Anthropic, Google, xAI, OpenRouter, and custom compatible endpoints', () => {
    expect(
      buildProviderReasoningOptions({
        providerId: 'anthropic',
        model: 'claude-sonnet-4-5',
        thinkingEnabled: false,
      }),
    ).toEqual({ anthropic: { effort: 'low' } });
    expect(
      buildProviderReasoningOptions({
        providerId: 'google',
        model: 'gemini-2.5-flash',
        thinkingEnabled: false,
      }),
    ).toEqual({ google: { thinkingConfig: { thinkingBudget: 0, includeThoughts: false } } });
    expect(
      buildProviderReasoningOptions({
        providerId: 'google',
        model: 'gemini-3-pro-preview',
        thinkingEnabled: false,
      }),
    ).toEqual({ google: { thinkingConfig: { thinkingLevel: 'low', includeThoughts: false } } });
    expect(
      buildProviderReasoningOptions({
        providerId: 'google',
        model: 'gemini-3-pro-preview',
        thinkingEnabled: true,
      }),
    ).toEqual({ google: { thinkingConfig: { thinkingLevel: 'high', includeThoughts: false } } });
    expect(
      buildProviderReasoningOptions({
        providerId: 'google',
        model: 'gemini-3-flash-preview',
        thinkingEnabled: true,
      }),
    ).toEqual({ google: { thinkingConfig: { thinkingLevel: 'medium', includeThoughts: false } } });
    expect(
      buildProviderReasoningOptions({
        providerId: 'xai',
        model: 'grok-4-fast-reasoning',
        thinkingEnabled: false,
      }),
    ).toEqual({ xai: { reasoningEffort: 'low' } });
    expect(
      buildProviderReasoningOptions({
        providerId: 'openrouter',
        model: 'anthropic/claude-sonnet-4.5',
        thinkingEnabled: false,
      }),
    ).toEqual({ openrouter: { reasoning: { effort: 'none', exclude: true } } });
    expect(
      buildProviderReasoningOptions({
        providerId: 'openai-compatible',
        model: 'provider-model',
        thinkingEnabled: false,
      }),
    ).toEqual({ openaiCompatible: { reasoningEffort: 'none' } });
    const deepSeekCompatibleOptions = buildProviderReasoningOptions({
      providerId: 'openai-compatible',
      baseUrl: 'https://api.deepseek.com/v1',
      model: 'deepseek-v4-flash',
      thinkingEnabled: false,
    });

    expect(deepSeekCompatibleOptions).toEqual({ openaiCompatible: { thinking: { type: 'disabled' } } });
    expect(extractReasoningDiagnosticsHint(deepSeekCompatibleOptions)).toEqual({
      reasoningEnabled: false,
      reasoningEffort: 'none',
    });
  });
});
