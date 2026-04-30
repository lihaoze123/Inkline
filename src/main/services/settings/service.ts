import Store from 'electron-store';
import { getDatabasePath } from '../../db/client';
import { getProviderKeyStatus } from '../credentials/service';
import { setProviderConfigInputSchema, type SettingsSnapshot, type SetProviderConfigInput, type SetRawResponseStorageInput } from '../../../shared/types/settings';

export const OPENAI_COMPATIBLE_PROVIDER = 'OpenAI-compatible';
export const DEFAULT_OPENAI_COMPATIBLE_BASE_URL = 'https://api.openai.com/v1';
export const DEFAULT_OPENAI_COMPATIBLE_MODEL = 'gpt-4o-mini';
const REVIEW_CONTEXT_DESCRIPTION = 'Selected template, prompt or goal context, current writing, and selected learning history will be sent when Review is clicked.';

export type ReviewSettingsSnapshot = Pick<SettingsSnapshot, 'provider' | 'baseUrl' | 'model' | 'rawResponseStorageEnabled' | 'providerApiKeyStatus'>;

type SettingsStore = {
  rawResponseStorageEnabled: boolean;
  openAiCompatibleBaseUrl: string;
  openAiCompatibleModel: string;
};

const store = new Store<SettingsStore>({
  name: 'settings',
  defaults: {
    rawResponseStorageEnabled: false,
    openAiCompatibleBaseUrl: DEFAULT_OPENAI_COMPATIBLE_BASE_URL,
    openAiCompatibleModel: DEFAULT_OPENAI_COMPATIBLE_MODEL,
  },
});

export async function getSettingsSnapshot(): Promise<SettingsSnapshot> {
  const providerKeyStatus = await getProviderKeyStatus();

  return {
    provider: OPENAI_COMPATIBLE_PROVIDER,
    baseUrl: store.get('openAiCompatibleBaseUrl'),
    model: store.get('openAiCompatibleModel'),
    isLocalModel: false,
    reviewContextDescription: REVIEW_CONTEXT_DESCRIPTION,
    rawResponseStorageEnabled: store.get('rawResponseStorageEnabled'),
    databaseLocation: getDatabasePath(),
    piMonoAuthStatus: 'not-configured',
    providerApiKeyStatus: providerKeyStatus.status,
    ankiConnectStatus: 'reserved',
  };
}

export function setRawResponseStorage(input: SetRawResponseStorageInput): boolean {
  store.set('rawResponseStorageEnabled', input.enabled);
  return store.get('rawResponseStorageEnabled');
}

export function setProviderConfig(input: SetProviderConfigInput): Pick<SettingsSnapshot, 'provider' | 'baseUrl' | 'model' | 'isLocalModel'> {
  const parsedInput = setProviderConfigInputSchema.parse(input);
  store.set('openAiCompatibleBaseUrl', parsedInput.baseUrl.trim());
  store.set('openAiCompatibleModel', parsedInput.model.trim());

  return {
    provider: OPENAI_COMPATIBLE_PROVIDER,
    baseUrl: store.get('openAiCompatibleBaseUrl'),
    model: store.get('openAiCompatibleModel'),
    isLocalModel: false,
  };
}
