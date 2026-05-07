import type { StartupStatus } from '../types/app';
import type { AiProviderId, ProviderKeyStatus } from '../types/credentials';
import type { ProviderSettings, SettingsSnapshot } from '../types/settings';

export type BetaReadinessStatus = 'ready' | 'needs_setup' | 'unavailable';
export type BetaReadinessRowStatus = BetaReadinessStatus | 'info';

export type BetaReadinessRowId =
  | 'database'
  | 'migrations'
  | 'provider'
  | 'model'
  | 'base_url'
  | 'keychain'
  | 'validation';

export type BetaReadinessRow = {
  id: BetaReadinessRowId;
  label: string;
  value: string;
  status: BetaReadinessRowStatus;
  detail?: string;
  action?: string;
};

export type BetaReadinessDiagnostics = {
  status: BetaReadinessStatus;
  label: string;
  description: string;
  rows: BetaReadinessRow[];
};

export function resolveSettingsProviderId(settings: SettingsSnapshot): AiProviderId {
  return settings.aiModelSettings?.defaultProviderId ?? settings.providerId ?? 'openai-compatible';
}

export function resolveProviderCredentialStatus(
  settings: SettingsSnapshot,
  providerId: AiProviderId,
): ProviderKeyStatus {
  const snapshotStatus = settings.providerCredentialStatuses?.[providerId];
  if (snapshotStatus) {
    return snapshotStatus;
  }

  const providerSettings = settings.aiModelSettings?.providers[providerId];
  if (providerSettings) {
    return providerSettings.apiKeyStatus;
  }

  return {
    providerId,
    status:
      providerId === settings.providerId || (providerId === 'openai-compatible' && !settings.providerId)
        ? settings.providerApiKeyStatus
        : 'not-configured',
    storage: 'os-keychain',
  };
}

export function deriveBetaReadinessDiagnostics(input: {
  startup: StartupStatus;
  settings: SettingsSnapshot;
}): BetaReadinessDiagnostics {
  const { startup, settings } = input;
  const providerId = resolveSettingsProviderId(settings);
  const providerSettings = settings.aiModelSettings?.providers[providerId];
  const providerName = resolveProviderName(settings, providerSettings);
  const model = resolveProviderModel(settings, providerId, providerSettings);
  const credentialStatus = resolveProviderCredentialStatus(settings, providerId);
  const rows: BetaReadinessRow[] = [
    deriveDatabaseRow(startup),
    deriveMigrationRow(startup),
    {
      id: 'provider',
      label: 'Selected provider',
      value: providerName,
      status: providerName.trim().length > 0 ? 'ready' : 'needs_setup',
      action: providerName.trim().length > 0 ? undefined : 'Choose and save an AI provider in Settings.',
    },
    {
      id: 'model',
      label: 'Model',
      value: model.length > 0 ? model : 'Missing',
      status: model.length > 0 ? 'ready' : 'needs_setup',
      action: model.length > 0 ? undefined : `Save a model ID for ${providerName}.`,
    },
    deriveBaseUrlRow(settings, providerId, providerSettings),
    deriveKeychainRow(providerName, credentialStatus),
    {
      id: 'validation',
      label: 'Model-output validation',
      value: 'Structured validation boundary is active.',
      status: 'ready',
      detail: 'Diagnostics do not run a live provider request.',
    },
  ];
  const status = deriveOverallStatus(rows);

  return {
    status,
    label: statusLabel(status),
    description: statusDescription(status),
    rows,
  };
}

function deriveDatabaseRow(startup: StartupStatus): BetaReadinessRow {
  if (startup.databaseReady) {
    return {
      id: 'database',
      label: 'Local database',
      value: startup.databaseLocation,
      status: 'ready',
    };
  }

  return {
    id: 'database',
    label: 'Local database',
    value: `Unavailable at ${startup.databaseLocation}`,
    status: 'unavailable',
    action: 'Restart Inkline and check access to the local database file.',
  };
}

