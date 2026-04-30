import keytar from 'keytar';
import type {
  AiProviderId,
  ProviderCredentialStatuses,
  ProviderKeyStatus,
  ProviderKeyStatusValue,
} from '../../../shared/types/credentials';

const SERVICE_NAME = 'english-coach';
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

export async function getProviderKeyStatus(providerId: AiProviderId = 'openai-compatible'): Promise<ProviderKeyStatus> {
  try {
    const password = await keytar.getPassword(SERVICE_NAME, getProviderAccount(providerId));
    return {
      providerId,
      status: password ? 'configured' : 'not-configured',
      storage: 'os-keychain',
    };
  } catch {
    return {
      providerId,
      status: 'unavailable',
      storage: 'os-keychain',
    };
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
    return await keytar.getPassword(SERVICE_NAME, getProviderAccount(providerId));
  } catch {
    throw new Error(
      `${getProviderErrorLabel(providerId)} API key is unavailable. Check OS keychain access before reviewing.`,
    );
  }
}

export async function setProviderApiKey(apiKey: string, providerId: AiProviderId = 'openai-compatible'): Promise<void> {
  await keytar.setPassword(SERVICE_NAME, getProviderAccount(providerId), apiKey.trim());
}

export async function deleteProviderApiKey(providerId: AiProviderId = 'openai-compatible'): Promise<void> {
  await keytar.deletePassword(SERVICE_NAME, getProviderAccount(providerId));
}
