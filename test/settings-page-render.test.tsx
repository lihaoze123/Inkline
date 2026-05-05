import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { StartupStatus } from '../src/shared/types/app';
import type {
  AiProviderId,
  ProviderCredentialStatuses,
  ProviderKeyStatus,
  ProviderKeyStatusValue,
} from '../src/shared/types/credentials';
import type { AiProviderSettingsMap, SettingsSnapshot } from '../src/shared/types/settings';

vi.mock('@shared/types/credentials', async () => import('../src/shared/types/credentials'));

function providerStatus<T extends AiProviderId>(
  providerId: T,
  status: ProviderKeyStatusValue = 'not-configured',
): ProviderKeyStatus & { providerId: T } {
  return { providerId, status, storage: 'os-keychain' };
}

const DEFAULT_PROVIDER_MODEL_INPUTS: Record<AiProviderId, string> = {
  openai: 'gpt-4o-mini',
  deepseek: 'deepseek-chat',
  anthropic: 'claude-sonnet-4-5',
  google: 'gemini-2.5-flash',
  xai: 'grok-4-fast-non-reasoning',
  openrouter: 'openai/gpt-4o-mini',
  'openai-compatible': 'custom-model',
};

function allProviderCredentialStatuses(): ProviderCredentialStatuses {
  return {
    openai: providerStatus('openai'),
    deepseek: providerStatus('deepseek'),
    anthropic: providerStatus('anthropic', 'configured'),
    google: providerStatus('google'),
    xai: providerStatus('xai'),
    openrouter: providerStatus('openrouter'),
    'openai-compatible': providerStatus('openai-compatible', 'configured'),
  };
}

function allProviderSettings(
  providerModelInputs: Record<AiProviderId, string> = DEFAULT_PROVIDER_MODEL_INPUTS,
): AiProviderSettingsMap {
  return {
    openai: {
      providerId: 'openai' as const,
      provider: 'OpenAI',
      model: providerModelInputs.openai,
      isLocalModel: false,
      apiKeyStatus: providerStatus('openai'),
    },
    deepseek: {
      providerId: 'deepseek' as const,
      provider: 'DeepSeek',
      model: providerModelInputs.deepseek,
      isLocalModel: false,
      apiKeyStatus: providerStatus('deepseek'),
    },
    anthropic: {
      providerId: 'anthropic' as const,
      provider: 'Anthropic Claude',
      model: providerModelInputs.anthropic,
      isLocalModel: false,
      apiKeyStatus: providerStatus('anthropic', 'configured'),
    },
    google: {
      providerId: 'google' as const,
      provider: 'Google Gemini',
      model: providerModelInputs.google,
      isLocalModel: false,
      apiKeyStatus: providerStatus('google'),
    },
    xai: {
      providerId: 'xai' as const,
      provider: 'xAI Grok',
      model: providerModelInputs.xai,
      isLocalModel: false,
      apiKeyStatus: providerStatus('xai'),
    },
    openrouter: {
      providerId: 'openrouter' as const,
      provider: 'OpenRouter',
      model: providerModelInputs.openrouter,
      isLocalModel: false,
      apiKeyStatus: providerStatus('openrouter'),
    },
    'openai-compatible': {
      providerId: 'openai-compatible' as const,
      provider: 'Custom OpenAI-compatible',
      baseUrl: 'https://provider.example/v1',
      model: providerModelInputs['openai-compatible'],
      isLocalModel: false,
      apiKeyStatus: providerStatus('openai-compatible', 'configured'),
    },
  };
}

