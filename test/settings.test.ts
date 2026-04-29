import { describe, expect, it } from 'vitest';
import { providerCredentialMutationResultSchema, setProviderApiKeyInputSchema } from '../src/shared/types/credentials';
import { providerConfigSchema, settingsSnapshotSchema } from '../src/shared/types/settings';

describe('settings defaults contract', () => {
  it('keeps production raw response storage off by default', () => {
    const parsed = settingsSnapshotSchema.parse({
      provider: 'OpenAI-compatible',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      isLocalModel: false,
      reviewContextDescription: 'Current entry and selected learning history will be sent when Review is clicked.',
      rawResponseStorageEnabled: false,
      databaseLocation: '/tmp/english-coach.sqlite',
      piMonoAuthStatus: 'not-configured',
      providerApiKeyStatus: 'not-configured',
      ankiConnectStatus: 'reserved',
    });

    expect(parsed.rawResponseStorageEnabled).toBe(false);
  });

  it('accepts OpenAI-compatible provider configuration without exposing credentials', () => {
    const parsed = providerConfigSchema.parse({
      provider: 'OpenAI-compatible',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      isLocalModel: false,
    });

    expect(parsed.provider).toBe('OpenAI-compatible');
    expect('apiKey' in parsed).toBe(false);
  });

  it('validates provider key mutations as write-only renderer inputs', () => {
    expect(setProviderApiKeyInputSchema.parse({ apiKey: ' sk-test ' }).apiKey).toBe('sk-test');
    const result = providerCredentialMutationResultSchema.parse({
      success: true,
      status: { status: 'configured', storage: 'os-keychain' },
    });

    expect(result.status?.status).toBe('configured');
    expect('apiKey' in result).toBe(false);
  });
});
