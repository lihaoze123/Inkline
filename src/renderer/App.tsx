import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { StartupStatus } from '@shared/types/app';
import type { TodayJournalSnapshot } from '@shared/types/journal';
import type { SettingsSnapshot } from '@shared/types/settings';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; journal: TodayJournalSnapshot; settings: SettingsSnapshot; startup: StartupStatus }
  | { status: 'error'; message: string };

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const AUTOSAVE_DELAY_MS = 900;

export function App(): React.JSX.Element {
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    async function loadFoundationState(): Promise<void> {
      try {
        const [journal, settings, startup] = await Promise.all([
          window.api.journal.getToday(),
          window.api.settings.get(),
          window.api.app.getStartupStatus(),
        ]);

        if (!cancelled) {
          setLoadState({ status: 'ready', journal, settings, startup });
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

  if (loadState.status === 'loading') {
    return (
      <main className="app-shell">
        <p className="status-line">Loading today...</p>
      </main>
    );
  }

  if (loadState.status === 'error') {
    return (
      <main className="app-shell">
        <p className="status-line error">{loadState.message}</p>
      </main>
    );
  }

  return <TodayPage initialJournal={loadState.journal} settings={loadState.settings} startup={loadState.startup} />;
}

type TodayPageProps = {
  initialJournal: TodayJournalSnapshot;
  settings: SettingsSnapshot;
  startup: StartupStatus;
};

function TodayPage({ initialJournal, settings, startup }: TodayPageProps): React.JSX.Element {
  const [journal, setJournal] = useState(initialJournal);
  const [content, setContent] = useState(initialJournal.activeRevision?.content ?? '');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const lastSavedContentRef = useRef(initialJournal.activeRevision?.content ?? '');

  const hasWritten = content.trim().length > 0;
  const editorModel = useMemo(
    () => ({
      content,
      contentHash: journal.activeRevision?.contentHash ?? null,
      revisionId: journal.activeRevision?.id ?? null,
    }),
    [content, journal.activeRevision?.contentHash, journal.activeRevision?.id]
  );

  const saveContent = useCallback(async (nextContent: string): Promise<void> => {
    setSaveState('saving');
    setSaveError(null);

    try {
      const savedJournal = await window.api.journal.saveToday({ content: nextContent });
      lastSavedContentRef.current = savedJournal.activeRevision?.content ?? nextContent;
      setJournal(savedJournal);
      setSaveState('saved');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Autosave failed.';
      setSaveError(message);
      setSaveState('error');
    }
  }, []);

  useEffect(() => {
    if (content === lastSavedContentRef.current) {
      return;
    }

    setSaveState('idle');
    const timeoutId = window.setTimeout(() => {
      void saveContent(content);
    }, AUTOSAVE_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [content, saveContent]);

  const handleReviewCurrentVersion = useCallback(() => {
    void saveContent(content);
  }, [content, saveContent]);

  return (
    <main className="today-shell">
      <section className="today-status" aria-labelledby="today-title">
        <div>
          <p className="eyebrow">Today</p>
          <h1 id="today-title">Write freely first.</h1>
        </div>
        <div className="foundation-status" aria-label="Local app status">
          <span>{startup.databaseReady ? 'Local database ready' : 'Database unavailable'}</span>
          <span>Raw model responses: {settings.rawResponseStorageEnabled ? 'On' : 'Off'}</span>
        </div>
      </section>

      <section className="journal-card" aria-labelledby="journal-editor-title">
        <div className="journal-header">
          <div>
            <p className="eyebrow">Journal editor</p>
            <h2 id="journal-editor-title">Today's journal</h2>
          </div>
          <AutosaveStatus state={saveState} lastAutosaveAt={journal.lastAutosaveAt} error={saveError} />
        </div>
        <textarea
          className="journal-editor"
          value={editorModel.content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Write about your day in English. No redlines, no corrections while you write."
          aria-label="Today's English journal"
          spellCheck={false}
        />
      </section>

      <LearningPanel
        journal={journal}
        hasWritten={hasWritten}
        saveState={saveState}
        onReviewCurrentVersion={handleReviewCurrentVersion}
      />
    </main>
  );
}

type AutosaveStatusProps = {
  state: SaveState;
  lastAutosaveAt: number | null;
  error: string | null;
};

function AutosaveStatus({ state, lastAutosaveAt, error }: AutosaveStatusProps): React.JSX.Element {
  if (state === 'saving') {
    return <p className="autosave-status">Autosaving...</p>;
  }

  if (state === 'error') {
    return <p className="autosave-status error">{error ?? 'Autosave failed.'}</p>;
  }

  if (lastAutosaveAt) {
    return <p className="autosave-status">Last autosave {formatTime(lastAutosaveAt)}</p>;
  }

  return <p className="autosave-status">Not saved yet</p>;
}

type LearningPanelProps = {
  journal: TodayJournalSnapshot;
  hasWritten: boolean;
  saveState: SaveState;
  onReviewCurrentVersion: () => void;
};

function LearningPanel({ journal, hasWritten, saveState, onReviewCurrentVersion }: LearningPanelProps): React.JSX.Element {
  return (
    <aside className="learning-panel" aria-labelledby="learning-panel-title">
      <div>
        <p className="eyebrow">Learning panel</p>
        <h2 id="learning-panel-title">Next step</h2>
      </div>

      {journal.staleReview ? (
        <section className="panel-block stale-review" aria-label="Stale review">
          <p>This review is based on an earlier version of your journal.</p>
          <button type="button" onClick={onReviewCurrentVersion}>
            Review current version
          </button>
        </section>
      ) : null}

      {!hasWritten ? <BeforeWritingState dateKey={journal.dateKey} /> : null}
      {hasWritten ? <AfterWritingState lastAutosaveAt={journal.lastAutosaveAt} saveState={saveState} /> : null}
    </aside>
  );
}

function BeforeWritingState({ dateKey }: { dateKey: string }): React.JSX.Element {
  return (
    <section className="panel-block">
      <h3>Before writing</h3>
      <p>Today's journal is ready for {dateKey}. Start with free writing; feedback comes later.</p>
      <p className="muted-panel-copy">No pending rewrite practice yet.</p>
    </section>
  );
}

function AfterWritingState({ lastAutosaveAt, saveState }: { lastAutosaveAt: number | null; saveState: SaveState }): React.JSX.Element {
  const reviewDisabled = saveState === 'saving';

  return (
    <section className="panel-block">
      <h3>After writing</h3>
      <button type="button" disabled={reviewDisabled} aria-disabled={reviewDisabled}>
        Review
      </button>
      <p className="muted-panel-copy">
        {lastAutosaveAt ? `Last autosave ${formatTime(lastAutosaveAt)}` : 'Autosave will appear here after writing.'}
      </p>
      <p className="muted-panel-copy">Light self-check: read once for the main idea before review.</p>
    </section>
  );
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