function makeSettings(
  defaultProviderId: AiProviderId,
  providerModelInputs: Record<AiProviderId, string> = DEFAULT_PROVIDER_MODEL_INPUTS,
): SettingsSnapshot {
  const providers = allProviderSettings(providerModelInputs);
  const selectedProvider = providers[defaultProviderId];

  return {
    providerId: defaultProviderId,
    provider: selectedProvider.provider,
    baseUrl:
      defaultProviderId === 'openai-compatible'
        ? providers['openai-compatible'].baseUrl
        : 'https://provider.example/v1',
    model: selectedProvider.model,
    isLocalModel: selectedProvider.isLocalModel,
    reviewContextDescription: 'Current entry and selected learning history will be sent when Review is clicked.',
    rawResponseStorageEnabled: false,
    reviewThinkingEnabled: false,
    onboardingIntroVersionSeen: 0,
    databaseLocation: '/tmp/Inkline.sqlite',
    piMonoAuthStatus: 'not-configured',
    providerApiKeyStatus: selectedProvider.apiKeyStatus.status,
    providerCredentialStatuses: allProviderCredentialStatuses(),
    aiModelSettings: {
      defaultProviderId,
      providers,
      featureOverrides: {},
    },
    ankiConnectStatus: 'reserved',
  };
}

async function renderSettingsPage(
  defaultProviderId: AiProviderId,
  providerModelOverrides: Partial<Record<AiProviderId, string>> = {},
): Promise<string> {
  const providerTextInputMap = {
    openai: '',
    deepseek: '',
    anthropic: '',
    google: '',
    xai: '',
    openrouter: '',
    'openai-compatible': '',
  };
  const providerModelInputs: Record<AiProviderId, string> = {
    ...DEFAULT_PROVIDER_MODEL_INPUTS,
    ...providerModelOverrides,
  };
  const startup: StartupStatus = {
    databaseReady: true,
    databaseLocation: '/tmp/Inkline.sqlite',
    migrationsApplied: true,
    timeZone: 'UTC',
    timeZoneOffsetMinutes: 0,
  };
  const { SettingsPage } = await import('../src/renderer/components/SettingsPage');

  return renderToStaticMarkup(
    <SettingsPage
      settings={makeSettings(defaultProviderId, providerModelInputs)}
      startup={startup}
      openAiCompatibleBaseUrlInput="https://provider.example/v1"
      providerModelInputs={providerModelInputs}
      apiKeyInputs={providerTextInputMap}
      message={null}
      error={null}
      onDefaultProviderChange={() => undefined}
      onOpenAiCompatibleBaseUrlChange={() => undefined}
      onProviderModelChange={() => undefined}
      onApiKeyChange={() => undefined}
      onSaveProviderSettings={() => undefined}
      onDeleteApiKey={() => undefined}
      onRawResponseStorageChange={() => undefined}
      onReviewThinkingChange={() => undefined}
      onViewWelcomeIntro={() => undefined}
    />,
  );
}

describe('SettingsPage provider flow', () => {
  it('renders only the selected hosted provider settings', async () => {
    const html = await renderSettingsPage('anthropic', {
      anthropic: 'anthropic-render-test-model',
    });

    expect(html).toContain('data-e2e="anthropic-provider-settings"');
    expect(html).toContain('data-e2e="anthropic-model-input"');
    expect(html).toContain('value="anthropic-render-test-model"');
    expect(html).not.toContain('data-e2e="openai-model-input"');
    expect(html).toContain('Save provider');
    expect(html).not.toContain('data-e2e="openai-provider-settings"');
    expect(html).not.toContain('data-e2e="openai-compatible-provider-settings"');
    expect(html).not.toContain('data-e2e="openai-base-url-input"');
    expect(html).not.toContain('Save API key');
    expect(html).toContain('Anthropic Claude key');
    expect(html).not.toContain('OpenAI key');
  });

  it('renders custom base URL only for the OpenAI-compatible provider', async () => {
    const html = await renderSettingsPage('openai-compatible');

    expect(html).toContain('data-e2e="openai-compatible-provider-settings"');
    expect(html).toContain('data-e2e="openai-base-url-input"');
    expect(html).not.toContain('data-e2e="anthropic-provider-settings"');
  });

  it('keeps arbitrary OpenAI-compatible model IDs editable', async () => {
    const html = await renderSettingsPage('openai-compatible', {
      'openai-compatible': 'mock-review-model',
    });

    expect(html).toContain('data-e2e="openai-compatible-model-input"');
    expect(html).toContain('value="mock-review-model"');
    expect(html).toContain('Enter the exact model ID you want Inkline to use.');
    expect(html).not.toContain('data-e2e="openai-compatible-model-select"');
    expect(html).not.toContain('__custom_model__');
  });
});
