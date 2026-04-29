import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { StartupStatus } from '@shared/types/app';
import type { TodayJournalSnapshot } from '@shared/types/journal';
import type { AnchoredCorrectionOperationSnapshot, ReviewPreviewSnapshot } from '@shared/types/review';
import type { SettingsSnapshot } from '@shared/types/settings';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; journal: TodayJournalSnapshot; settings: SettingsSnapshot; startup: StartupStatus }
  | { status: 'error'; message: string };

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type ReviewState = 'idle' | 'reviewing' | 'ready' | 'saving' | 'saved' | 'failed';

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
  const [reviewPreview, setReviewPreview] = useState<ReviewPreviewSnapshot | null>(null);
  const [selfRepairAttempt, setSelfRepairAttempt] = useState('');
  const [modelAnswerRevealed, setModelAnswerRevealed] = useState(false);
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
      if (savedJournal.staleReview) {
        setReviewPreview(null);
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

    setReviewState('reviewing');
    setReviewError(null);
    setReviewPreview(null);
    setSelfRepairAttempt('');
    setModelAnswerRevealed(false);

    const result = await window.api.review.start({
      journalEntryId: targetJournal.entryId,
      journalRevisionId: targetJournal.activeRevision.id,
    });

    if (result.disclosureRequired) {
      setShowDisclosure(true);
      setReviewState('idle');
      return;
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

  const handleReviewCurrentVersion = useCallback(() => {
    void reviewCurrentContent();
  }, [reviewCurrentContent]);

  const acknowledgeDisclosureAndReview = useCallback(async (): Promise<void> => {
    await window.api.review.acknowledgeDisclosure({ acknowledged: true });
    setShowDisclosure(false);
    await reviewCurrentContent();
  }, [reviewCurrentContent]);

  const focusCorrection = reviewPreview ? getFocusCorrection(reviewPreview) : null;
  const canRevealAnswer = modelAnswerRevealed || selfRepairAttempt.trim().length > 0;

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
        {reviewPreview && focusCorrection && reviewPreview.isStaleForCurrentJournal === false ? (
          <HighlightedJournal content={reviewPreview.reviewedContent} corrections={reviewPreview.operations.corrections} />
        ) : null}
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
        preview={reviewPreview}
        selfRepairAttempt={selfRepairAttempt}
        modelAnswerRevealed={canRevealAnswer}
        onSelfRepairAttemptChange={setSelfRepairAttempt}
        onRevealModelAnswer={() => setModelAnswerRevealed(true)}
        onSaveReview={() => {
          void saveReview();
        }}
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
  preview: ReviewPreviewSnapshot | null;
  selfRepairAttempt: string;
  modelAnswerRevealed: boolean;
  onSelfRepairAttemptChange: (value: string) => void;
  onRevealModelAnswer: () => void;
  onSaveReview: () => void;
  onReviewCurrentVersion: () => void;
};

function LearningPanel({
  journal,
  hasWritten,
  saveState,
  reviewState,
  reviewError,
  preview,
  selfRepairAttempt,
  modelAnswerRevealed,
  onSelfRepairAttemptChange,
  onRevealModelAnswer,
  onSaveReview,
  onReviewCurrentVersion,
}: LearningPanelProps): React.JSX.Element {
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
      {hasWritten && preview ? (
        <ReviewPreview
          preview={preview}
          reviewState={reviewState}
          selfRepairAttempt={selfRepairAttempt}
          modelAnswerRevealed={modelAnswerRevealed}
          onSelfRepairAttemptChange={onSelfRepairAttemptChange}
          onRevealModelAnswer={onRevealModelAnswer}
          onSaveReview={onSaveReview}
        />
      ) : null}
      {hasWritten && !preview ? (
        <AfterWritingState
          lastAutosaveAt={journal.lastAutosaveAt}
          saveState={saveState}
          reviewState={reviewState}
          reviewError={reviewError}
          onReviewCurrentVersion={onReviewCurrentVersion}
        />
      ) : null}
      {reviewError && preview ? <p className="muted-panel-copy error">{reviewError}</p> : null}
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
      {reviewState === 'failed' ? <p className="muted-panel-copy error">{reviewError ?? 'Review failed.'}</p> : null}
      <p className="muted-panel-copy">Light self-check: read once for the main idea before review.</p>
    </section>
  );
}

