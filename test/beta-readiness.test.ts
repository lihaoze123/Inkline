import { describe, expect, it } from 'vitest';
import {
  deriveBetaReadinessDiagnostics,
  type BetaReadinessDiagnostics,
  type BetaReadinessRow,
  type BetaReadinessRowId,
} from '../src/shared/diagnostics/beta-readiness';
import type { StartupStatus } from '../src/shared/types/app';
import type {
  AiProviderId,
  ProviderCredentialStatuses,
  ProviderKeyStatus,
  ProviderKeyStatusValue,
} from '../src/shared/types/credentials';
import type { AiProviderSettingsMap, SettingsSnapshot } from '../src/shared/types/settings';

const DEFAULT_PROVIDER_MODELS: Record<AiProviderId, string> = {
  openai: 'gpt-4o-mini',
  deepseek: 'deepseek-chat',
  anthropic: 'claude-sonnet-4-5',
  google: 'gemini-2.5-flash',
  xai: 'grok-4-fast-non-reasoning',
  openrouter: 'openai/gpt-4o-mini',
  'openai-compatible': 'custom-review-model',
};

function providerStatus<T extends AiProviderId>(
  providerId: T,
  status: ProviderKeyStatusValue = 'not-configured',
): ProviderKeyStatus & { providerId: T } {
  return { providerId, status, storage: 'os-keychain' };
}

function allProviderCredentialStatuses(
  overrides: Partial<ProviderCredentialStatuses> = {},
): ProviderCredentialStatuses {
  return {
    openai: providerStatus('openai'),
    deepseek: providerStatus('deepseek'),
    anthropic: providerStatus('anthropic'),
    google: providerStatus('google'),
    xai: providerStatus('xai'),
    openrouter: providerStatus('openrouter'),
    'openai-compatible': providerStatus('openai-compatible', 'configured'),
    ...overrides,
  };
}

function allProviderSettings({
  providerModels = DEFAULT_PROVIDER_MODELS,
  credentialStatuses = allProviderCredentialStatuses(),
  openAiCompatibleBaseUrl = 'https://provider.example/v1',
}: {
  providerModels?: Record<AiProviderId, string>;
  credentialStatuses?: ProviderCredentialStatuses;
  openAiCompatibleBaseUrl?: string;
} = {}): AiProviderSettingsMap {
  return {
    openai: {
      providerId: 'openai',
      provider: 'OpenAI',
      model: providerModels.openai,
      isLocalModel: false,
      apiKeyStatus: credentialStatuses.openai,
    },
    deepseek: {
      providerId: 'deepseek',
      provider: 'DeepSeek',
      model: providerModels.deepseek,
      isLocalModel: false,
      apiKeyStatus: credentialStatuses.deepseek,
    },
    anthropic: {
      providerId: 'anthropic',
      provider: 'Anthropic Claude',
      model: providerModels.anthropic,
      isLocalModel: false,
      apiKeyStatus: credentialStatuses.anthropic,
    },
    google: {
      providerId: 'google',
      provider: 'Google Gemini',
      model: providerModels.google,
      isLocalModel: false,
      apiKeyStatus: credentialStatuses.google,
    },
    xai: {
      providerId: 'xai',
      provider: 'xAI Grok',
      model: providerModels.xai,
      isLocalModel: false,
      apiKeyStatus: credentialStatuses.xai,
    },
    openrouter: {
      providerId: 'openrouter',
      provider: 'OpenRouter',
      model: providerModels.openrouter,
      isLocalModel: false,
      apiKeyStatus: credentialStatuses.openrouter,
    },
    'openai-compatible': {
      providerId: 'openai-compatible',
      provider: 'Custom OpenAI-compatible',
      baseUrl: openAiCompatibleBaseUrl,
      model: providerModels['openai-compatible'],
      isLocalModel: false,
      apiKeyStatus: credentialStatuses['openai-compatible'],
    },
  };
}

