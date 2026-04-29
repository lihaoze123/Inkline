import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { StartupStatus } from '@shared/types/app';
import type { TodayJournalSnapshot } from '@shared/types/journal';
import type { SettingsSnapshot } from '@shared/types/settings';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; journal: TodayJournalSnapshot; settings: SettingsSnapshot; startup: StartupStatus }
  | { status: 'error'; message: string };

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type ReviewState = 'idle' | 'reviewing' | 'ready' | 'failed';

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
  const [reviewState, setReviewState] = useState<ReviewState>('idle');
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [showDisclosure, setShowDisclosure] = useState(false);
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

  const startReviewForJournal = useCallback(async (targetJournal: TodayJournalSnapshot): Promise<void> => {
    if (!targetJournal.activeRevision) {
      setReviewState('failed');
      setReviewError('Save your journal before review.');
      return;
    }

    setReviewState('reviewing');
    setReviewError(null);

    const result = await window.api.review.start({
      journalEntryId: targetJournal.entryId,
      journalRevisionId: targetJournal.activeRevision.id,
    });

    if (result.disclosureRequired) {
      setShowDisclosure(true);
      setReviewState('idle');
      return;
    }

    if (result.success === true) {
      setReviewState('ready');
      setJournal(await window.api.journal.getToday());
      return;
    }

    setReviewState('failed');
    setReviewError(result.error ?? 'Review failed.');
  }, []);

  const reviewCurrentContent = useCallback(async (): Promise<void> => {
    try {
      const savedJournal = await window.api.journal.saveToday({ content });
      lastSavedContentRef.current = savedJournal.activeRevision?.content ?? content;
      setJournal(savedJournal);
      setSaveState('saved');
      await startReviewForJournal(savedJournal);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Review failed.';
      setReviewState('failed');
      setReviewError(message);
    }
  }, [content, startReviewForJournal]);

  const handleReviewCurrentVersion = useCallback(() => {
    void reviewCurrentContent();
  }, [reviewCurrentContent]);

  const acknowledgeDisclosureAndReview = useCallback(async (): Promise<void> => {
    await window.api.review.acknowledgeDisclosure({ acknowledged: true });
    setShowDisclosure(false);
    await reviewCurrentContent();
  }, [reviewCurrentContent]);

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
        reviewState={reviewState}
        reviewError={reviewError}
        onReviewCurrentVersion={handleReviewCurrentVersion}
      />

      {showDisclosure ? (
        <ReviewDisclosureDialog
          settings={settings}
          onCancel={() => setShowDisclosure(false)}
          onAcknowledge={() => {
            void acknowledgeDisclosureAndReview();
          }}
        />
      ) : null}
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
  reviewState: ReviewState;
  reviewError: string | null;
  onReviewCurrentVersion: () => void;
};

function LearningPanel({ journal, hasWritten, saveState, reviewState, reviewError, onReviewCurrentVersion }: LearningPanelProps): React.JSX.Element {
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
      {hasWritten ? (
        <AfterWritingState
          lastAutosaveAt={journal.lastAutosaveAt}
          saveState={saveState}
          reviewState={reviewState}
          reviewError={reviewError}
          onReviewCurrentVersion={onReviewCurrentVersion}
        />
      ) : null}
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

function AfterWritingState({
  lastAutosaveAt,
  saveState,
  reviewState,
  reviewError,
  onReviewCurrentVersion,
}: {
  lastAutosaveAt: number | null;
  saveState: SaveState;
  reviewState: ReviewState;
  reviewError: string | null;
  onReviewCurrentVersion: () => void;
}): React.JSX.Element {
  const reviewDisabled = saveState === 'saving' || reviewState === 'reviewing';

  return (
    <section className="panel-block">
      <h3>After writing</h3>
      <button type="button" disabled={reviewDisabled} aria-disabled={reviewDisabled} onClick={onReviewCurrentVersion}>
        {reviewState === 'reviewing' ? 'Reviewing...' : 'Review'}
      </button>
      <p className="muted-panel-copy">
        {lastAutosaveAt ? `Last autosave ${formatTime(lastAutosaveAt)}` : 'Autosave will appear here after writing.'}
      </p>
      {reviewState === 'ready' ? <p className="muted-panel-copy">Review is ready for preview.</p> : null}
      {reviewState === 'failed' ? <p className="muted-panel-copy error">{reviewError ?? 'Review failed.'}</p> : null}
      <p className="muted-panel-copy">Light self-check: read once for the main idea before review.</p>
    </section>
  );
}

function ReviewDisclosureDialog({
  settings,
  onCancel,
  onAcknowledge,
}: {
  settings: SettingsSnapshot;
  onCancel: () => void;
  onAcknowledge: () => void;
}): React.JSX.Element {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="review-disclosure-dialog" role="dialog" aria-modal="true" aria-labelledby="review-disclosure-title">
        <p className="eyebrow">Before first review</p>
        <h2 id="review-disclosure-title">Provider privacy disclosure</h2>
        <p>Your journal stays local by default.</p>
        <p>When you click Review, the current entry and selected learning history will be sent to your configured model provider.</p>
        <dl>
          <div>
            <dt>Provider</dt>
            <dd>{settings.provider}</dd>
          </div>
          <div>
            <dt>Model</dt>
            <dd>{settings.model}</dd>
          </div>
          <div>
            <dt>Local model</dt>
            <dd>{settings.isLocalModel ? 'Yes' : 'No'}</dd>
          </div>
          <div>
            <dt>Review context</dt>
            <dd>{settings.reviewContextDescription}</dd>
          </div>
          <div>
            <dt>Raw model responses saved</dt>
            <dd>{settings.rawResponseStorageEnabled ? 'Yes' : 'No'}</dd>
          </div>
        </dl>
        <div className="dialog-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" onClick={onAcknowledge}>
            I understand, review now
          </button>
        </div>
      </section>
    </div>
  );
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
