import type { SettingsSnapshot } from '@shared/types/settings';

export function formatProviderKeyStatus(status: SettingsSnapshot['providerApiKeyStatus']): string {
  if (status === 'configured') {
    return 'Configured';
  }

  if (status === 'unavailable') {
    return 'Keychain unavailable';
  }

  return 'Not configured';
}

export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
