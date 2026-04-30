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
    provider: 'OpenAI-compatible',
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

function providerLabel(providerId: AiProviderId): string {
  return providerId === 'anthropic' ? 'Anthropic Claude provider' : 'OpenAI-compatible provider';
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

  if (providerSettings.providerId === 'anthropic') {
    return {
      provider: 'anthropic',
      apiKey,
      model: providerSettings.model,
    };
  }

  if (!providerSettings.baseUrl || !providerSettings.model) {
    throw new Error('OpenAI-compatible provider base URL and model are required.');
  }

  return {
    provider: 'openai-compatible',
    apiKey,
    baseUrl: providerSettings.baseUrl,
    model: providerSettings.model,
  };
}
