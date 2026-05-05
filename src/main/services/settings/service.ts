import Store from 'electron-store';
import { getDatabasePath } from '../../db/client';
import { normalizeOpenAiCompatibleBaseUrl } from '../ai/openai-compatible';
import { getProviderCredentialStatuses } from '../credentials/service';
import {
  setOnboardingIntroVersionSeenInputSchema,
  setDefaultProviderInputSchema,
  setProviderConfigInputSchema,
  setReviewThinkingInputSchema,
  type AiModelSettings,
  type AnthropicProviderSettings,
  type DeepSeekProviderSettings,
  type GoogleProviderSettings,
  type HostedProviderConfig,
  type OpenAiProviderSettings,
  type OpenAiCompatibleProviderSettings,
  type OpenRouterProviderSettings,
  type SettingsSnapshot,
  type SetDefaultProviderInput,
  type SetOnboardingIntroVersionSeenInput,
  type SetProviderConfigInput,
  type SetReviewThinkingInput,
  type SetRawResponseStorageInput,
  type XaiProviderSettings,
} from '../../../shared/types/settings';
import type { AiProviderId, ProviderCredentialStatuses } from '../../../shared/types/credentials';

export const OPENAI_PROVIDER = 'OpenAI';
export const DEEPSEEK_PROVIDER = 'DeepSeek';
export const OPENAI_COMPATIBLE_PROVIDER = 'Custom OpenAI-compatible';
export const ANTHROPIC_PROVIDER = 'Anthropic Claude';
export const GOOGLE_PROVIDER = 'Google Gemini';
export const XAI_PROVIDER = 'xAI Grok';
export const OPENROUTER_PROVIDER = 'OpenRouter';
export const DEFAULT_OPENAI_COMPATIBLE_BASE_URL = 'https://api.openai.com/v1';
export const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
export const DEFAULT_DEEPSEEK_MODEL = 'deepseek-chat';
export const DEFAULT_OPENAI_COMPATIBLE_MODEL = 'gpt-4o-mini';
export const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-5';
export const DEFAULT_GOOGLE_MODEL = 'gemini-2.5-flash';
export const DEFAULT_XAI_MODEL = 'grok-4-fast-non-reasoning';
export const DEFAULT_OPENROUTER_MODEL = 'openai/gpt-4o-mini';
const REVIEW_CONTEXT_DESCRIPTION =
  'Selected template, prompt or goal context, current writing, and selected learning history will be sent when Review is clicked.';

export type ReviewSettingsSnapshot = Pick<
  SettingsSnapshot,
  | 'provider'
  | 'baseUrl'
  | 'model'
  | 'rawResponseStorageEnabled'
  | 'reviewThinkingEnabled'
  | 'providerApiKeyStatus'
  | 'aiModelSettings'
>;

type HostedProviderId = Exclude<AiProviderId, 'openai-compatible'>;

type SettingsStore = {
  rawResponseStorageEnabled: boolean;
  reviewThinkingEnabled: boolean;
  openAiModel: string;
  deepSeekModel: string;
  openAiCompatibleBaseUrl: string;
  openAiCompatibleModel: string;
  anthropicModel: string;
  googleModel: string;
  xaiModel: string;
  openRouterModel: string;
  defaultProviderId: AiProviderId;
  onboardingIntroVersionSeen: number;
};

const store = new Store<SettingsStore>({
  name: 'settings',
  defaults: {
    rawResponseStorageEnabled: false,
    reviewThinkingEnabled: false,
    openAiModel: DEFAULT_OPENAI_MODEL,
    deepSeekModel: DEFAULT_DEEPSEEK_MODEL,
    openAiCompatibleBaseUrl: DEFAULT_OPENAI_COMPATIBLE_BASE_URL,
    openAiCompatibleModel: DEFAULT_OPENAI_COMPATIBLE_MODEL,
    anthropicModel: DEFAULT_ANTHROPIC_MODEL,
    googleModel: DEFAULT_GOOGLE_MODEL,
    xaiModel: DEFAULT_XAI_MODEL,
    openRouterModel: DEFAULT_OPENROUTER_MODEL,
    defaultProviderId: 'openai',
    onboardingIntroVersionSeen: 0,
  },
});

