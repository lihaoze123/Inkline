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
vi.mock('@shared/diagnostics/beta-readiness', async () => import('../src/shared/diagnostics/beta-readiness'));

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
  providerModelOverrides: Partial<Record<AiProviderId, string>> = {},
): SettingsSnapshot {
  const providerModelInputs: Record<AiProviderId, string> = {
    ...DEFAULT_PROVIDER_MODEL_INPUTS,
    ...providerModelOverrides,
  };
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

type RenderSettingsPageOptions = {
  settings?: SettingsSnapshot;
  startupOverrides?: Partial<StartupStatus>;
  apiKeyInputOverrides?: Partial<Record<AiProviderId, string>>;
  openAiCompatibleBaseUrlInput?: string;
};

async function renderSettingsPage(
  defaultProviderId: AiProviderId,
  providerModelOverrides: Partial<Record<AiProviderId, string>> = {},
  options: RenderSettingsPageOptions = {},
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
  const apiKeyInputs: Record<AiProviderId, string> = {
    ...providerTextInputMap,
    ...options.apiKeyInputOverrides,
  };
  const startup: StartupStatus = {
    databaseReady: true,
    databaseLocation: '/tmp/Inkline.sqlite',
    migrationsApplied: true,
    timeZone: 'UTC',
    timeZoneOffsetMinutes: 0,
    ...options.startupOverrides,
  };
  const settings = options.settings ?? makeSettings(defaultProviderId, providerModelInputs);
  const { SettingsPage } = await import('../src/renderer/components/SettingsPage');

  return renderToStaticMarkup(
    <SettingsPage
      settings={settings}
      startup={startup}
      openAiCompatibleBaseUrlInput={options.openAiCompatibleBaseUrlInput ?? 'https://provider.example/v1'}
      providerModelInputs={providerModelInputs}
      apiKeyInputs={apiKeyInputs}
      includeRawProviderOutputInHistoryExport={false}
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
      onIncludeRawProviderOutputInHistoryExportChange={() => undefined}
      onExportLearningHistory={() => undefined}
      onCreateLearningHistoryBackup={() => undefined}
      onPreviewLearningHistoryImport={() => undefined}
      onViewWelcomeIntro={() => undefined}
    />,
  );
}

function extractReadinessSection(html: string): string {
  const start = html.indexOf('data-e2e="settings-readiness-diagnostics"');
  const end = html.indexOf('data-e2e="default-provider-select"', start);
  if (start === -1 || end === -1) {
    throw new Error('Unable to locate Settings readiness section.');
  }

  return html.slice(start, end);
}

describe('SettingsPage provider flow', () => {
  it('renders a visible beta readiness diagnostics section', async () => {
    const html = await renderSettingsPage('openai-compatible');
    const readinessSection = extractReadinessSection(html);

    expect(readinessSection).toContain('Beta readiness');
    expect(readinessSection).toContain('Configuration ready');
    expect(readinessSection).toContain('/tmp/Inkline.sqlite');
    expect(readinessSection).toContain('Custom OpenAI-compatible');
    expect(readinessSection).toContain('custom-model');
    expect(readinessSection).toContain('Configured in OS keychain');
    expect(readinessSection).toContain('Structured validation boundary is active.');
    expect(readinessSection).toContain('No live provider request was run.');
  });

  it('renders setup actions for incomplete selected provider readiness', async () => {
    const missingKeyStatus = providerStatus('openai-compatible', 'not-configured');
    const settings = makeSettings('openai-compatible', {
      'openai-compatible': '',
    });
    const aiModelSettings = settings.aiModelSettings;
    const credentialStatuses = settings.providerCredentialStatuses;

    if (!aiModelSettings || !credentialStatuses) {
      throw new Error('Expected settings fixture to include AI model and credential status snapshots.');
    }

    settings.baseUrl = '';
    settings.providerApiKeyStatus = 'not-configured';
    settings.providerCredentialStatuses = {
      ...credentialStatuses,
      'openai-compatible': missingKeyStatus,
    };
    settings.aiModelSettings = {
      ...aiModelSettings,
      providers: {
        ...aiModelSettings.providers,
        'openai-compatible': {
          ...aiModelSettings.providers['openai-compatible'],
          baseUrl: '',
          model: '',
          apiKeyStatus: missingKeyStatus,
        },
      },
    };

    const html = await renderSettingsPage('openai-compatible', { 'openai-compatible': '' }, { settings });
    const readinessSection = extractReadinessSection(html);

    expect(readinessSection).toContain('Setup needed');
    expect(readinessSection).toContain('Save a model ID for Custom OpenAI-compatible.');
    expect(readinessSection).toContain('Add the custom OpenAI-compatible base URL.');
    expect(readinessSection).toContain('Save an API key for Custom OpenAI-compatible.');
  });

  it('keeps diagnostics free of API keys, raw provider bodies, and writing content', async () => {
    const settings = makeSettings('openai-compatible');
    settings.reviewContextDescription = 'raw provider body: private essay content sk-test-secret';

    const html = await renderSettingsPage(
      'openai-compatible',
      {},
      {
        settings,
        apiKeyInputOverrides: {
          'openai-compatible': 'sk-test-secret',
        },
      },
    );
    const readinessSection = extractReadinessSection(html);

    expect(readinessSection).not.toContain('sk-test-secret');
    expect(readinessSection).not.toContain('private essay content');
    expect(readinessSection).not.toContain('raw provider body');
    expect(readinessSection).toContain('Diagnostics do not run a live provider request.');
  });

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

  it('renders learning history export and backup controls without enabling raw output by default', async () => {
    const html = await renderSettingsPage('openai-compatible');

    expect(html).toContain('Learning history');
    expect(html).toContain('data-e2e="learning-history-export"');
    expect(html).toContain('data-e2e="learning-history-backup"');
    expect(html).toContain('data-e2e="learning-history-preview-import"');
    expect(html).toContain('data-e2e="learning-history-raw-output-toggle"');
    expect(html).not.toContain('data-e2e="learning-history-raw-output-toggle" checked');
  });
});