function deriveMigrationRow(startup: StartupStatus): BetaReadinessRow {
  if (startup.migrationsApplied) {
    return {
      id: 'migrations',
      label: 'Migrations',
      value: 'Applied',
      status: 'ready',
    };
  }

  return {
    id: 'migrations',
    label: 'Migrations',
    value: 'Not applied',
    status: 'unavailable',
    action: 'Restart Inkline so local migrations can run.',
  };
}

function deriveBaseUrlRow(
  settings: SettingsSnapshot,
  providerId: AiProviderId,
  providerSettings: ProviderSettings | undefined,
): BetaReadinessRow {
  if (providerId !== 'openai-compatible') {
    return {
      id: 'base_url',
      label: 'Base URL',
      value: 'Not required for hosted provider',
      status: 'info',
    };
  }

  const baseUrl = resolveOpenAiCompatibleBaseUrl(settings, providerSettings);
  if (baseUrl.length > 0) {
    return {
      id: 'base_url',
      label: 'Base URL',
      value: baseUrl,
      status: 'ready',
    };
  }

  return {
    id: 'base_url',
    label: 'Base URL',
    value: 'Missing',
    status: 'needs_setup',
    action: 'Add the custom OpenAI-compatible base URL.',
  };
}

function deriveKeychainRow(providerName: string, credentialStatus: ProviderKeyStatus): BetaReadinessRow {
  const storageLabel = credentialStatus.storage === 'os-keychain' ? 'OS keychain' : credentialStatus.storage;

  if (credentialStatus.status === 'configured') {
    return {
      id: 'keychain',
      label: 'API key',
      value: `Configured in ${storageLabel}`,
      status: 'ready',
    };
  }

  if (credentialStatus.status === 'unavailable') {
    return {
      id: 'keychain',
      label: 'API key',
      value: `${storageLabel} unavailable`,
      status: 'unavailable',
      action: 'Check OS keychain access, then save the API key again.',
    };
  }

  return {
    id: 'keychain',
    label: 'API key',
    value: `Not configured in ${storageLabel}`,
    status: 'needs_setup',
    action: `Save an API key for ${providerName}.`,
  };
}

function resolveProviderName(settings: SettingsSnapshot, providerSettings: ProviderSettings | undefined): string {
  return providerSettings?.provider ?? settings.provider;
}

function resolveProviderModel(
  settings: SettingsSnapshot,
  providerId: AiProviderId,
  providerSettings: ProviderSettings | undefined,
): string {
  const providerModel = providerSettings?.model.trim() ?? '';
  if (providerModel.length > 0) {
    return providerModel;
  }

  if (!settings.aiModelSettings || settings.providerId === providerId) {
    return settings.model.trim();
  }

  return '';
}

function resolveOpenAiCompatibleBaseUrl(
  settings: SettingsSnapshot,
  providerSettings: ProviderSettings | undefined,
): string {
  if (providerSettings && 'baseUrl' in providerSettings) {
    return providerSettings.baseUrl.trim();
  }

  return settings.baseUrl.trim();
}

function deriveOverallStatus(rows: BetaReadinessRow[]): BetaReadinessStatus {
  if (rows.some((row) => row.status === 'unavailable')) {
    return 'unavailable';
  }

  if (rows.some((row) => row.status === 'needs_setup')) {
    return 'needs_setup';
  }

  return 'ready';
}

function statusLabel(status: BetaReadinessStatus): string {
  switch (status) {
    case 'ready':
      return 'Configuration ready';
    case 'needs_setup':
      return 'Setup needed';
    case 'unavailable':
      return 'Unavailable';
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function statusDescription(status: BetaReadinessStatus): string {
  switch (status) {
    case 'ready':
      return 'Inkline has the local data and saved provider configuration needed to start review. No live provider request was run.';
    case 'needs_setup':
      return 'Finish the listed setup items before asking Inkline to review writing.';
    case 'unavailable':
      return 'A local dependency is unavailable. Fix the listed item before running review.';
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
