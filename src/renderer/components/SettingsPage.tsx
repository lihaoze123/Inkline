import { aiProviderIdSchema, type AiProviderId, type ProviderKeyStatus } from '@shared/types/credentials';
import type { SettingsSnapshot } from '@shared/types/settings';
import type { SettingsPageProps } from './types';
import { formatProviderKeyStatus } from './format';

const PROVIDER_LABELS: Record<AiProviderId, string> = {
  openai: 'OpenAI',
  deepseek: 'DeepSeek',
  anthropic: 'Anthropic Claude',
  google: 'Google Gemini',
  xai: 'xAI Grok',
  openrouter: 'OpenRouter',
  'openai-compatible': 'Custom OpenAI-compatible',
};

const PROVIDER_DESCRIPTIONS: Record<AiProviderId, string> = {
  openai: 'Use OpenAI hosted models with the official AI SDK OpenAI provider.',
  deepseek: 'Use DeepSeek hosted models with provider-specific thinking controls.',
  anthropic: "Use Anthropic's Claude models with a separate key.",
  google: 'Use Google Gemini hosted models with documented thinking budget controls.',
  xai: 'Use xAI Grok hosted models with documented reasoning effort controls.',
  openrouter: 'Use OpenRouter model routes with the documented OpenRouter AI SDK provider.',
  'openai-compatible': 'Use a custom OpenAI-compatible endpoint for local models, proxies, or unsupported providers.',
};

const PROVIDER_OPTIONS: { value: AiProviderId; label: string }[] = aiProviderIdSchema.options.map((value) => ({
  value,
  label: PROVIDER_LABELS[value],
}));

export function SettingsPage({
  settings,
  startup,
  openAiCompatibleBaseUrlInput,
  providerModelInputs,
  apiKeyInputs,
  message,
  error,
  onDefaultProviderChange,
  onOpenAiCompatibleBaseUrlChange,
  onProviderModelChange,
  onApiKeyChange,
  onSaveProviderSettings,
  onDeleteApiKey,
  onRawResponseStorageChange,
  onReviewThinkingChange,
  onViewWelcomeIntro,
}: SettingsPageProps): React.JSX.Element {
  const aiModelSettings = settings.aiModelSettings;
  const defaultProviderId = aiModelSettings?.defaultProviderId ?? settings.providerId ?? 'openai-compatible';
  const selectedProviderSettings = aiModelSettings?.providers[defaultProviderId];
  const selectedProviderTitle = PROVIDER_LABELS[defaultProviderId];
  const selectedCredentialStatus = getCredentialStatus(settings, defaultProviderId);

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
            <h2 className="editorial-copy text-2xl text-base-content">AI provider</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-base-content/55">
              Choose the provider first, then configure only the settings for that provider.
            </p>
            <div className="mt-5 grid gap-8">
              <FormRow label="Provider" htmlFor="default-provider-select">
                <select
                  id="default-provider-select"
                  className="select select-bordered w-full"
                  value={defaultProviderId}
                  aria-label="Default AI provider"
                  data-e2e="default-provider-select"
                  onChange={(event) => onDefaultProviderChange(event.target.value as AiProviderId)}
                >
                  {PROVIDER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FormRow>

              <ProviderSettingsSection
                providerId={defaultProviderId}
                title={selectedProviderTitle}
                description={PROVIDER_DESCRIPTIONS[defaultProviderId]}
                status={selectedCredentialStatus}
                apiKeyInput={apiKeyInputs[defaultProviderId]}
                onApiKeyChange={onApiKeyChange}
                onDeleteApiKey={onDeleteApiKey}
                onSaveSettings={() => onSaveProviderSettings(defaultProviderId)}
              >
                {defaultProviderId === 'openai-compatible' ? (
                  <FormRow
                    label="Base URL"
                    htmlFor="openai-base-url-input"
                    helperText="Only custom OpenAI-compatible endpoints need a manual base URL."
                  >
                    <input
                      id="openai-base-url-input"
                      className="input input-bordered w-full"
                      value={openAiCompatibleBaseUrlInput}
                      onChange={(event) => onOpenAiCompatibleBaseUrlChange(event.target.value)}
                      aria-label="Custom OpenAI-compatible base URL"
                      placeholder="http://localhost:11434/v1"
                      data-e2e="openai-base-url-input"
                    />
                  </FormRow>
                ) : null}
                <FormRow
                  label="Model"
                  htmlFor={`${defaultProviderId}-model-input`}
                  helperText={
                    selectedProviderSettings ? `Current saved model: ${selectedProviderSettings.model}` : undefined
                  }
                >
                  <input
                    id={`${defaultProviderId}-model-input`}
                    className="input input-bordered w-full"
                    value={providerModelInputs[defaultProviderId]}
                    onChange={(event) => onProviderModelChange(defaultProviderId, event.target.value)}
                    aria-label={`${selectedProviderTitle} model`}
                    data-e2e={`${defaultProviderId}-model-input`}
                  />
                </FormRow>
              </ProviderSettingsSection>
            </div>
          </section>

          <section>
            <h2 className="editorial-copy text-2xl text-base-content">Review behavior</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-base-content/55">
              Your writing stays local by default. Review sends the current writing, template context, and bounded
              learning context to your configured provider.
            </p>
            <div className="mt-5 grid gap-5">
              <FormRow
                label="Thinking"
                htmlFor="review-thinking-toggle"
                helperText="Off by default. Turning this on can make reviews much slower and may consume provider reasoning tokens."
              >
                <label className="flex max-w-xl cursor-pointer items-start gap-3 border-l border-info/45 pl-4">
                  <input
                    id="review-thinking-toggle"
                    className="toggle toggle-info mt-1"
                    type="checkbox"
                    checked={settings.reviewThinkingEnabled}
                    onChange={(event) => onReviewThinkingChange(event.target.checked)}
                  />
                  <span className="font-medium">Enable thinking for review calls</span>
                </label>
              </FormRow>
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
              <StatusRow
                label={`${selectedProviderTitle} key`}
                value={formatProviderKeyStatus(selectedCredentialStatus.status)}
              />
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
  onDeleteApiKey: (providerId: AiProviderId) => void;
  onSaveSettings: () => void;
}): React.JSX.Element {
  const statusText = formatProviderKeyStatus(status.status);

  return (
    <section data-e2e={`${providerId}-provider-settings`}>
      <div>
        <h3 className="editorial-copy text-2xl text-base-content">{title}</h3>
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
          helperText="API keys are stored through the OS keychain and never returned to the renderer. Leave blank to keep the saved key unchanged."
        >
          <input
            id={`${providerId}-api-key-input`}
            className="input input-bordered w-full"
            value={apiKeyInput}
            onChange={(event) => onApiKeyChange(providerId, event.target.value)}
            aria-label={`${title} API key`}
            type="password"
            placeholder={status.status === 'configured' ? 'Key is saved in OS keychain' : 'Paste key to save'}
            data-e2e={`${providerId}-api-key-input`}
          />
        </FormRow>
        <div className="grid gap-2 md:grid-cols-[10rem_minmax(0,36rem)] md:items-center">
          <div aria-hidden="true" />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-outline rounded-[0.7rem]"
              data-e2e={`${providerId}-save-settings`}
              onClick={onSaveSettings}
            >
              Save provider
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
