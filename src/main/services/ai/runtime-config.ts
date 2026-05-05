import type { AiProviderId } from '../../../shared/types/credentials';
import type { AiModelSettings, ProviderSettings, SettingsSnapshot } from '../../../shared/types/settings';
import type { AiProviderRuntimeConfig } from './types';

export type AiFeatureKey = 'review' | 'starterPrompt';

function selectProviderSettingsForFeature(aiModelSettings: AiModelSettings, feature: AiFeatureKey): ProviderSettings {
  const override = aiModelSettings.featureOverrides[feature];
  if (override) {
    const providerSettings = aiModelSettings.providers[override.providerId];
    return {
      ...providerSettings,
      model: override.model,
    };
  }

  return aiModelSettings.providers[aiModelSettings.defaultProviderId];
}

function getLegacyProviderSettings(
  settings: Pick<SettingsSnapshot, 'baseUrl' | 'model' | 'providerApiKeyStatus'> &
    Partial<Pick<SettingsSnapshot, 'isLocalModel'>>,
): ProviderSettings {
  return {
    providerId: 'openai-compatible',
    provider: 'Custom OpenAI-compatible',
    baseUrl: settings.baseUrl,
    model: settings.model,
    isLocalModel: settings.isLocalModel ?? false,
    apiKeyStatus: {
      providerId: 'openai-compatible',
      status: settings.providerApiKeyStatus,
      storage: 'os-keychain',
    },
  };
}

const PROVIDER_ERROR_LABELS: Record<AiProviderId, string> = {
  openai: 'OpenAI provider',
  deepseek: 'DeepSeek provider',
  anthropic: 'Anthropic Claude provider',
  google: 'Google Gemini provider',
  xai: 'xAI Grok provider',
  openrouter: 'OpenRouter provider',
  'openai-compatible': 'Custom OpenAI-compatible provider',
};

function providerLabel(providerId: AiProviderId): string {
  return PROVIDER_ERROR_LABELS[providerId];
}

export function getProviderSettingsForFeature(
  settings: Pick<SettingsSnapshot, 'provider' | 'baseUrl' | 'model' | 'providerApiKeyStatus' | 'aiModelSettings'> &
    Partial<Pick<SettingsSnapshot, 'isLocalModel'>>,
  feature: AiFeatureKey,
): ProviderSettings {
  if (settings.aiModelSettings) {
    return selectProviderSettingsForFeature(settings.aiModelSettings, feature);
  }

  return getLegacyProviderSettings(settings);
}

export async function buildAiRuntimeConfigForFeature(
  feature: AiFeatureKey,
  settings?: SettingsSnapshot,
): Promise<AiProviderRuntimeConfig> {
  const [{ getProviderApiKey }, { getSettingsSnapshot }] = await Promise.all([
    import('../credentials/service'),
    import('../settings/service'),
  ]);
  const snapshot = settings ?? (await getSettingsSnapshot());
  const providerSettings = getProviderSettingsForFeature(snapshot, feature);
  const apiKey = await getProviderApiKey(providerSettings.providerId);

  if (!apiKey) {
    throw new Error(
      `${providerLabel(providerSettings.providerId)} API key is not configured. Add it in Settings before continuing.`,
    );
  }

  return buildRuntimeConfig(providerSettings, apiKey);
}

function buildRuntimeConfig(providerSettings: ProviderSettings, apiKey: string): AiProviderRuntimeConfig {
  switch (providerSettings.providerId) {
    case 'openai':
    case 'deepseek':
    case 'anthropic':
    case 'google':
    case 'xai':
    case 'openrouter':
      return {
        provider: providerSettings.providerId,
        apiKey,
        model: providerSettings.model,
      };
    case 'openai-compatible':
      if (!providerSettings.baseUrl || !providerSettings.model) {
        throw new Error('Custom OpenAI-compatible provider base URL and model are required.');
      }

      return {
        provider: 'openai-compatible',
        apiKey,
        baseUrl: providerSettings.baseUrl,
        model: providerSettings.model,
      };
  }
}
