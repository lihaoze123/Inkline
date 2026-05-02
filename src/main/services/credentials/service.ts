import type keytar from 'keytar';
import { createRequire } from 'node:module';
import type {
  AiProviderId,
  ProviderCredentialStatuses,
  ProviderKeyStatus,
  ProviderKeyStatusValue,
} from '../../../shared/types/credentials';

type Keytar = typeof keytar;

const require = createRequire(import.meta.url);
const SERVICE_NAME = 'english-coach';
const SERVICE_NAME_ENV = 'ENGLISH_COACH_KEYCHAIN_SERVICE_NAME';
const PROVIDER_ACCOUNT = 'provider-api-key';
const ANTHROPIC_PROVIDER_ACCOUNT = 'provider-api-key:anthropic';

const PROVIDER_KEY_ACCOUNTS: Record<AiProviderId, string> = {
  'openai-compatible': PROVIDER_ACCOUNT,
  anthropic: ANTHROPIC_PROVIDER_ACCOUNT,
};

const PROVIDER_ERROR_LABELS: Record<AiProviderId, string> = {
  'openai-compatible': 'OpenAI-compatible provider',
  anthropic: 'Anthropic Claude provider',
};

function getProviderAccount(providerId: AiProviderId): string {
  return PROVIDER_KEY_ACCOUNTS[providerId];
}

function getProviderErrorLabel(providerId: AiProviderId): string {
  return PROVIDER_ERROR_LABELS[providerId];
}

function getKeychainServiceName(): string {
  const serviceName = process.env[SERVICE_NAME_ENV]?.trim();
  return serviceName && serviceName.length > 0 ? serviceName : SERVICE_NAME;
}

function loadKeytar(): Keytar | null {
  try {
    return require('keytar') as Keytar;
  } catch {
    return null;
  }
}

function getUnavailableProviderKeyStatus(providerId: AiProviderId): ProviderKeyStatus {
  return {
    providerId,
    status: 'unavailable',
    storage: 'os-keychain',
  };
}

function getRequiredKeytar(providerId: AiProviderId): Keytar {
  const loadedKeytar = loadKeytar();
  if (!loadedKeytar) {
    throw new Error(
      `${getProviderErrorLabel(providerId)} API key is unavailable. Check OS keychain access before reviewing.`,
    );
  }
  return loadedKeytar;
}

export async function getProviderKeyStatus(providerId: AiProviderId = 'openai-compatible'): Promise<ProviderKeyStatus> {
  const loadedKeytar = loadKeytar();
  if (!loadedKeytar) {
    return getUnavailableProviderKeyStatus(providerId);
  }

  try {
    const password = await loadedKeytar.getPassword(getKeychainServiceName(), getProviderAccount(providerId));
    return {
      providerId,
      status: password ? 'configured' : 'not-configured',
      storage: 'os-keychain',
    };
  } catch {
    return getUnavailableProviderKeyStatus(providerId);
  }
}

async function getRequiredProviderKeyStatus<TProviderId extends AiProviderId>(
  providerId: TProviderId,
): Promise<ProviderKeyStatus & { providerId: TProviderId }> {
  const status = await getProviderKeyStatus(providerId);
  return {
    providerId,
    status: status.status as ProviderKeyStatusValue,
    storage: status.storage,
  };
}

export async function getProviderCredentialStatuses(): Promise<ProviderCredentialStatuses> {
  const openAiCompatibleStatus = await getRequiredProviderKeyStatus('openai-compatible');
  const anthropicStatus = await getRequiredProviderKeyStatus('anthropic');

  return {
    'openai-compatible': openAiCompatibleStatus,
    anthropic: anthropicStatus,
  };
}

export async function getProviderApiKey(providerId: AiProviderId = 'openai-compatible'): Promise<string | null> {
  try {
    return await getRequiredKeytar(providerId).getPassword(getKeychainServiceName(), getProviderAccount(providerId));
  } catch {
    throw new Error(
      `${getProviderErrorLabel(providerId)} API key is unavailable. Check OS keychain access before reviewing.`,
    );
  }
}

export async function setProviderApiKey(apiKey: string, providerId: AiProviderId = 'openai-compatible'): Promise<void> {
  await getRequiredKeytar(providerId).setPassword(
    getKeychainServiceName(),
    getProviderAccount(providerId),
    apiKey.trim(),
  );
}

export async function deleteProviderApiKey(providerId: AiProviderId = 'openai-compatible'): Promise<void> {
  await getRequiredKeytar(providerId).deletePassword(getKeychainServiceName(), getProviderAccount(providerId));
}
