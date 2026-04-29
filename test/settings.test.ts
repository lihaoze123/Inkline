import { describe, expect, it } from 'vitest';
import { settingsSnapshotSchema } from '../src/shared/types/settings';

describe('settings defaults contract', () => {
  it('keeps production raw response storage off by default', () => {
    const parsed = settingsSnapshotSchema.parse({
      provider: 'Not configured',
      model: 'Not configured',
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
});
