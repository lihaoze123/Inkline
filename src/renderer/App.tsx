import { useEffect, useState } from 'react';
import type { StartupStatus } from '@shared/types/app';
import type { SettingsSnapshot } from '@shared/types/settings';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; settings: SettingsSnapshot; startup: StartupStatus }
  | { status: 'error'; message: string };

export function App(): React.JSX.Element {
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    async function loadFoundationState(): Promise<void> {
      try {
        const [settings, startup] = await Promise.all([
          window.api.settings.get(),
          window.api.app.getStartupStatus(),
        ]);

        if (!cancelled) {
          setLoadState({ status: 'ready', settings, startup });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load application state.';
        if (!cancelled) {
          setLoadState({ status: 'error', message });
        }
      }
    }

    void loadFoundationState();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="app-shell">
      <section className="hero-card" aria-labelledby="app-title">
        <p className="eyebrow">Local-first journal coach</p>
        <h1 id="app-title">English Coach</h1>
        <p className="hero-copy">
          Your journal stays local by default. When you click Review, the current entry and selected learning
          history will be sent to your configured model provider.
        </p>
      </section>

      {loadState.status === 'loading' ? <p className="status-line">Loading local foundation...</p> : null}
      {loadState.status === 'error' ? <p className="status-line error">{loadState.message}</p> : null}
      {loadState.status === 'ready' ? (
        <SettingsShell settings={loadState.settings} startup={loadState.startup} />
      ) : null}
    </main>
  );
}

type SettingsShellProps = {
  settings: SettingsSnapshot;
  startup: StartupStatus;
};

function SettingsShell({ settings, startup }: SettingsShellProps): React.JSX.Element {
  return (
    <section className="settings-card" aria-labelledby="settings-title">
      <div>
        <p className="eyebrow">Settings</p>
        <h2 id="settings-title">Foundation defaults</h2>
      </div>
      <dl className="settings-grid">
        <SettingRow label="Provider" value={settings.provider} />
        <SettingRow label="Model" value={settings.model} />
        <SettingRow label="Local model" value={settings.isLocalModel ? 'Yes' : 'No'} />
        <SettingRow label="Review context sent" value={settings.reviewContextDescription} />
        <SettingRow label="Raw model responses saved" value={settings.rawResponseStorageEnabled ? 'On' : 'Off'} />
        <SettingRow label="Provider API key" value={`${settings.providerApiKeyStatus} via OS keychain`} />
        <SettingRow label="pi-mono auth" value={settings.piMonoAuthStatus} />
        <SettingRow label="AnkiConnect" value={settings.ankiConnectStatus} />
        <SettingRow label="Database ready" value={startup.databaseReady ? 'Yes' : 'No'} />
        <SettingRow label="Database location" value={settings.databaseLocation} />
      </dl>
    </section>
  );
}

type SettingRowProps = {
  label: string;
  value: string;
};

function SettingRow({ label, value }: SettingRowProps): React.JSX.Element {
  return (
    <div className="setting-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
