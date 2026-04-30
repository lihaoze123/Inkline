import { aiProviderIdSchema, type AiProviderId, type ProviderKeyStatus } from '@shared/types/credentials';
import type { SettingsSnapshot } from '@shared/types/settings';
import type { SettingsDrawerProps } from './types';
import { formatProviderKeyStatus } from './format';

const PROVIDER_LABELS: Record<AiProviderId, string> = {
  'openai-compatible': 'OpenAI-compatible',
  anthropic: 'Anthropic Claude',
};

const PROVIDER_OPTIONS: { value: AiProviderId; label: string }[] = aiProviderIdSchema.options.map((value) => ({
  value,
  label: PROVIDER_LABELS[value],
}));

export function SettingsDrawer({
  isOpen,
  settings,
  startup,
  openAiBaseUrlInput,
  openAiModelInput,
  anthropicModelInput,
  apiKeyInputs,
  message,
  error,
  onClose,
  onDefaultProviderChange,
  onOpenAiBaseUrlChange,
  onOpenAiModelChange,
  onAnthropicModelChange,
  onApiKeyChange,
  onSaveOpenAiConfig,
  onSaveAnthropicConfig,
  onSaveApiKey,
  onDeleteApiKey,
  onRawResponseStorageChange,
}: SettingsDrawerProps): React.JSX.Element {
  const aiModelSettings = settings.aiModelSettings;
  const defaultProviderId = aiModelSettings?.defaultProviderId ?? settings.providerId ?? 'openai-compatible';
  const openAiSettings = aiModelSettings?.providers['openai-compatible'];
  const anthropicSettings = aiModelSettings?.providers.anthropic;
  const openAiCredentialStatus = getCredentialStatus(settings, 'openai-compatible');
  const anthropicCredentialStatus = getCredentialStatus(settings, 'anthropic');

  return (
    <div className={`drawer drawer-end ${isOpen ? 'drawer-open' : ''}`}>
      <input className="drawer-toggle" readOnly checked={isOpen} type="checkbox" aria-hidden="true" />
      <div className="drawer-side z-50">
        <button type="button" className="drawer-overlay" aria-label="Close settings" onClick={onClose} />
        <aside className="flex h-full w-full max-w-xl flex-col bg-base-100 p-6 shadow-2xl">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">Settings</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">AI provider</h2>
              <p className="mt-2 text-sm leading-6 text-base-content/60">
                Configure the global provider used for review and starter prompt generation.
              </p>
            </div>
            <button type="button" className="btn btn-ghost btn-circle" aria-label="Close settings" onClick={onClose}>
              ✕
            </button>
          </div>

          <div className="scrollable min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="grid gap-5">
              <section className="rounded-2xl border border-base-300 bg-base-200/50 p-4">
                <h3 className="font-semibold">Global default</h3>
                <p className="mt-1 text-sm leading-6 text-base-content/55">
                  This first UI version uses one global default provider/model. Feature-specific model overrides are
                  reserved internally for later.
                </p>
                <label className="form-control mt-4">
                  <span className="label-text font-medium">Default provider</span>
                  <select
                    className="select select-bordered mt-2"
                    value={defaultProviderId}
                    aria-label="Default AI provider"
                    onChange={(event) => onDefaultProviderChange(event.target.value as AiProviderId)}
                  >
                    {PROVIDER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </section>

              <section className="rounded-2xl border border-base-300 bg-base-200/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">OpenAI-compatible</h3>
                    <p className="mt-1 text-sm text-base-content/55">
                      Use OpenAI or another OpenAI-compatible endpoint.
                    </p>
                  </div>
                  <span className="badge badge-outline">{formatProviderKeyStatus(openAiCredentialStatus.status)}</span>
                </div>
                <div className="mt-4 grid gap-4">
                  <label className="form-control">
                    <span className="label-text font-medium">Base URL</span>
                    <input
                      className="input input-bordered mt-2"
                      value={openAiBaseUrlInput}
                      onChange={(event) => onOpenAiBaseUrlChange(event.target.value)}
                      aria-label="OpenAI-compatible base URL"
                    />
                  </label>
                  <label className="form-control">
                    <span className="label-text font-medium">Model</span>
                    <input
                      className="input input-bordered mt-2"
                      value={openAiModelInput}
                      onChange={(event) => onOpenAiModelChange(event.target.value)}
                      aria-label="OpenAI-compatible model"
                    />
                  </label>
                  <button
                    type="button"
                    className="btn btn-primary justify-self-start rounded-2xl"
                    onClick={onSaveOpenAiConfig}
                  >
                    Save OpenAI-compatible settings
                  </button>
                  <ProviderCredentialForm
                    providerId="openai-compatible"
                    providerName="OpenAI-compatible"
                    status={openAiCredentialStatus}
                    apiKeyInput={apiKeyInputs['openai-compatible']}
                    onApiKeyChange={onApiKeyChange}
                    onSaveApiKey={onSaveApiKey}
                    onDeleteApiKey={onDeleteApiKey}
                  />
                  {openAiSettings ? (
                    <p className="text-xs text-base-content/45">Current saved model: {openAiSettings.model}</p>
                  ) : null}
                </div>
              </section>

              <section className="rounded-2xl border border-base-300 bg-base-200/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">Anthropic Claude</h3>
                    <p className="mt-1 text-sm text-base-content/55">
                      Use Anthropic's Claude models with a separate key.
                    </p>
                  </div>
                  <span className="badge badge-outline">
                    {formatProviderKeyStatus(anthropicCredentialStatus.status)}
                  </span>
                </div>
                <div className="mt-4 grid gap-4">
                  <label className="form-control">
                    <span className="label-text font-medium">Model</span>
                    <input
                      className="input input-bordered mt-2"
                      value={anthropicModelInput}
                      onChange={(event) => onAnthropicModelChange(event.target.value)}
                      aria-label="Anthropic model"
                    />
                  </label>
                  <button
                    type="button"
                    className="btn btn-primary justify-self-start rounded-2xl"
                    onClick={onSaveAnthropicConfig}
                  >
                    Save Anthropic settings
                  </button>
                  <ProviderCredentialForm
                    providerId="anthropic"
                    providerName="Anthropic Claude"
                    status={anthropicCredentialStatus}
                    apiKeyInput={apiKeyInputs.anthropic}
                    onApiKeyChange={onApiKeyChange}
                    onSaveApiKey={onSaveApiKey}
                    onDeleteApiKey={onDeleteApiKey}
                  />
                  {anthropicSettings ? (
                    <p className="text-xs text-base-content/45">Current saved model: {anthropicSettings.model}</p>
                  ) : null}
                </div>
              </section>

              <section className="rounded-2xl border border-base-300 bg-base-200/50 p-4">
                <h3 className="font-semibold">Privacy and debug</h3>
                <p className="mt-1 text-sm leading-6 text-base-content/55">
                  Your writing stays local by default. Review sends the current writing, template context, and bounded
                  learning context to your configured provider.
                </p>
                <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-warning/30 bg-warning/10 p-4">
                  <input
                    className="toggle toggle-warning mt-1"
                    type="checkbox"
                    checked={settings.rawResponseStorageEnabled}
                    onChange={(event) => onRawResponseStorageChange(event.target.checked)}
                  />
                  <span>
                    <span className="block font-medium">Save raw model responses for debugging</span>
                    <span className="mt-1 block text-sm text-base-content/55">
                      Raw responses may contain writing content and stay local unless explicitly exported later.
                    </span>
                  </span>
                </label>
              </section>

              <section className="rounded-2xl border border-base-300 bg-base-100 p-4">
                <h3 className="font-semibold">Status</h3>
                <dl className="mt-4 grid gap-3 text-sm">
                  <StatusRow label="Default provider" value={settings.provider} />
                  <StatusRow label="Default model" value={settings.model} />
                  <StatusRow
                    label="OpenAI-compatible key"
                    value={formatProviderKeyStatus(openAiCredentialStatus.status)}
                  />
                  <StatusRow label="Anthropic key" value={formatProviderKeyStatus(anthropicCredentialStatus.status)} />
                  <StatusRow label="Local model" value={settings.isLocalModel ? 'Yes' : 'No'} />
                  <StatusRow label="Review context" value={settings.reviewContextDescription} />
                  <StatusRow
                    label="Database"
                    value={startup.databaseReady ? settings.databaseLocation : 'Unavailable'}
                  />
                  <StatusRow label="Migrations" value={startup.migrationsApplied ? 'Applied' : 'Unavailable'} />
                  <StatusRow label="pi-mono" value={settings.piMonoAuthStatus} />
                  <StatusRow label="AnkiConnect" value={settings.ankiConnectStatus} />
                </dl>
              </section>

              {message ? (
                <div className="alert alert-success">
                  <span>{message}</span>
                </div>
              ) : null}
              {error ? (
                <div className="alert alert-error">
                  <span>{error}</span>
                </div>
              ) : null}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ProviderCredentialForm({
  providerId,
  providerName,
  status,
  apiKeyInput,
  onApiKeyChange,
  onSaveApiKey,
  onDeleteApiKey,
}: {
  providerId: AiProviderId;
  providerName: string;
  status: ProviderKeyStatus;
  apiKeyInput: string;
  onApiKeyChange: (providerId: AiProviderId, value: string) => void;
  onSaveApiKey: (providerId: AiProviderId) => void;
  onDeleteApiKey: (providerId: AiProviderId) => void;
}): React.JSX.Element {
  return (
    <div className="rounded-2xl border border-base-300 bg-base-100 p-4">
      <h4 className="font-medium">{providerName} credentials</h4>
      <p className="mt-1 text-sm text-base-content/55">
        API keys are stored through the OS keychain and never returned to the renderer.
      </p>
      <label className="form-control mt-4">
        <span className="label-text font-medium">API key</span>
        <input
          className="input input-bordered mt-2"
          value={apiKeyInput}
          onChange={(event) => onApiKeyChange(providerId, event.target.value)}
          aria-label={`${providerName} API key`}
          type="password"
          placeholder={status.status === 'configured' ? 'Key is saved in OS keychain' : 'Paste key to save'}
        />
      </label>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-primary rounded-2xl"
          disabled={apiKeyInput.trim().length === 0}
          onClick={() => onSaveApiKey(providerId)}
        >
          Save API key
        </button>
        <button
          type="button"
          className="btn btn-outline rounded-2xl"
          disabled={status.status !== 'configured'}
          onClick={() => onDeleteApiKey(providerId)}
        >
          Delete API key
        </button>
      </div>
    </div>
  );
}

function getCredentialStatus(settings: SettingsSnapshot, providerId: AiProviderId): ProviderKeyStatus {
  const status =
    settings.providerCredentialStatuses?.[providerId] ?? settings.aiModelSettings?.providers[providerId].apiKeyStatus;
  if (status) {
    return status;
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

function StatusRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="grid gap-1 border-t border-base-300 pt-3 first:border-t-0 first:pt-0">
      <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-base-content/40">{label}</dt>
      <dd className="break-words text-base-content/75">{value}</dd>
    </div>
  );
}
