import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { StartupStatus } from '@shared/types/app';
import type { TodayJournalSnapshot } from '@shared/types/journal';
import type { ReviewPreviewSnapshot, ReviewProgressEvent, ReviewRunSnapshot } from '@shared/types/review';
import type { SettingsSnapshot } from '@shared/types/settings';
import { JournalEditorCard } from './components/JournalEditorCard';
import { LearningPanel } from './components/LearningPanel';
import { RevealAnswerDialog } from './components/RevealAnswerDialog';
import { ReviewDisclosureDialog } from './components/ReviewDisclosureDialog';
import { SettingsDrawer } from './components/SettingsDrawer';
import { TodayHeader } from './components/TodayHeader';
import { getFocusCorrection } from './components/review-utils';
import type { AppStatusModel, ReviewProgressModel, ReviewState, SaveState } from './components/types';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; journal: TodayJournalSnapshot; settings: SettingsSnapshot; startup: StartupStatus }
  | { status: 'error'; message: string };

const AUTOSAVE_DELAY_MS = 900;

function emptyReviewProgress(): ReviewProgressModel {
  return {
    activeRunId: null,
    events: [],
    currentEvent: null,
    startedAt: null,
  };
}

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
      <main className="grid min-h-screen place-items-center bg-base-200 p-8">
        <div className="rounded-[2rem] border border-base-300 bg-base-100 p-8 text-center shadow-xl">
          <span className="loading loading-spinner loading-lg text-primary" />
          <p className="mt-4 font-medium text-base-content/70">Loading today...</p>
        </div>
      </main>
    );
  }

  if (loadState.status === 'error') {
    return (
      <main className="grid min-h-screen place-items-center bg-base-200 p-8">
        <div className="alert alert-error max-w-lg rounded-[1.5rem] shadow-xl">
          <span>{loadState.message}</span>
        </div>
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
  const [appSettings, setAppSettings] = useState(settings);
  const [journal, setJournal] = useState(initialJournal);
  const [content, setContent] = useState(initialJournal.activeRevision?.content ?? '');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reviewState, setReviewState] = useState<ReviewState>('idle');
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewProgress, setReviewProgress] = useState<ReviewProgressModel>(() => emptyReviewProgress());
  const [latestReviewRun, setLatestReviewRun] = useState<ReviewRunSnapshot | null>(null);
  const [reviewPreview, setReviewPreview] = useState<ReviewPreviewSnapshot | null>(null);
  const [selfRepairAttempt, setSelfRepairAttempt] = useState('');
  const [modelAnswerRevealed, setModelAnswerRevealed] = useState(false);
  const [rewritePracticeInput, setRewritePracticeInput] = useState('');
  const [completedRewritePractice, setCompletedRewritePractice] = useState<TodayJournalSnapshot['pendingRewritePractice']>(null);
  const [rewritePracticeError, setRewritePracticeError] = useState<string | null>(null);
  const [showDisclosure, setShowDisclosure] = useState(false);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [showRevealConfirmation, setShowRevealConfirmation] = useState(false);
  const [providerBaseUrlInput, setProviderBaseUrlInput] = useState(settings.baseUrl);
  const [providerModelInput, setProviderModelInput] = useState(settings.model);
  const [providerApiKeyInput, setProviderApiKeyInput] = useState('');
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const lastSavedContentRef = useRef(initialJournal.activeRevision?.content ?? '');
  const activeReviewRef = useRef(false);

  const hasWritten = content.trim().length > 0;
  const appStatus = useMemo(() => getAppStatus(startup, appSettings), [appSettings, startup]);
  const focusCorrection = reviewPreview ? getFocusCorrection(reviewPreview) : null;
  const highlightedContent = reviewPreview && focusCorrection && reviewPreview.isStaleForCurrentJournal === false ? reviewPreview.reviewedContent : null;
  const highlightedCorrections = reviewPreview && focusCorrection && reviewPreview.isStaleForCurrentJournal === false ? reviewPreview.operations.corrections : [];

  useEffect(() => {
    return window.api.review.onProgress((event: ReviewProgressEvent) => {
      setReviewProgress((current) => {
        if (!activeReviewRef.current || (current.activeRunId && current.activeRunId !== event.runId)) {
          return current;
        }

        return {
          activeRunId: event.runId,
          events: [...current.events, event],
          currentEvent: event,
          startedAt: current.startedAt ?? event.at - event.elapsedMs,
        };
      });
    });
  }, []);

  const saveContent = useCallback(async (nextContent: string): Promise<void> => {
    setSaveState('saving');
    setSaveError(null);

    try {
      const savedJournal = await window.api.journal.saveToday({ content: nextContent });
      lastSavedContentRef.current = savedJournal.activeRevision?.content ?? nextContent;
      setJournal(savedJournal);
      if (savedJournal.staleReview) {
        setReviewPreview(null);
        setLatestReviewRun(null);
      }
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

    activeReviewRef.current = true;
    setReviewState('reviewing');
    setReviewError(null);
    setReviewProgress(emptyReviewProgress());
    setLatestReviewRun(null);
    setReviewPreview(null);
    setSelfRepairAttempt('');
    setModelAnswerRevealed(false);

    try {
      const result = await window.api.review.start({
        journalEntryId: targetJournal.entryId,
        journalRevisionId: targetJournal.activeRevision.id,
      });

      activeReviewRef.current = false;

      if (result.disclosureRequired) {
        setShowDisclosure(true);
        setReviewState('idle');
        return;
      }

      if (result.reviewRun) {
        setLatestReviewRun(result.reviewRun);
        setReviewProgress((current) => ({
          ...current,
          activeRunId: result.reviewRun?.id ?? current.activeRunId,
        }));
      }

      if (result.success === true && result.reviewRun) {
        const preview = await window.api.review.getPreview({ reviewRunId: result.reviewRun.id });
        setReviewPreview(preview);
        setReviewState(preview ? 'ready' : 'failed');
        setJournal(await window.api.journal.getToday());
        if (!preview) {
          setReviewError('Review preview is unavailable.');
        }
        return;
      }

      setReviewState('failed');
      setReviewError(result.error ?? 'Review failed.');
    } catch (error) {
      activeReviewRef.current = false;
      throw error;
    }
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

  const saveReview = useCallback(async (): Promise<void> => {
    if (!reviewPreview) {
      return;
    }

    setReviewState('saving');
    setReviewError(null);
    const result = await window.api.review.save({
      reviewRunId: reviewPreview.reviewRun.id,
      selfRepairAttemptText: selfRepairAttempt,
      revealedWithoutAttempt: modelAnswerRevealed,
    });

    if (result.success && result.journal) {
      setJournal(result.journal);
      setReviewState('saved');
      return;
    }

    setReviewState('failed');
    setReviewError(result.error ?? 'Unable to save review.');
  }, [modelAnswerRevealed, reviewPreview, selfRepairAttempt]);

  const completePendingRewritePractice = useCallback(async (): Promise<void> => {
    if (!journal.pendingRewritePractice) {
      return;
    }

    setRewritePracticeError(null);
    const result = await window.api.journal.completeRewritePractice({
      rewriteTaskId: journal.pendingRewritePractice.id,
      userRewriteText: rewritePracticeInput,
    });

    if (result.success && result.journal && result.rewritePractice) {
      setJournal(result.journal);
      setCompletedRewritePractice(result.rewritePractice);
      setRewritePracticeInput(result.rewritePractice.userRewriteText ?? rewritePracticeInput.trim());
      return;
    }

    setRewritePracticeError(result.error ?? 'Unable to complete rewrite practice.');
  }, [journal.pendingRewritePractice, rewritePracticeInput]);

  const skipPendingRewritePractice = useCallback(async (): Promise<void> => {
    if (!journal.pendingRewritePractice) {
      return;
    }

    setRewritePracticeError(null);
    const result = await window.api.journal.skipRewritePractice({ rewriteTaskId: journal.pendingRewritePractice.id });

    if (result.success && result.journal) {
      setJournal(result.journal);
      setCompletedRewritePractice(null);
      setRewritePracticeInput('');
      return;
    }

    setRewritePracticeError(result.error ?? 'Unable to skip rewrite practice.');
  }, [journal.pendingRewritePractice]);

  const acknowledgeDisclosureAndReview = useCallback(async (): Promise<void> => {
    await window.api.review.acknowledgeDisclosure({ acknowledged: true });
    setShowDisclosure(false);
    await reviewCurrentContent();
  }, [reviewCurrentContent]);

  const saveProviderConfig = useCallback(async (): Promise<void> => {
    setSettingsError(null);
    setSettingsMessage(null);
    try {
      const updatedSettings = await window.api.settings.setProviderConfig({ baseUrl: providerBaseUrlInput, model: providerModelInput });
      setAppSettings(updatedSettings);
      setProviderBaseUrlInput(updatedSettings.baseUrl);
      setProviderModelInput(updatedSettings.model);
      setSettingsMessage('Provider settings saved.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save provider settings.';
      setSettingsError(message);
    }
  }, [providerBaseUrlInput, providerModelInput]);

  const saveProviderApiKey = useCallback(async (): Promise<void> => {
    setSettingsError(null);
    setSettingsMessage(null);
    const result = await window.api.credentials.setProviderApiKey({ apiKey: providerApiKeyInput });
    if (result.success && result.status) {
      setAppSettings({ ...appSettings, providerApiKeyStatus: result.status.status });
      setProviderApiKeyInput('');
      setSettingsMessage('Provider API key saved to the OS keychain.');
      return;
    }
    setSettingsError(result.error ?? 'Unable to save provider API key.');
  }, [appSettings, providerApiKeyInput]);

  const deleteProviderKey = useCallback(async (): Promise<void> => {
    setSettingsError(null);
    setSettingsMessage(null);
    const result = await window.api.credentials.deleteProviderApiKey();
    if (result.success && result.status) {
      setAppSettings({ ...appSettings, providerApiKeyStatus: result.status.status });
      setSettingsMessage('Provider API key deleted.');
      return;
    }
    setSettingsError(result.error ?? 'Unable to delete provider API key.');
  }, [appSettings]);

  const toggleRawResponseStorage = useCallback(async (enabled: boolean): Promise<void> => {
    const rawResponseStorageEnabled = await window.api.settings.setRawResponseStorage({ enabled });
    setAppSettings({ ...appSettings, rawResponseStorageEnabled });
  }, [appSettings]);

  const requestRevealModelAnswer = useCallback((): void => {
    if (modelAnswerRevealed || selfRepairAttempt.trim().length > 0) {
      setModelAnswerRevealed(true);
      return;
    }

    setShowRevealConfirmation(true);
  }, [modelAnswerRevealed, selfRepairAttempt]);

  const revealModelAnswerAfterConfirmation = useCallback((): void => {
    setShowRevealConfirmation(false);
    setModelAnswerRevealed(true);
  }, []);

  return (
    <main className="app-orb-field min-h-screen overflow-hidden bg-base-200 p-4 text-base-content md:p-6">
      <div className="mx-auto flex h-[calc(100vh-2rem)] max-w-[96rem] flex-col gap-4 md:h-[calc(100vh-3rem)]">
        <TodayHeader startup={startup} status={appStatus} onOpenSettings={() => setShowSettingsDrawer(true)} />

        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)]">
          <JournalEditorCard
            content={content}
            lastAutosaveAt={journal.lastAutosaveAt}
            saveState={saveState}
            saveError={saveError}
            highlightedContent={highlightedContent}
            highlightedCorrections={highlightedCorrections}
            onContentChange={setContent}
          />
          <LearningPanel
            journal={journal}
            hasWritten={hasWritten}
            saveState={saveState}
            reviewState={reviewState}
            reviewError={reviewError}
            reviewProgress={reviewProgress}
            latestReviewRun={latestReviewRun}
            preview={reviewPreview}
            selfRepairAttempt={selfRepairAttempt}
            modelAnswerRevealed={modelAnswerRevealed}
            onSelfRepairAttemptChange={setSelfRepairAttempt}
            onRevealModelAnswer={requestRevealModelAnswer}
            onSaveReview={() => {
              void saveReview();
            }}
            rewritePracticeInput={rewritePracticeInput}
            completedRewritePractice={completedRewritePractice}
            rewritePracticeError={rewritePracticeError}
            onRewritePracticeInputChange={(value) => {
              setRewritePracticeInput(value);
              setCompletedRewritePractice(null);
            }}
            onCompleteRewritePractice={() => {
              void completePendingRewritePractice();
            }}
            onSkipRewritePractice={() => {
              void skipPendingRewritePractice();
            }}
            onReviewCurrentVersion={() => {
              void reviewCurrentContent();
            }}
          />
        </div>
      </div>

      <SettingsDrawer
        isOpen={showSettingsDrawer}
        settings={appSettings}
        startup={startup}
        baseUrlInput={providerBaseUrlInput}
        modelInput={providerModelInput}
        apiKeyInput={providerApiKeyInput}
        message={settingsMessage}
        error={settingsError}
        onClose={() => setShowSettingsDrawer(false)}
        onBaseUrlChange={setProviderBaseUrlInput}
        onModelChange={setProviderModelInput}
        onApiKeyChange={setProviderApiKeyInput}
        onSaveProviderConfig={() => {
          void saveProviderConfig();
        }}
        onSaveApiKey={() => {
          void saveProviderApiKey();
        }}
        onDeleteApiKey={() => {
          void deleteProviderKey();
        }}
        onRawResponseStorageChange={(enabled) => {
          void toggleRawResponseStorage(enabled);
        }}
      />

      <RevealAnswerDialog
        isOpen={showRevealConfirmation}
        onCancel={() => setShowRevealConfirmation(false)}
        onReveal={revealModelAnswerAfterConfirmation}
      />

      {showDisclosure ? (
        <ReviewDisclosureDialog
          settings={appSettings}
          onCancel={() => setShowDisclosure(false)}
          onAcknowledge={() => {
            void acknowledgeDisclosureAndReview();
          }}
        />
      ) : null}
    </main>
  );
}

function getAppStatus(startup: StartupStatus, settings: SettingsSnapshot): AppStatusModel {
  if (!startup.databaseReady || !startup.migrationsApplied || settings.providerApiKeyStatus === 'unavailable') {
    return {
      readiness: 'error',
      label: 'Error',
      toneClassName: 'badge-error badge-soft',
      detail: !startup.databaseReady ? 'Database unavailable' : 'Keychain unavailable',
    };
  }

  if (settings.providerApiKeyStatus !== 'configured') {
    return {
      readiness: 'setup-needed',
      label: 'Setup needed',
      toneClassName: 'badge-warning badge-soft',
      detail: 'Add an API key before review',
    };
  }

  return {
    readiness: 'ready',
    label: 'Ready',
    toneClassName: 'badge-success badge-soft',
    detail: 'Review is configured',
  };
}