function makeStartup(overrides: Partial<StartupStatus> = {}): StartupStatus {
  return {
    databaseReady: true,
    databaseLocation: '/tmp/Inkline.sqlite',
    migrationsApplied: true,
    timeZone: 'UTC',
    timeZoneOffsetMinutes: 0,
    ...overrides,
  };
}

function makeSettings({
  defaultProviderId = 'openai-compatible',
  providerModelOverrides = {},
  credentialOverrides = {},
  openAiCompatibleBaseUrl = 'https://provider.example/v1',
}: {
  defaultProviderId?: AiProviderId;
  providerModelOverrides?: Partial<Record<AiProviderId, string>>;
  credentialOverrides?: Partial<ProviderCredentialStatuses>;
  openAiCompatibleBaseUrl?: string;
} = {}): SettingsSnapshot {
  const providerModels: Record<AiProviderId, string> = {
    ...DEFAULT_PROVIDER_MODELS,
    ...providerModelOverrides,
  };
  const credentialStatuses = allProviderCredentialStatuses(credentialOverrides);
  const providers = allProviderSettings({
    providerModels,
    credentialStatuses,
    openAiCompatibleBaseUrl,
  });
  const selectedProvider = providers[defaultProviderId];

  return {
    providerId: defaultProviderId,
    provider: selectedProvider.provider,
    baseUrl: defaultProviderId === 'openai-compatible' ? openAiCompatibleBaseUrl : 'https://provider.example/v1',
    model: selectedProvider.model,
    isLocalModel: selectedProvider.isLocalModel,
    reviewContextDescription: 'Current entry and selected learning history will be sent when Review is clicked.',
    rawResponseStorageEnabled: false,
    reviewThinkingEnabled: false,
    onboardingIntroVersionSeen: 0,
    databaseLocation: '/tmp/Inkline.sqlite',
    piMonoAuthStatus: 'not-configured',
    providerApiKeyStatus: selectedProvider.apiKeyStatus.status,
    providerCredentialStatuses: credentialStatuses,
    aiModelSettings: {
      defaultProviderId,
      providers,
      featureOverrides: {},
    },
    ankiConnectStatus: 'reserved',
  };
}

function getRow(diagnostics: BetaReadinessDiagnostics, rowId: BetaReadinessRowId): BetaReadinessRow {
  const row = diagnostics.rows.find((candidate) => candidate.id === rowId);
  if (!row) {
    throw new Error(`Missing beta readiness row: ${rowId}`);
  }
  return row;
}

