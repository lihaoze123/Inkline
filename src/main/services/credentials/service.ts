import type keytar from 'keytar';
import { createRequire } from 'node:module';
import { AI_PROVIDER_IDS, providerCredentialStatusesSchema } from '../../../shared/types/credentials';
import type {
  AiProviderId,
  ProviderCredentialStatuses,
  ProviderKeyStatus,
  ProviderKeyStatusValue,
} from '../../../shared/types/credentials';

type Keytar = typeof keytar;

const require = createRequire(import.meta.url);
const SERVICE_NAME = 'Inkline';
const SERVICE_NAME_ENV = 'INKLINE_KEYCHAIN_SERVICE_NAME';
const PROVIDER_ACCOUNT = 'provider-api-key';
const OPENAI_PROVIDER_ACCOUNT = 'provider-api-key:openai';
const DEEPSEEK_PROVIDER_ACCOUNT = 'provider-api-key:deepseek';
const ANTHROPIC_PROVIDER_ACCOUNT = 'provider-api-key:anthropic';
const GOOGLE_PROVIDER_ACCOUNT = 'provider-api-key:google';
const XAI_PROVIDER_ACCOUNT = 'provider-api-key:xai';
const OPENROUTER_PROVIDER_ACCOUNT = 'provider-api-key:openrouter';

const PROVIDER_KEY_ACCOUNTS: Record<AiProviderId, string> = {
  openai: OPENAI_PROVIDER_ACCOUNT,
  deepseek: DEEPSEEK_PROVIDER_ACCOUNT,
  'openai-compatible': PROVIDER_ACCOUNT,
  anthropic: ANTHROPIC_PROVIDER_ACCOUNT,
  google: GOOGLE_PROVIDER_ACCOUNT,
  xai: XAI_PROVIDER_ACCOUNT,
  openrouter: OPENROUTER_PROVIDER_ACCOUNT,
};

const PROVIDER_ERROR_LABELS: Record<AiProviderId, string> = {
  openai: 'OpenAI provider',
  deepseek: 'DeepSeek provider',
  'openai-compatible': 'Custom OpenAI-compatible provider',
  anthropic: 'Anthropic Claude provider',
  google: 'Google Gemini provider',
  xai: 'xAI Grok provider',
  openrouter: 'OpenRouter provider',
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
  const statuses = await Promise.all(
    AI_PROVIDER_IDS.map(async (providerId) => [providerId, await getRequiredProviderKeyStatus(providerId)] as const),
  );

  return providerCredentialStatusesSchema.parse(Object.fromEntries(statuses));
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
