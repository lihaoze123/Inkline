import keytar from 'keytar';
import type { ProviderKeyStatus } from '../../../shared/types/credentials';

const SERVICE_NAME = 'english-coach';
const PROVIDER_ACCOUNT = 'provider-api-key';

export async function getProviderKeyStatus(): Promise<ProviderKeyStatus> {
  try {
    const password = await keytar.getPassword(SERVICE_NAME, PROVIDER_ACCOUNT);
    return {
      status: password ? 'configured' : 'not-configured',
      storage: 'os-keychain',
    };
  } catch {
    return {
      status: 'unavailable',
      storage: 'os-keychain',
    };
  }
}

export async function getProviderApiKey(): Promise<string | null> {
  try {
    return await keytar.getPassword(SERVICE_NAME, PROVIDER_ACCOUNT);
  } catch {
    throw new Error('OpenAI-compatible provider API key is unavailable. Check OS keychain access before reviewing.');
  }
}

export async function setProviderApiKey(apiKey: string): Promise<void> {
  await keytar.setPassword(SERVICE_NAME, PROVIDER_ACCOUNT, apiKey.trim());
}

export async function deleteProviderApiKey(): Promise<void> {
  await keytar.deletePassword(SERVICE_NAME, PROVIDER_ACCOUNT);
}
