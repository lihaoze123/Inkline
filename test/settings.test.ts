import { describe, expect, it } from 'vitest';
import {
  deleteProviderApiKeyInputSchema,
  providerCredentialMutationResultSchema,
  providerCredentialStatusesSchema,
  setProviderApiKeyInputSchema,
} from '../src/shared/types/credentials';
import { IPC_CHANNELS } from '../src/shared/constants/channels';
import { aiModelSettingsSchema, providerConfigSchema, setDefaultProviderInputSchema, setProviderConfigInputSchema, settingsSnapshotSchema } from '../src/shared/types/settings';

describe('settings defaults contract', () => {
  it('keeps production raw response storage off by default', () => {
    const parsed = settingsSnapshotSchema.parse({
      providerId: 'openai-compatible',
      provider: 'OpenAI-compatible',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      isLocalModel: false,
      reviewContextDescription: 'Current entry and selected learning history will be sent when Review is clicked.',
      rawResponseStorageEnabled: false,
      databaseLocation: '/tmp/english-coach.sqlite',
      piMonoAuthStatus: 'not-configured',
      providerApiKeyStatus: 'not-configured',
      providerCredentialStatuses: {
        'openai-compatible': { providerId: 'openai-compatible', status: 'not-configured', storage: 'os-keychain' },
        anthropic: { providerId: 'anthropic', status: 'not-configured', storage: 'os-keychain' },
      },
      aiModelSettings: {
        defaultProviderId: 'openai-compatible',
        providers: {
          'openai-compatible': {
            providerId: 'openai-compatible',
            provider: 'OpenAI-compatible',
            baseUrl: 'https://api.openai.com/v1',
            model: 'gpt-4o-mini',
            isLocalModel: false,
            apiKeyStatus: { providerId: 'openai-compatible', status: 'not-configured', storage: 'os-keychain' },
          },
          anthropic: {
            providerId: 'anthropic',
            provider: 'Anthropic Claude',
            model: 'claude-sonnet-4-5',
            isLocalModel: false,
            apiKeyStatus: { providerId: 'anthropic', status: 'not-configured', storage: 'os-keychain' },
          },
        },
        featureOverrides: {},
      },
      ankiConnectStatus: 'reserved',
    });

    expect(parsed.rawResponseStorageEnabled).toBe(false);
  });

  it('accepts OpenAI-compatible provider configuration without exposing credentials', () => {
    const parsed = providerConfigSchema.parse({
      provider: 'OpenAI-compatible',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      isLocalModel: false,
    });

    expect(parsed.provider).toBe('OpenAI-compatible');
    expect('apiKey' in parsed).toBe(false);
  });

  it('accepts Anthropic provider configuration without exposing credentials', () => {
    const parsed = providerConfigSchema.parse({
      providerId: 'anthropic',
      provider: 'Anthropic Claude',
      model: 'claude-sonnet-4-5',
      isLocalModel: false,
    });

    expect(parsed.provider).toBe('Anthropic Claude');
    expect('apiKey' in parsed).toBe(false);
  });

  it('represents default provider and future feature-level model overrides', () => {
    const parsed = aiModelSettingsSchema.parse({
      defaultProviderId: 'openai-compatible',
      providers: {
        'openai-compatible': {
          providerId: 'openai-compatible',
          provider: 'OpenAI-compatible',
          baseUrl: 'https://provider.example/v1',
          model: 'review-model',
          isLocalModel: false,
          apiKeyStatus: { providerId: 'openai-compatible', status: 'configured', storage: 'os-keychain' },
        },
        anthropic: {
          providerId: 'anthropic',
          provider: 'Anthropic Claude',
          model: 'claude-sonnet-4-5',
          isLocalModel: false,
          apiKeyStatus: { providerId: 'anthropic', status: 'not-configured', storage: 'os-keychain' },
        },
      },
      featureOverrides: {
        starterPrompt: { providerId: 'anthropic', model: 'claude-sonnet-4-5' },
      },
    });

    expect(parsed.providers['openai-compatible'].provider).toBe('OpenAI-compatible');
    expect(parsed.featureOverrides.starterPrompt?.providerId).toBe('anthropic');
  });

  it('validates provider credential status maps for both first providers', () => {
    const parsed = providerCredentialStatusesSchema.parse({
      'openai-compatible': { providerId: 'openai-compatible', status: 'configured', storage: 'os-keychain' },
      anthropic: { providerId: 'anthropic', status: 'not-configured', storage: 'os-keychain' },
    });

    expect(parsed['openai-compatible'].status).toBe('configured');
    expect(parsed.anthropic.status).toBe('not-configured');
    expect(() => providerCredentialStatusesSchema.parse({
      'openai-compatible': { providerId: 'openai-compatible', status: 'configured', storage: 'os-keychain' },
    })).toThrow();
  });

  it('parses provider key deletion inputs for legacy and provider-aware callers', () => {
    expect(deleteProviderApiKeyInputSchema.parse(undefined)).toEqual({ providerId: 'openai-compatible' });
    expect(deleteProviderApiKeyInputSchema.parse('anthropic')).toBe('anthropic');
    expect(deleteProviderApiKeyInputSchema.parse({ providerId: 'anthropic' })).toEqual({ providerId: 'anthropic' });
  });

  it('validates provider config and default provider IPC inputs for both first providers', () => {
    const legacyOpenAiInput = setProviderConfigInputSchema.parse({
      baseUrl: ' https://provider.example/v1 ',
      model: ' custom-model ',
    });
    const anthropicInput = setProviderConfigInputSchema.parse({
      providerId: 'anthropic',
      model: ' claude-sonnet-4-5 ',
    });

    expect(legacyOpenAiInput).toEqual({
      baseUrl: 'https://provider.example/v1',
      model: 'custom-model',
    });
    expect(anthropicInput).toEqual({ providerId: 'anthropic', model: 'claude-sonnet-4-5' });
    expect(setDefaultProviderInputSchema.parse({ providerId: 'anthropic' })).toEqual({ providerId: 'anthropic' });
    expect(IPC_CHANNELS.SETTINGS.SET_DEFAULT_PROVIDER).toBe('settings:setDefaultProvider');
    expect(() => setDefaultProviderInputSchema.parse({ providerId: 'other-provider' })).toThrow();
  });

  it('validates provider key mutations as write-only renderer inputs', () => {
    expect(setProviderApiKeyInputSchema.parse({ apiKey: ' sk-test ' }).apiKey).toBe('sk-test');
    expect(setProviderApiKeyInputSchema.parse({ providerId: 'anthropic', apiKey: ' sk-ant ' }).providerId).toBe('anthropic');
    const result = providerCredentialMutationResultSchema.parse({
      success: true,
      status: { providerId: 'anthropic', status: 'configured', storage: 'os-keychain' },
      providerStatuses: {
        'openai-compatible': { providerId: 'openai-compatible', status: 'not-configured', storage: 'os-keychain' },
        anthropic: { providerId: 'anthropic', status: 'configured', storage: 'os-keychain' },
      },
    });

    expect(result.status?.status).toBe('configured');
    expect(result.providerStatuses?.anthropic.status).toBe('configured');
    expect('apiKey' in result).toBe(false);
  });
});
