import Store from 'electron-store';
import { getDatabasePath } from '../../db/client';
import { getProviderKeyStatus } from '../credentials/service';
import type { SettingsSnapshot, SetRawResponseStorageInput } from '../../../shared/types/settings';

const DEFAULT_PROVIDER = 'Not configured';
const DEFAULT_MODEL = 'Not configured';
const REVIEW_CONTEXT_DESCRIPTION = 'Current entry and selected learning history will be sent when Review is clicked.';

export type ReviewSettingsSnapshot = Pick<SettingsSnapshot, 'provider' | 'model' | 'rawResponseStorageEnabled'>;

type SettingsStore = {
  rawResponseStorageEnabled: boolean;
};

const store = new Store<SettingsStore>({
  name: 'settings',
  defaults: {
    rawResponseStorageEnabled: false,
  },
});

export async function getSettingsSnapshot(): Promise<SettingsSnapshot> {
  const providerKeyStatus = await getProviderKeyStatus();

  return {
    provider: DEFAULT_PROVIDER,
    model: DEFAULT_MODEL,
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