function getOpenAiSettings(providerCredentialStatuses: ProviderCredentialStatuses): OpenAiProviderSettings {
  return {
    providerId: 'openai',
    provider: OPENAI_PROVIDER,
    model: store.get('openAiModel'),
    isLocalModel: false,
    apiKeyStatus: providerCredentialStatuses.openai,
  };
}

function getDeepSeekSettings(providerCredentialStatuses: ProviderCredentialStatuses): DeepSeekProviderSettings {
  return {
    providerId: 'deepseek',
    provider: DEEPSEEK_PROVIDER,
    model: store.get('deepSeekModel'),
    isLocalModel: false,
    apiKeyStatus: providerCredentialStatuses.deepseek,
  };
}

function getOpenAiCompatibleSettings(
  providerCredentialStatuses: ProviderCredentialStatuses,
): OpenAiCompatibleProviderSettings {
  return {
    providerId: 'openai-compatible',
    provider: OPENAI_COMPATIBLE_PROVIDER,
    baseUrl: store.get('openAiCompatibleBaseUrl'),
    model: store.get('openAiCompatibleModel'),
    isLocalModel: false,
    apiKeyStatus: providerCredentialStatuses['openai-compatible'],
  };
}

function getAnthropicSettings(providerCredentialStatuses: ProviderCredentialStatuses): AnthropicProviderSettings {
  return {
    providerId: 'anthropic',
    provider: ANTHROPIC_PROVIDER,
    model: store.get('anthropicModel'),
    isLocalModel: false,
    apiKeyStatus: providerCredentialStatuses.anthropic,
  };
}

function getGoogleSettings(providerCredentialStatuses: ProviderCredentialStatuses): GoogleProviderSettings {
  return {
    providerId: 'google',
    provider: GOOGLE_PROVIDER,
    model: store.get('googleModel'),
    isLocalModel: false,
    apiKeyStatus: providerCredentialStatuses.google,
  };
}

function getXaiSettings(providerCredentialStatuses: ProviderCredentialStatuses): XaiProviderSettings {
  return {
    providerId: 'xai',
    provider: XAI_PROVIDER,
    model: store.get('xaiModel'),
    isLocalModel: false,
    apiKeyStatus: providerCredentialStatuses.xai,
  };
}

function getOpenRouterSettings(providerCredentialStatuses: ProviderCredentialStatuses): OpenRouterProviderSettings {
  return {
    providerId: 'openrouter',
    provider: OPENROUTER_PROVIDER,
    model: store.get('openRouterModel'),
    isLocalModel: false,
    apiKeyStatus: providerCredentialStatuses.openrouter,
  };
}

function getAiModelSettings(providerCredentialStatuses: ProviderCredentialStatuses): AiModelSettings {
  return {
    defaultProviderId: store.get('defaultProviderId'),
    providers: {
      openai: getOpenAiSettings(providerCredentialStatuses),
      deepseek: getDeepSeekSettings(providerCredentialStatuses),
      'openai-compatible': getOpenAiCompatibleSettings(providerCredentialStatuses),
      anthropic: getAnthropicSettings(providerCredentialStatuses),
      google: getGoogleSettings(providerCredentialStatuses),
      xai: getXaiSettings(providerCredentialStatuses),
      openrouter: getOpenRouterSettings(providerCredentialStatuses),
    },
    featureOverrides: {},
  };
}

export async function getSettingsSnapshot(): Promise<SettingsSnapshot> {
  const providerCredentialStatuses = await getProviderCredentialStatuses();
  const aiModelSettings = getAiModelSettings(providerCredentialStatuses);
  const defaultProvider = aiModelSettings.providers[aiModelSettings.defaultProviderId];
  const baseUrl =
    defaultProvider.providerId === 'openai-compatible' ? defaultProvider.baseUrl : DEFAULT_OPENAI_COMPATIBLE_BASE_URL;

  return {
    providerId: defaultProvider.providerId,
    provider: defaultProvider.provider,
    baseUrl,
    model: defaultProvider.model,
    isLocalModel: defaultProvider.isLocalModel,
    reviewContextDescription: REVIEW_CONTEXT_DESCRIPTION,
    rawResponseStorageEnabled: store.get('rawResponseStorageEnabled'),
    reviewThinkingEnabled: store.get('reviewThinkingEnabled'),
    onboardingIntroVersionSeen: store.get('onboardingIntroVersionSeen'),
    databaseLocation: getDatabasePath(),
    piMonoAuthStatus: 'not-configured',
    providerApiKeyStatus: defaultProvider.apiKeyStatus.status,
    providerCredentialStatuses,
    aiModelSettings,
    ankiConnectStatus: 'reserved',
  };
}

