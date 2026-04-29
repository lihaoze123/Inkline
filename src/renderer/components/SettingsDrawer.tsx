import type { SettingsDrawerProps } from './types';
import { formatProviderKeyStatus } from './format';

export function SettingsDrawer({
  isOpen,
  settings,
  startup,
  baseUrlInput,
  modelInput,
  apiKeyInput,
  message,
  error,
  onClose,
  onBaseUrlChange,
  onModelChange,
  onApiKeyChange,
  onSaveProviderConfig,
  onSaveApiKey,
  onDeleteApiKey,
  onRawResponseStorageChange,
}: SettingsDrawerProps): React.JSX.Element {
  return (
    <div className={`drawer drawer-end ${isOpen ? 'drawer-open' : ''}`}>
      <input className="drawer-toggle" readOnly checked={isOpen} type="checkbox" aria-hidden="true" />
      <div className="drawer-side z-50">
        <button type="button" className="drawer-overlay" aria-label="Close settings" onClick={onClose} />
        <aside className="flex h-full w-full max-w-xl flex-col bg-base-100 p-6 shadow-2xl">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">Settings</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">Live review provider</h2>
              <p className="mt-2 text-sm leading-6 text-base-content/60">Configure the model used only when you click Review.</p>
            </div>
            <button type="button" className="btn btn-ghost btn-circle" aria-label="Close settings" onClick={onClose}>✕</button>
          </div>

          <div className="scrollable min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="grid gap-5">
              <section className="rounded-2xl border border-base-300 bg-base-200/50 p-4">
                <h3 className="font-semibold">Connection</h3>
                <div className="mt-4 grid gap-4">
                  <label className="form-control">
                    <span className="label-text font-medium">Base URL</span>
                    <input className="input input-bordered mt-2" value={baseUrlInput} onChange={(event) => onBaseUrlChange(event.target.value)} aria-label="OpenAI-compatible base URL" />
                  </label>
                  <label className="form-control">
                    <span className="label-text font-medium">Model</span>
                    <input className="input input-bordered mt-2" value={modelInput} onChange={(event) => onModelChange(event.target.value)} aria-label="OpenAI-compatible model" />
                  </label>
                  <button type="button" className="btn btn-primary justify-self-start rounded-2xl" onClick={onSaveProviderConfig}>
                    Save provider settings
                  </button>
                </div>
              </section>

              <section className="rounded-2xl border border-base-300 bg-base-200/50 p-4">
                <h3 className="font-semibold">Credentials</h3>
                <p className="mt-1 text-sm text-base-content/55">API keys are stored through the OS keychain and never returned to the renderer.</p>
                <label className="form-control mt-4">
                  <span className="label-text font-medium">API key</span>
                  <input
                    className="input input-bordered mt-2"
                    value={apiKeyInput}
                    onChange={(event) => onApiKeyChange(event.target.value)}
                    aria-label="Provider API key"
                    type="password"
                    placeholder={settings.providerApiKeyStatus === 'configured' ? 'Key is saved in OS keychain' : 'Paste key to save'}
                  />
                </label>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" className="btn btn-primary rounded-2xl" disabled={apiKeyInput.trim().length === 0} onClick={onSaveApiKey}>Save API key</button>
                  <button type="button" className="btn btn-outline rounded-2xl" disabled={settings.providerApiKeyStatus !== 'configured'} onClick={onDeleteApiKey}>Delete API key</button>
                </div>
              </section>

              <section className="rounded-2xl border border-base-300 bg-base-200/50 p-4">
                <h3 className="font-semibold">Privacy and debug</h3>
                <p className="mt-1 text-sm leading-6 text-base-content/55">Your journal stays local by default. Review sends the current entry and bounded learning context to your configured provider.</p>
                <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-warning/30 bg-warning/10 p-4">
                  <input className="toggle toggle-warning mt-1" type="checkbox" checked={settings.rawResponseStorageEnabled} onChange={(event) => onRawResponseStorageChange(event.target.checked)} />
                  <span>
                    <span className="block font-medium">Save raw model responses for debugging</span>
                    <span className="mt-1 block text-sm text-base-content/55">Raw responses may contain journal content and stay local unless explicitly exported later.</span>
                  </span>
                </label>
              </section>

              <section className="rounded-2xl border border-base-300 bg-base-100 p-4">
                <h3 className="font-semibold">Status</h3>
                <dl className="mt-4 grid gap-3 text-sm">
                  <StatusRow label="Provider" value={settings.provider} />
                  <StatusRow label="Key" value={formatProviderKeyStatus(settings.providerApiKeyStatus)} />
                  <StatusRow label="Local model" value={settings.isLocalModel ? 'Yes' : 'No'} />
                  <StatusRow label="Review context" value={settings.reviewContextDescription} />
                  <StatusRow label="Database" value={startup.databaseReady ? settings.databaseLocation : 'Unavailable'} />
                  <StatusRow label="Migrations" value={startup.migrationsApplied ? 'Applied' : 'Unavailable'} />
                  <StatusRow label="pi-mono" value={settings.piMonoAuthStatus} />
                  <StatusRow label="AnkiConnect" value={settings.ankiConnectStatus} />
                </dl>
              </section>

              {message ? <div className="alert alert-success"><span>{message}</span></div> : null}
              {error ? <div className="alert alert-error"><span>{error}</span></div> : null}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="grid gap-1 border-t border-base-300 pt-3 first:border-t-0 first:pt-0">
      <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-base-content/40">{label}</dt>
      <dd className="break-words text-base-content/75">{value}</dd>
    </div>
  );
}
