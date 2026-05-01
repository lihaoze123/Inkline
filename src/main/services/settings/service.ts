import Store from 'electron-store';
import { getDatabasePath } from '../../db/client';
import { normalizeOpenAiCompatibleBaseUrl } from '../ai/openai-compatible';
import { getProviderCredentialStatuses } from '../credentials/service';
import {
  setOnboardingIntroVersionSeenInputSchema,
  setDefaultProviderInputSchema,
  setProviderConfigInputSchema,
  type AiModelSettings,
  type AnthropicProviderSettings,
  type OpenAiCompatibleProviderSettings,
  type SettingsSnapshot,
  type SetDefaultProviderInput,
  type SetOnboardingIntroVersionSeenInput,
  type SetProviderConfigInput,
  type SetRawResponseStorageInput,
} from '../../../shared/types/settings';
import type { AiProviderId, ProviderCredentialStatuses } from '../../../shared/types/credentials';

export const OPENAI_COMPATIBLE_PROVIDER = 'OpenAI-compatible';
export const ANTHROPIC_PROVIDER = 'Anthropic Claude';
export const DEFAULT_OPENAI_COMPATIBLE_BASE_URL = 'https://api.openai.com/v1';
export const DEFAULT_OPENAI_COMPATIBLE_MODEL = 'gpt-4o-mini';
export const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-5';
const REVIEW_CONTEXT_DESCRIPTION =
  'Selected template, prompt or goal context, current writing, and selected learning history will be sent when Review is clicked.';

export type ReviewSettingsSnapshot = Pick<
  SettingsSnapshot,
  'provider' | 'baseUrl' | 'model' | 'rawResponseStorageEnabled' | 'providerApiKeyStatus' | 'aiModelSettings'
>;

type SettingsStore = {
  rawResponseStorageEnabled: boolean;
  openAiCompatibleBaseUrl: string;
  openAiCompatibleModel: string;
  anthropicModel: string;
  defaultProviderId: AiProviderId;
  onboardingIntroVersionSeen: number;
};

const store = new Store<SettingsStore>({
  name: 'settings',
  defaults: {
    rawResponseStorageEnabled: false,
    openAiCompatibleBaseUrl: DEFAULT_OPENAI_COMPATIBLE_BASE_URL,
    openAiCompatibleModel: DEFAULT_OPENAI_COMPATIBLE_MODEL,
    anthropicModel: DEFAULT_ANTHROPIC_MODEL,
    defaultProviderId: 'openai-compatible',
    onboardingIntroVersionSeen: 0,
  },
});

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

function getAiModelSettings(providerCredentialStatuses: ProviderCredentialStatuses): AiModelSettings {
  return {
    defaultProviderId: store.get('defaultProviderId'),
    providers: {
      'openai-compatible': getOpenAiCompatibleSettings(providerCredentialStatuses),
      anthropic: getAnthropicSettings(providerCredentialStatuses),
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

export function setProviderConfig(
  input: SetProviderConfigInput,
): Pick<SettingsSnapshot, 'provider' | 'baseUrl' | 'model' | 'isLocalModel'> {
  const parsedInput = setProviderConfigInputSchema.parse(input);

  if (parsedInput.providerId === 'anthropic') {
    store.set('anthropicModel', parsedInput.model.trim());
    return {
      provider: ANTHROPIC_PROVIDER,
      baseUrl: DEFAULT_OPENAI_COMPATIBLE_BASE_URL,
      model: store.get('anthropicModel'),
      isLocalModel: false,
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