export function setRawResponseStorage(input: SetRawResponseStorageInput): boolean {
  store.set('rawResponseStorageEnabled', input.enabled);
  return store.get('rawResponseStorageEnabled');
}

export function setReviewThinking(input: SetReviewThinkingInput): boolean {
  const parsedInput = setReviewThinkingInputSchema.parse(input);
  store.set('reviewThinkingEnabled', parsedInput.enabled);
  return store.get('reviewThinkingEnabled');
}

export function setProviderConfig(
  input: SetProviderConfigInput,
): Pick<SettingsSnapshot, 'provider' | 'baseUrl' | 'model' | 'isLocalModel'> {
  const parsedInput = setProviderConfigInputSchema.parse(input);

  if (parsedInput.providerId && parsedInput.providerId !== 'openai-compatible') {
    setHostedProviderModel(parsedInput.providerId, parsedInput.model);
    return {
      ...getHostedProviderConfig(parsedInput.providerId),
      baseUrl: DEFAULT_OPENAI_COMPATIBLE_BASE_URL,
    };
  }

  store.set('openAiCompatibleBaseUrl', normalizeOpenAiCompatibleBaseUrl(parsedInput.baseUrl));
  store.set('openAiCompatibleModel', parsedInput.model.trim());

  return {
    provider: OPENAI_COMPATIBLE_PROVIDER,
    baseUrl: store.get('openAiCompatibleBaseUrl'),
    model: store.get('openAiCompatibleModel'),
    isLocalModel: false,
  };
}

function setHostedProviderModel(providerId: HostedProviderId, model: string): void {
  const trimmedModel = model.trim();
  switch (providerId) {
    case 'openai':
      store.set('openAiModel', trimmedModel);
      return;
    case 'deepseek':
      store.set('deepSeekModel', trimmedModel);
      return;
    case 'anthropic':
      store.set('anthropicModel', trimmedModel);
      return;
    case 'google':
      store.set('googleModel', trimmedModel);
      return;
    case 'xai':
      store.set('xaiModel', trimmedModel);
      return;
    case 'openrouter':
      store.set('openRouterModel', trimmedModel);
      return;
  }
}

function getHostedProviderConfig(providerId: HostedProviderId): HostedProviderConfig {
  switch (providerId) {
    case 'openai':
      return {
        providerId,
        provider: OPENAI_PROVIDER,
        model: store.get('openAiModel'),
        isLocalModel: false,
      };
    case 'deepseek':
      return {
        providerId,
        provider: DEEPSEEK_PROVIDER,
        model: store.get('deepSeekModel'),
        isLocalModel: false,
      };
    case 'anthropic':
      return {
        providerId,
        provider: ANTHROPIC_PROVIDER,
        model: store.get('anthropicModel'),
        isLocalModel: false,
      };
    case 'google':
      return {
        providerId,
        provider: GOOGLE_PROVIDER,
        model: store.get('googleModel'),
        isLocalModel: false,
      };
    case 'xai':
      return {
        providerId,
        provider: XAI_PROVIDER,
        model: store.get('xaiModel'),
        isLocalModel: false,
      };
    case 'openrouter':
      return {
        providerId,
        provider: OPENROUTER_PROVIDER,
        model: store.get('openRouterModel'),
        isLocalModel: false,
      };
  }
}

export function setDefaultProvider(input: SetDefaultProviderInput): AiProviderId {
  const parsedInput = setDefaultProviderInputSchema.parse(input);
  store.set('defaultProviderId', parsedInput.providerId);
  return store.get('defaultProviderId');
}

export function setOnboardingIntroVersionSeen(input: SetOnboardingIntroVersionSeenInput): number {
  const parsedInput = setOnboardingIntroVersionSeenInputSchema.parse(input);
  const nextVersionSeen = Math.max(store.get('onboardingIntroVersionSeen'), parsedInput.version);
  store.set('onboardingIntroVersionSeen', nextVersionSeen);
  return store.get('onboardingIntroVersionSeen');
}
