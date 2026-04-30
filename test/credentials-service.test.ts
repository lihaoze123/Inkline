import { afterEach, describe, expect, it, vi } from 'vitest';

describe('credentials service', () => {
  afterEach(() => {
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
});
