import { afterEach, describe, expect, it, vi } from 'vitest';

describe('credentials service', () => {
  afterEach(() => {
    delete process.env.ENGLISH_COACH_KEYCHAIN_SERVICE_NAME;
    vi.resetModules();
    vi.doUnmock('node:module');
  });

  it('reports keychain unavailable when keytar cannot be loaded', async () => {
    vi.doMock('node:module', () => ({
      createRequire: () => () => {
        throw new Error('Cannot find module keytar');
      },
    }));

    const { getProviderCredentialStatuses, getProviderKeyStatus } =
      await import('../src/main/services/credentials/service');

    await expect(getProviderKeyStatus('openai-compatible')).resolves.toEqual({
      providerId: 'openai-compatible',
      status: 'unavailable',
      storage: 'os-keychain',
    });
    await expect(getProviderCredentialStatuses()).resolves.toEqual({
      'openai-compatible': { providerId: 'openai-compatible', status: 'unavailable', storage: 'os-keychain' },
      anthropic: { providerId: 'anthropic', status: 'unavailable', storage: 'os-keychain' },
    });
  });

  it('uses an environment-scoped keychain service name when provided', async () => {
    const getPassword = vi.fn(async () => 'configured-key');
    const setPassword = vi.fn(async () => undefined);
    const deletePassword = vi.fn(async () => true);
    process.env.ENGLISH_COACH_KEYCHAIN_SERVICE_NAME = 'english-coach-e2e-test';

    vi.doMock('node:module', () => ({
      createRequire: () => () => ({
        getPassword,
        setPassword,
        deletePassword,
      }),
    }));

    const { deleteProviderApiKey, getProviderKeyStatus, setProviderApiKey } =
      await import('../src/main/services/credentials/service');

    await expect(getProviderKeyStatus('openai-compatible')).resolves.toMatchObject({ status: 'configured' });
    await setProviderApiKey(' test-key ', 'openai-compatible');
    await deleteProviderApiKey('openai-compatible');

    expect(getPassword).toHaveBeenCalledWith('english-coach-e2e-test', 'provider-api-key');
    expect(setPassword).toHaveBeenCalledWith('english-coach-e2e-test', 'provider-api-key', 'test-key');
    expect(deletePassword).toHaveBeenCalledWith('english-coach-e2e-test', 'provider-api-key');
  });
});
