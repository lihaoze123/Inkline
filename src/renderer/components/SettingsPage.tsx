import { aiProviderIdSchema, type AiProviderId, type ProviderKeyStatus } from '@shared/types/credentials';
import type { SettingsSnapshot } from '@shared/types/settings';
import type { SettingsPageProps } from './types';
import { formatProviderKeyStatus } from './format';

const PROVIDER_LABELS: Record<AiProviderId, string> = {
  'openai-compatible': 'OpenAI-compatible',
  anthropic: 'Anthropic Claude',
};

const PROVIDER_OPTIONS: { value: AiProviderId; label: string }[] = aiProviderIdSchema.options.map((value) => ({
  value,
  label: PROVIDER_LABELS[value],
}));

export function SettingsPage({
  settings,
  startup,
  openAiBaseUrlInput,
  openAiModelInput,
  anthropicModelInput,
  apiKeyInputs,
  message,
  error,
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
  onViewWelcomeIntro,
}: SettingsPageProps): React.JSX.Element {
  const aiModelSettings = settings.aiModelSettings;
  const defaultProviderId = aiModelSettings?.defaultProviderId ?? settings.providerId ?? 'openai-compatible';
  const openAiSettings = aiModelSettings?.providers['openai-compatible'];
  const anthropicSettings = aiModelSettings?.providers.anthropic;
  const openAiCredentialStatus = getCredentialStatus(settings, 'openai-compatible');
  const anthropicCredentialStatus = getCredentialStatus(settings, 'anthropic');

  return (
    <section className="flex min-h-0 flex-col" aria-labelledby="settings-page-title">
      <div className="mb-10 pb-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">Settings</p>
        <h1 id="settings-page-title" className="editorial-heading mt-4 text-5xl text-base-content">
          AI provider
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-base-content/60">
          Configure the provider used for Coach feedback and optional starter prompts.
        </p>
      </div>

      <div className="scrollable min-h-0 flex-1 overflow-y-auto pr-1" style={{ scrollbarGutter: 'stable' }}>
        <div className="grid max-w-4xl gap-12 pb-8">
          <section>
            <h2 className="editorial-copy text-2xl text-base-content">Global default</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-base-content/55">
              This first UI version uses one global default provider/model. Feature-specific model overrides are
              reserved internally for later.
            </p>
            <div className="mt-5 grid gap-5">
              <FormRow label="Default provider" htmlFor="default-provider-select">
                <select
                  id="default-provider-select"
                  className="select select-bordered w-full"
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
              </FormRow>
            </div>
          </section>

          <ProviderSettingsSection
            providerId="openai-compatible"
            title="OpenAI-compatible"
            description="Use OpenAI or another OpenAI-compatible base endpoint, such as https://api.deepseek.com/v1."
            status={openAiCredentialStatus}
            apiKeyInput={apiKeyInputs['openai-compatible']}
            onApiKeyChange={onApiKeyChange}
            onSaveApiKey={onSaveApiKey}
            onDeleteApiKey={onDeleteApiKey}
            onSaveSettings={onSaveOpenAiConfig}
          >
            <FormRow
              label="Base URL"
              htmlFor="openai-base-url-input"
              helperText="Paste the provider base URL; /chat/completions is removed automatically."
            >
              <input
                id="openai-base-url-input"
                className="input input-bordered w-full"
                value={openAiBaseUrlInput}
                onChange={(event) => onOpenAiBaseUrlChange(event.target.value)}
                aria-label="OpenAI-compatible base URL"
                placeholder="https://api.deepseek.com/v1"
              />
            </FormRow>
            <FormRow
              label="Model"
              htmlFor="openai-model-input"
              helperText={openAiSettings ? `Current saved model: ${openAiSettings.model}` : undefined}
            >
              <input
                id="openai-model-input"
                className="input input-bordered w-full"
                value={openAiModelInput}
                onChange={(event) => onOpenAiModelChange(event.target.value)}
                aria-label="OpenAI-compatible model"
              />
            </FormRow>
          </ProviderSettingsSection>

          <ProviderSettingsSection
            providerId="anthropic"
            title="Anthropic Claude"
            description="Use Anthropic's Claude models with a separate key."
            status={anthropicCredentialStatus}
            apiKeyInput={apiKeyInputs.anthropic}
            onApiKeyChange={onApiKeyChange}
            onSaveApiKey={onSaveApiKey}
            onDeleteApiKey={onDeleteApiKey}
            onSaveSettings={onSaveAnthropicConfig}
          >
            <FormRow
              label="Model"
              htmlFor="anthropic-model-input"
              helperText={anthropicSettings ? `Current saved model: ${anthropicSettings.model}` : undefined}
            >
              <input
                id="anthropic-model-input"
                className="input input-bordered w-full"
                value={anthropicModelInput}
                onChange={(event) => onAnthropicModelChange(event.target.value)}
                aria-label="Anthropic model"
              />
            </FormRow>
          </ProviderSettingsSection>

          <section>
            <h2 className="editorial-copy text-2xl text-base-content">Privacy and debug</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-base-content/55">
              Your writing stays local by default. Review sends the current writing, template context, and bounded
              learning context to your configured provider.
            </p>
            <div className="mt-5 grid gap-5">
              <FormRow
                label="Raw responses"
                htmlFor="raw-response-storage-toggle"
                helperText="Raw responses may contain writing content and stay local unless explicitly exported later."
              >
                <label className="flex max-w-xl cursor-pointer items-start gap-3 border-l border-warning/45 pl-4">
                  <input
                    id="raw-response-storage-toggle"
                    className="toggle toggle-warning mt-1"
                    type="checkbox"
                    checked={settings.rawResponseStorageEnabled}
                    onChange={(event) => onRawResponseStorageChange(event.target.checked)}
                  />
                  <span className="font-medium">Save raw model responses for debugging</span>
                </label>
              </FormRow>
            </div>
          </section>

          <section className="border-t border-base-300/60 pt-6" aria-labelledby="settings-welcome-title">
            <h2 id="settings-welcome-title" className="sr-only">
              Welcome intro
            </h2>
            <button
              type="button"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              onClick={onViewWelcomeIntro}
            >
              View welcome intro
            </button>
          </section>

          <section>
            <h2 className="editorial-copy text-2xl text-base-content">Status</h2>
            <dl className="mt-5 grid gap-4 text-sm">
              <StatusRow label="Default provider" value={settings.provider} />
              <StatusRow label="Default model" value={settings.model} />
              <StatusRow label="OpenAI-compatible key" value={formatProviderKeyStatus(openAiCredentialStatus.status)} />
              <StatusRow label="Anthropic key" value={formatProviderKeyStatus(anthropicCredentialStatus.status)} />
              <StatusRow label="Local model" value={settings.isLocalModel ? 'Yes' : 'No'} />
              <StatusRow label="Review context" value={settings.reviewContextDescription} />
              <StatusRow label="Database" value={startup.databaseReady ? settings.databaseLocation : 'Unavailable'} />
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
    </section>
  );
}

