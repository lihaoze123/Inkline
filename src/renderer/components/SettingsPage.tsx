import { aiProviderIdSchema, type AiProviderId, type ProviderKeyStatus } from '@shared/types/credentials';
import {
  deriveBetaReadinessDiagnostics,
  resolveProviderCredentialStatus,
  resolveSettingsProviderId,
  type BetaReadinessDiagnostics,
  type BetaReadinessRowStatus,
} from '@shared/diagnostics/beta-readiness';
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
  openai: 'Connect OpenAI for hosted writing feedback and starter prompts.',
  deepseek: 'Connect DeepSeek when you want DeepSeek-hosted review models.',
  anthropic: 'Connect Claude models for review and starter prompts.',
  google: 'Connect Gemini models for review and starter prompts.',
  xai: 'Connect Grok models for review and starter prompts.',
  openrouter: 'Route review calls through OpenRouter with the model you choose.',
  'openai-compatible': 'Use a local or self-hosted OpenAI-compatible endpoint.',
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
  includeRawProviderOutputInHistoryExport,
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
  onIncludeRawProviderOutputInHistoryExportChange,
  onExportLearningHistory,
  onCreateLearningHistoryBackup,
  onPreviewLearningHistoryImport,
  onViewWelcomeIntro,
}: SettingsPageProps): React.JSX.Element {
  const aiModelSettings = settings.aiModelSettings;
  const defaultProviderId = resolveSettingsProviderId(settings);
  const selectedProviderSettings = aiModelSettings?.providers[defaultProviderId];
  const selectedProviderTitle = PROVIDER_LABELS[defaultProviderId];
  const selectedCredentialStatus = resolveProviderCredentialStatus(settings, defaultProviderId);
  const readinessDiagnostics = deriveBetaReadinessDiagnostics({ startup, settings });

  return (
    <section className="flex min-h-0 flex-col" aria-labelledby="settings-page-title">
      <div className="ui-chrome mb-10 pb-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">Settings</p>
        <h1 id="settings-page-title" className="editorial-heading mt-4 text-5xl text-base-content">
          AI provider
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-base-content/60">
          Choose the model provider Inkline uses when you ask for feedback or a starter prompt.
        </p>
      </div>

      <div className="scrollable min-h-0 flex-1 overflow-y-auto pr-1" style={{ scrollbarGutter: 'stable' }}>
        <div className="grid max-w-4xl gap-12 pb-8">
          <SettingsReadinessSection diagnostics={readinessDiagnostics} />

          <section>
            <h2 className="editorial-copy text-2xl text-base-content">AI provider</h2>
            <p className="ui-chrome mt-1 max-w-2xl text-sm leading-6 text-base-content/55">
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
                <ProviderModelField
                  providerId={defaultProviderId}
                  title={selectedProviderTitle}
                  value={providerModelInputs[defaultProviderId]}
                  savedModel={selectedProviderSettings?.model}
                  onChange={onProviderModelChange}
                />
              </ProviderSettingsSection>
            </div>
          </section>

          <section>
            <h2 className="editorial-copy text-2xl text-base-content">Review behavior</h2>
            <p className="ui-chrome mt-2 max-w-2xl text-sm leading-6 text-base-content/55">
              Your writing stays local until you ask for feedback. Review sends only the current draft and bounded
              learning context to the provider you configured.
            </p>
            <div className="mt-5 grid gap-5">
              <FormRow
                label="Thinking"
                htmlFor="review-thinking-toggle"
                helperText="Off by default. Enable only when your selected model benefits from reasoning mode."
              >
                <label className="flex max-w-xl cursor-pointer items-start gap-3 rounded-lg bg-base-100/25 p-3">
                  <input
                    id="review-thinking-toggle"
                    className="toggle toggle-info mt-1"
                    type="checkbox"
                    checked={settings.reviewThinkingEnabled}
                    onChange={(event) => onReviewThinkingChange(event.target.checked)}
                  />
                  <span className="font-medium">Use thinking for reviews</span>
                </label>
              </FormRow>
              <FormRow
                label="Raw responses"
                htmlFor="raw-response-storage-toggle"
                helperText="For troubleshooting only. Raw responses can include writing content and remain stored locally."
              >
                <label className="flex max-w-xl cursor-pointer items-start gap-3 rounded-lg bg-base-100/25 p-3">
                  <input
                    id="raw-response-storage-toggle"
                    className="toggle toggle-warning mt-1"
                    type="checkbox"
                    checked={settings.rawResponseStorageEnabled}
                    onChange={(event) => onRawResponseStorageChange(event.target.checked)}
                  />
                  <span className="font-medium">Keep raw model responses</span>
                </label>
              </FormRow>
            </div>
          </section>

          <section>
            <h2 className="editorial-copy text-2xl text-base-content">Learning history</h2>
            <p className="ui-chrome mt-2 max-w-2xl text-sm leading-6 text-base-content/55">
              Export user-owned writing history as JSON, create a local backup, or preview a selected export before any
              restore flow exists. Raw provider output is excluded unless you explicitly include it here.
            </p>
            <div className="mt-5 grid gap-5">
              <FormRow
                label="Raw output"
                htmlFor="learning-history-raw-output-toggle"
                helperText="Leave off for normal exports and backups."
              >
                <label className="flex max-w-xl cursor-pointer items-start gap-3 rounded-lg bg-base-100/25 p-3">
                  <input
                    id="learning-history-raw-output-toggle"
                    className="toggle toggle-warning mt-1"
                    type="checkbox"
                    checked={includeRawProviderOutputInHistoryExport}
                    data-e2e="learning-history-raw-output-toggle"
                    onChange={(event) => onIncludeRawProviderOutputInHistoryExportChange(event.target.checked)}
                  />
                  <span className="font-medium">Include raw provider output</span>
                </label>
              </FormRow>
              <div className="grid gap-2 md:grid-cols-[10rem_minmax(0,36rem)] md:items-start">
                <div aria-hidden="true" />
                <div className="flex max-w-xl flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-outline rounded-[0.7rem]"
                    data-e2e="learning-history-export"
                    onClick={onExportLearningHistory}
                  >
                    Export JSON
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline rounded-[0.7rem]"
                    data-e2e="learning-history-backup"
                    onClick={onCreateLearningHistoryBackup}
                  >
                    Create backup
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost rounded-[0.7rem] text-base-content/65"
                    data-e2e="learning-history-preview-import"
                    onClick={onPreviewLearningHistoryImport}
                  >
                    Preview import
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="ui-chrome" aria-labelledby="settings-welcome-title">
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

          <details className="text-sm text-base-content/62">
            <summary className="ui-chrome cursor-pointer font-medium text-base-content/55">Connection status</summary>
            <dl className="mt-5 grid gap-4">
              <StatusRow label="Default provider" value={settings.provider} />
              <StatusRow label="Default model" value={settings.model} />
              <StatusRow
                label={`${selectedProviderTitle} key`}
                value={formatProviderKeyStatus(selectedCredentialStatus.status)}
              />
              <StatusRow label="Local model" value={settings.isLocalModel ? 'Yes' : 'No'} />
              <StatusRow label="Review context" value={settings.reviewContextDescription} />
              <StatusRow label="Database" value={startup.databaseReady ? startup.databaseLocation : 'Unavailable'} />
              <StatusRow label="Migrations" value={startup.migrationsApplied ? 'Applied' : 'Unavailable'} />
              <StatusRow label="pi-mono" value={settings.piMonoAuthStatus} />
              <StatusRow label="AnkiConnect" value={settings.ankiConnectStatus} />
            </dl>
          </details>

          {message ? (
            <div className="alert alert-success">
              <span>{message}</span>
            </div>
          ) : null}
          {error ? (
            <div className="alert alert-error">
              <span className="selectable-content">{error}</span>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function SettingsReadinessSection({ diagnostics }: { diagnostics: BetaReadinessDiagnostics }): React.JSX.Element {
  return (
    <section aria-labelledby="settings-readiness-title" data-e2e="settings-readiness-diagnostics">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="settings-readiness-title" className="editorial-copy text-2xl text-base-content">
          Beta readiness
        </h2>
        <span
          className="ui-chrome inline-flex items-center gap-2 text-sm font-medium text-base-content/65"
          data-status={diagnostics.status}
        >
          <span className={`h-2.5 w-2.5 rounded-full ${statusDotClass(diagnostics.status)}`} aria-hidden="true" />
          {diagnostics.label}
        </span>
      </div>
      <p className="ui-chrome mt-2 max-w-2xl text-sm leading-6 text-base-content/55">{diagnostics.description}</p>
      <dl className="mt-5 divide-y divide-base-300/45 border-y border-base-300/45">
        {diagnostics.rows.map((row) => (
          <div key={row.id} className="grid gap-2 py-3 md:grid-cols-[10rem_minmax(0,1fr)_8rem] md:items-start">
            <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-base-content/40 md:pt-1">
              {row.label}
            </dt>
            <dd className="min-w-0">
              <p className="selectable-content break-words text-sm text-base-content/76">{row.value}</p>
              {row.detail ? <p className="mt-1 text-xs leading-5 text-base-content/48">{row.detail}</p> : null}
              {row.action ? (
                <p className="mt-1 text-xs font-medium leading-5 text-base-content/62">{row.action}</p>
              ) : null}
            </dd>
            <dd className="ui-chrome text-xs font-semibold uppercase tracking-[0.12em] text-base-content/46 md:pt-1">
              {rowStatusLabel(row.status)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ProviderModelField({
  providerId,
  title,
  value,
  savedModel,
  onChange,
}: {
  providerId: AiProviderId;
  title: string;
  value: string;
  savedModel?: string;
  onChange: (providerId: AiProviderId, value: string) => void;
}): React.JSX.Element {
  const helperText = savedModel
    ? `Current saved model: ${savedModel}. Enter the exact model ID you want Inkline to use.`
    : 'Enter the exact model ID you want Inkline to use.';

  return (
    <FormRow label="Model" htmlFor={`${providerId}-model-input`} helperText={helperText}>
      <input
        id={`${providerId}-model-input`}
        className="input input-bordered w-full"
        value={value}
        onChange={(event) => onChange(providerId, event.target.value)}
        aria-label={`${title} model ID`}
        placeholder={`Enter ${title} model ID`}
        data-e2e={`${providerId}-model-input`}
      />
    </FormRow>
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
      <div className="ui-chrome">
        <h3 className="editorial-copy text-2xl text-base-content">{title}</h3>
        <p className="mt-1 text-sm text-base-content/50">
          Key: {statusText} · Storage: {status.storage}
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

function StatusRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="grid gap-2 md:grid-cols-[10rem_minmax(0,36rem)]">
      <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-base-content/40 md:pt-1">{label}</dt>
      <dd className="selectable-content max-w-xl break-words text-base-content/72">{value}</dd>
    </div>
  );
}

function rowStatusLabel(status: BetaReadinessRowStatus): string {
  switch (status) {
    case 'ready':
      return 'Ready';
    case 'needs_setup':
      return 'Setup needed';
    case 'unavailable':
      return 'Unavailable';
    case 'info':
      return 'Info';
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function statusDotClass(status: BetaReadinessRowStatus): string {
  switch (status) {
    case 'ready':
      return 'bg-success';
    case 'needs_setup':
      return 'bg-warning';
    case 'unavailable':
      return 'bg-error';
    case 'info':
      return 'bg-base-content/30';
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