function ReviewPreview({
  preview,
  reviewState,
  selfRepairAttempt,
  modelAnswerRevealed,
  onSelfRepairAttemptChange,
  onRevealModelAnswer,
  onSaveReview,
}: {
  preview: ReviewPreviewSnapshot;
  reviewState: ReviewState;
  selfRepairAttempt: string;
  modelAnswerRevealed: boolean;
  onSelfRepairAttemptChange: (value: string) => void;
  onRevealModelAnswer: () => void;
  onSaveReview: () => void;
}): React.JSX.Element {
  const focusCorrection = getFocusCorrection(preview);
  const topCorrections = preview.operations.corrections.filter(
    (correction) => correction.status !== 'low_confidence' && correction.correctionIndex !== focusCorrection?.correctionIndex
  );
  const lowConfidenceCorrections = preview.operations.corrections.filter((correction) => correction.status === 'low_confidence');
  const firstReferenceRewrite = preview.operations.referenceRewrites[0];
  const firstRewritePractice = preview.operations.rewritePractice[0];

  if (!focusCorrection || !preview.operations.selfRepair) {
    return (
      <section className="panel-block">
        <h3>Review unavailable</h3>
        <p>This review does not contain exactly one focus correction.</p>
      </section>
    );
  }

  return (
    <section className="panel-block review-preview" aria-label="Review preview">
      <h3>What you did well</h3>
      <ul>{preview.parsedOutput.summary.whatWentWell.map((item) => <li key={item}>{item}</li>)}</ul>

      <h3>Today's Focus Pattern</h3>
      <CorrectionCard correction={focusCorrection} showAnswer={modelAnswerRevealed} reason={preview.parsedOutput.summary.focusPattern.reason} />

      <h3>Try fixing this</h3>
      <p>{preview.operations.selfRepair.prompt}</p>
      <p className="hint-box">Hint: {preview.operations.selfRepair.hint}</p>
      <textarea
        className="self-repair-input"
        value={selfRepairAttempt}
        onChange={(event) => onSelfRepairAttemptChange(event.target.value)}
        placeholder="Try your own correction before revealing the model answer."
        aria-label="Self-repair attempt"
      />
      <button type="button" className="secondary-button" onClick={onRevealModelAnswer}>
        Reveal model answer
      </button>
      {modelAnswerRevealed ? <p className="model-answer">Model answer: {focusCorrection.correctedText}</p> : null}

      <h3>Top corrections</h3>
      {topCorrections.length > 0 ? topCorrections.map((correction) => <CorrectionCard correction={correction} key={correction.correctionIndex} showAnswer />) : <p>No other anchored corrections.</p>}

      {lowConfidenceCorrections.length > 0 ? (
        <section className="other-suggestions" aria-label="Other suggestions">
          <h3>Other suggestions</h3>
          {lowConfidenceCorrections.map((correction) => <CorrectionCard correction={correction} key={correction.correctionIndex} showAnswer />)}
          <p className="muted-panel-copy">These are low-confidence suggestions and will not update pattern counts or rewrite practice.</p>
        </section>
      ) : null}

      {firstReferenceRewrite ? (
        <section>
          <h3>Reference rewrite / Notice the gap</h3>
          <p>{firstReferenceRewrite.text}</p>
          <p className="hint-box">Notice the gap: {firstReferenceRewrite.noticeTheGap}</p>
        </section>
      ) : null}

      {firstRewritePractice ? (
        <section>
          <h3>Practice this sentence</h3>
          <p>{firstRewritePractice.prompt}</p>
          <input className="rewrite-practice-input" aria-label="Rewrite practice" placeholder="Practice this tomorrow." disabled />
          <button type="button" className="secondary-button" disabled>
            Skip
          </button>
        </section>
      ) : null}

      <button type="button" disabled={reviewState === 'saving' || reviewState === 'saved'} onClick={onSaveReview}>
        {reviewState === 'saving' ? 'Saving review...' : reviewState === 'saved' ? 'Review saved' : 'Save review and update learning history'}
      </button>
    </section>
  );
}

function CorrectionCard({ correction, showAnswer, reason }: { correction: AnchoredCorrectionOperationSnapshot; showAnswer: boolean; reason?: string }): React.JSX.Element {
  return (
    <article className={`correction-card ${correction.status === 'low_confidence' ? 'low-confidence' : ''}`}>
      <p><strong>Pattern:</strong> {correction.matchedPatternId ?? patternRule(correction) ?? correction.category}</p>
      <p><strong>You wrote:</strong> {correction.originalText}</p>
      {showAnswer ? <p><strong>Try:</strong> {correction.correctedText}</p> : <p><strong>Try:</strong> Hidden until you try or reveal.</p>}
      <p><strong>Why:</strong> {reason ?? correction.explanation}</p>
    </article>
  );
}

function HighlightedJournal({ content, corrections }: { content: string; corrections: AnchoredCorrectionOperationSnapshot[] }): React.JSX.Element {
  const anchoredCorrections = corrections
    .filter((correction) => correction.status !== 'low_confidence' && correction.startOffset !== null && correction.endOffset !== null)
    .sort((left, right) => (left.startOffset ?? 0) - (right.startOffset ?? 0));
  const parts: React.ReactNode[] = [];
  let cursor = 0;

  anchoredCorrections.forEach((correction) => {
    const startOffset = correction.startOffset ?? 0;
    const endOffset = correction.endOffset ?? startOffset;
    if (startOffset < cursor) {
      return;
    }
    parts.push(content.slice(cursor, startOffset));
    parts.push(<mark key={`${startOffset}-${endOffset}`}>{content.slice(startOffset, endOffset)}</mark>);
    cursor = endOffset;
  });
  parts.push(content.slice(cursor));

  return <div className="highlighted-journal" aria-label="Reviewed text with anchored highlights">{parts}</div>;
}

function getFocusCorrection(preview: ReviewPreviewSnapshot): AnchoredCorrectionOperationSnapshot | null {
  const focusIndex = preview.parsedOutput.summary.focusPattern.correctionIndex;
  const matches = preview.operations.corrections.filter((correction) => correction.correctionIndex === focusIndex && correction.status !== 'low_confidence');
  return matches.length === 1 ? matches[0] : null;
}

function patternRule(correction: AnchoredCorrectionOperationSnapshot): string | null {
  const suggestion = correction.newPatternSuggestion;
  if (typeof suggestion === 'object' && suggestion !== null && 'rule' in suggestion && typeof (suggestion as { rule?: unknown }).rule === 'string') {
    return (suggestion as { rule: string }).rule;
  }
  return null;
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