function ProviderSettingsSection({
  providerId,
  title,
  description,
  status,
  apiKeyInput,
  children,
  onApiKeyChange,
  onSaveApiKey,
  onDeleteApiKey,
  onSaveSettings,
}: {
  providerId: AiProviderId;
  title: string;
  description: string;
  status: ProviderKeyStatus;
  apiKeyInput: string;
  children: React.ReactNode;
  onApiKeyChange: (providerId: AiProviderId, value: string) => void;
  onSaveApiKey: (providerId: AiProviderId) => void;
  onDeleteApiKey: (providerId: AiProviderId) => void;
  onSaveSettings: () => void;
}): React.JSX.Element {
  const statusText = formatProviderKeyStatus(status.status);

  return (
    <section>
      <div>
        <h2 className="editorial-copy text-2xl text-base-content">{title}</h2>
        <p className="mt-1 text-sm text-base-content/50">
          Key status: {statusText}; storage: {status.storage}
        </p>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-base-content/55">{description}</p>
      </div>

      <div className="mt-5 grid gap-5">
        {children}
        <FormRow
          label="API key"
          htmlFor={`${providerId}-api-key-input`}
          helperText="API keys are stored through the OS keychain and never returned to the renderer."
        >
          <input
            id={`${providerId}-api-key-input`}
            className="input input-bordered w-full"
            value={apiKeyInput}
            onChange={(event) => onApiKeyChange(providerId, event.target.value)}
            aria-label={`${title} API key`}
            type="password"
            placeholder={status.status === 'configured' ? 'Key is saved in OS keychain' : 'Paste key to save'}
          />
        </FormRow>
        <div className="grid gap-2 md:grid-cols-[10rem_minmax(0,36rem)] md:items-center">
          <div aria-hidden="true" />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-outline rounded-[0.7rem]" onClick={onSaveSettings}>
              Save settings
            </button>
            <button
              type="button"
              className="btn btn-outline rounded-[0.7rem]"
              disabled={apiKeyInput.trim().length === 0}
              onClick={() => onSaveApiKey(providerId)}
            >
              Save API key
            </button>
            <button
              type="button"
              className="btn btn-ghost rounded-[0.7rem] text-base-content/65"
              disabled={status.status !== 'configured'}
              onClick={() => onDeleteApiKey(providerId)}
            >
              Delete key
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function FormRow({
  label,
  htmlFor,
  helperText,
  children,
}: {
  label: string;
  htmlFor: string;
  helperText?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="grid gap-2 md:grid-cols-[10rem_minmax(0,36rem)] md:items-start">
      <label className="pt-0 text-sm font-medium text-base-content/72 md:pt-3" htmlFor={htmlFor}>
        {label}
      </label>
      <div className="max-w-xl">
        {children}
        {helperText ? <p className="mt-1 max-w-xl text-xs leading-5 text-base-content/45">{helperText}</p> : null}
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
    <div className="grid gap-2 md:grid-cols-[10rem_minmax(0,36rem)]">
      <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-base-content/40 md:pt-1">{label}</dt>
      <dd className="max-w-xl break-words text-base-content/72">{value}</dd>
    </div>
  );
}