describe('beta readiness diagnostics', () => {
  it('derives an all-ready state without implying a live provider request succeeded', () => {
    const diagnostics = deriveBetaReadinessDiagnostics({
      startup: makeStartup(),
      settings: makeSettings(),
    });

    expect(diagnostics.status).toBe('ready');
    expect(diagnostics.label).toBe('Configuration ready');
    expect(getRow(diagnostics, 'database')).toMatchObject({ status: 'ready', value: '/tmp/Inkline.sqlite' });
    expect(getRow(diagnostics, 'migrations')).toMatchObject({ status: 'ready', value: 'Applied' });
    expect(getRow(diagnostics, 'model')).toMatchObject({ status: 'ready', value: 'custom-review-model' });
    expect(getRow(diagnostics, 'base_url')).toMatchObject({
      status: 'ready',
      value: 'https://provider.example/v1',
    });
    expect(getRow(diagnostics, 'keychain')).toMatchObject({ status: 'ready', value: 'Configured in OS keychain' });
    expect(getRow(diagnostics, 'validation')).toMatchObject({
      status: 'ready',
      detail: 'Diagnostics do not run a live provider request.',
    });
  });

  it('marks a missing selected model as setup-needed with a next action', () => {
    const diagnostics = deriveBetaReadinessDiagnostics({
      startup: makeStartup(),
      settings: makeSettings({
        providerModelOverrides: {
          'openai-compatible': '',
        },
      }),
    });

    expect(diagnostics.status).toBe('needs_setup');
    expect(getRow(diagnostics, 'model')).toMatchObject({
      status: 'needs_setup',
      value: 'Missing',
      action: 'Save a model ID for Custom OpenAI-compatible.',
    });
  });

  it('marks a missing OpenAI-compatible base URL as setup-needed with a next action', () => {
    const diagnostics = deriveBetaReadinessDiagnostics({
      startup: makeStartup(),
      settings: makeSettings({
        openAiCompatibleBaseUrl: '',
      }),
    });

    expect(diagnostics.status).toBe('needs_setup');
    expect(getRow(diagnostics, 'base_url')).toMatchObject({
      status: 'needs_setup',
      value: 'Missing',
      action: 'Add the custom OpenAI-compatible base URL.',
    });
  });

  it('marks a missing selected provider key as setup-needed without exposing key material', () => {
    const diagnostics = deriveBetaReadinessDiagnostics({
      startup: makeStartup(),
      settings: makeSettings({
        credentialOverrides: {
          'openai-compatible': providerStatus('openai-compatible', 'not-configured'),
        },
      }),
    });

    expect(diagnostics.status).toBe('needs_setup');
    expect(getRow(diagnostics, 'keychain')).toMatchObject({
      status: 'needs_setup',
      value: 'Not configured in OS keychain',
      action: 'Save an API key for Custom OpenAI-compatible.',
    });
    expect(JSON.stringify(diagnostics)).not.toContain('sk-');
  });

  it('distinguishes unavailable keychain state from missing credentials', () => {
    const diagnostics = deriveBetaReadinessDiagnostics({
      startup: makeStartup(),
      settings: makeSettings({
        credentialOverrides: {
          'openai-compatible': providerStatus('openai-compatible', 'unavailable'),
        },
      }),
    });

    expect(diagnostics.status).toBe('unavailable');
    expect(getRow(diagnostics, 'keychain')).toMatchObject({
      status: 'unavailable',
      value: 'OS keychain unavailable',
      action: 'Check OS keychain access, then save the API key again.',
    });
  });

  it('marks database and migration failures as unavailable', () => {
    const diagnostics = deriveBetaReadinessDiagnostics({
      startup: makeStartup({
        databaseReady: false,
        migrationsApplied: false,
      }),
      settings: makeSettings(),
    });

    expect(diagnostics.status).toBe('unavailable');
    expect(getRow(diagnostics, 'database')).toMatchObject({
      status: 'unavailable',
      action: 'Restart Inkline and check access to the local database file.',
    });
    expect(getRow(diagnostics, 'migrations')).toMatchObject({
      status: 'unavailable',
      value: 'Not applied',
      action: 'Restart Inkline so local migrations can run.',
    });
  });

  it('distinguishes migration failure from database availability', () => {
    const diagnostics = deriveBetaReadinessDiagnostics({
      startup: makeStartup({
        databaseReady: true,
        migrationsApplied: false,
      }),
      settings: makeSettings(),
    });

    expect(diagnostics.status).toBe('unavailable');
    expect(getRow(diagnostics, 'database')).toMatchObject({
      status: 'ready',
      value: '/tmp/Inkline.sqlite',
    });
    expect(getRow(diagnostics, 'migrations')).toMatchObject({
      status: 'unavailable',
      value: 'Not applied',
      action: 'Restart Inkline so local migrations can run.',
    });
  });

  it('does not require a custom base URL for hosted providers', () => {
    const diagnostics = deriveBetaReadinessDiagnostics({
      startup: makeStartup(),
      settings: makeSettings({
        defaultProviderId: 'anthropic',
        credentialOverrides: {
          anthropic: providerStatus('anthropic', 'configured'),
        },
      }),
    });

    expect(getRow(diagnostics, 'base_url')).toMatchObject({
      status: 'info',
      value: 'Not required for hosted provider',
    });
  });
});
