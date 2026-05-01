import { useEffect, useState } from 'react';
import type { WritingAttemptSnapshot } from '@shared/types/writing';
import type {
  PreviewOperationsSnapshot,
  ReviewErrorCategory,
  ReviewPreviewSnapshot,
  ReviewProgressPhase,
  ReviewRunSnapshot,
  ReviewRunSummary,
} from '@shared/types/review';
import { formatTime } from './format';
import { CorrectionCard, getFocusCorrection, patternRule } from './review-utils';
import type { LearningPanelProps, ReviewProgressModel, ReviewState, SaveState } from './types';

export function LearningPanel({
  writing,
  hasWritten,
  saveState,
  reviewState,
  reviewError,
  reviewProgress,
  latestReviewRun,
  preview,
  selfRepairAttempt,
  modelAnswerRevealed,
  onSelfRepairAttemptChange,
  onRevealModelAnswer,
  onSaveReview,
  rewritePracticeInput,
  completedRewritePractice,
  rewritePracticeError,
  onRewritePracticeInputChange,
  onCompleteRewritePractice,
  onSkipRewritePractice,
  onReviewCurrentVersion,
}: LearningPanelProps): React.JSX.Element {
  const panelEyebrow = preview ? 'Feedback & Rewrite' : reviewState === 'reviewing' ? 'Coach is reading' : 'Coach';
  const panelTitle = preview
    ? 'One useful pattern'
    : reviewState === 'reviewing'
      ? 'Reading your draft'
      : hasWritten
        ? 'Ready for feedback'
        : 'Write first';
  const panelCopy = preview
    ? 'Review the focus note, try your own rewrite, then save the learning step.'
    : reviewState === 'reviewing'
      ? 'Finding a small, transferable improvement instead of grading every sentence.'
      : hasWritten
        ? 'Ask for feedback when your draft says what you wanted to say.'
        : 'No corrections while you write. The coach waits until you finish.';

  return (
    <aside
      className="scrollable flex min-h-0 flex-col gap-5 overflow-y-auto border-l border-base-300/60 pl-5"
      aria-labelledby="learning-panel-title"
    >
      <div className="pb-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/70">{panelEyebrow}</p>
        <h2 id="learning-panel-title" className="editorial-copy mt-2 text-xl text-base-content">
          {panelTitle}
        </h2>
        <p className="mt-2 text-sm leading-6 text-base-content/55">{panelCopy}</p>
      </div>

      {!preview ? <HelpfulHintsCard /> : null}

      {writing.staleReview ? <StaleReviewCard onReviewCurrentVersion={onReviewCurrentVersion} /> : null}

      {writing.pendingRewritePractice || completedRewritePractice ? (
        <RewritePracticeCard
          practice={completedRewritePractice ?? writing.pendingRewritePractice}
          inputValue={rewritePracticeInput}
          error={rewritePracticeError}
          onInputChange={onRewritePracticeInputChange}
          onComplete={onCompleteRewritePractice}
          onSkip={onSkipRewritePractice}
        />
      ) : null}

      {!hasWritten ? (
        <BeforeWritingState
          dateKey={writing.dateKey}
          hasPendingRewritePractice={Boolean(writing.pendingRewritePractice || completedRewritePractice)}
        />
      ) : null}
      {hasWritten && reviewState === 'reviewing' ? <ReviewProgressCard progress={reviewProgress} /> : null}
      {hasWritten && preview ? (
        <ReviewPreview
          preview={preview}
          reviewState={reviewState}
          selfRepairAttempt={selfRepairAttempt}
          modelAnswerRevealed={modelAnswerRevealed}
          onSelfRepairAttemptChange={onSelfRepairAttemptChange}
          onRevealModelAnswer={onRevealModelAnswer}
          onSaveReview={onSaveReview}
          onReviewCurrentVersion={onReviewCurrentVersion}
        />
      ) : null}
      {hasWritten && !preview ? (
        <AfterWritingState
          lastAutosaveAt={writing.lastAutosaveAt}
          saveState={saveState}
          reviewState={reviewState}
          reviewError={reviewError}
          latestReviewRun={latestReviewRun}
          onReviewCurrentVersion={onReviewCurrentVersion}
        />
      ) : null}
      {reviewError && preview ? (
        <div className="alert alert-error">
          <span>{reviewError}</span>
        </div>
      ) : null}
    </aside>
  );
}

const reviewPhases: ReviewProgressPhase[] = ['preparing', 'requesting', 'waiting', 'checking', 'building_preview'];

const phaseLabels: Record<ReviewProgressPhase, string> = {
  preparing: 'Reading your draft',
  requesting: 'Opening the coach notebook',
  waiting: 'Finding one useful pattern',
  checking: 'Checking the feedback carefully',
  building_preview: 'Preparing your rewrite practice',
};

const phaseDescriptions: Record<ReviewProgressPhase, string> = {
  preparing: 'Looking at your current draft and practice context.',
  requesting: 'Sending only the review context after disclosure.',
  waiting: 'The provider is preparing focused feedback.',
  checking: 'Making sure anchors, confidence, and learning actions are reliable.',
  building_preview: 'Turning the review into a small rewrite step you can inspect before saving.',
};

const errorTitles: Record<ReviewErrorCategory, string> = {
  missing_config: 'Review needs setup',
  provider_error: 'AI service connection failed',
  timeout: 'AI service is taking too long',
  invalid_json: 'AI response could not be read',
  validation_failed: 'AI suggestions were not reliable enough',
  stale_content: 'Review is out of date',
};

function HelpfulHintsCard(): React.JSX.Element {
  return (
    <section className="border-t border-base-300/55 pt-5">
      <h3 className="editorial-copy flex items-center gap-3 text-lg text-base-content">
        <span className="inline-icon text-warning" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M9 18h6" />
            <path d="M10 22h4" />
            <path d="M8.5 14a6 6 0 1 1 7 0c-.7.5-1 1.1-1 2h-5c0-.9-.3-1.5-1-2Z" />
          </svg>
        </span>
        Helpful hints
      </h3>
      <ul className="mt-4 grid gap-3 text-sm leading-6 text-base-content/64">
        <li className="flex gap-3"><span className="mt-2 size-1.5 rounded-full bg-secondary/60" />Write independently before asking for feedback.</li>
        <li className="flex gap-3"><span className="mt-2 size-1.5 rounded-full bg-secondary/60" />Use the optional topic only as context for review.</li>
        <li className="flex gap-3"><span className="mt-2 size-1.5 rounded-full bg-secondary/60" />The coach will focus on one transferable pattern after you finish.</li>
      </ul>
    </section>
  );
}

function PanelCard({
  children,
  tone = 'base',
}: {
  children: React.ReactNode;
  tone?: 'base' | 'primary' | 'warning' | 'success' | 'error';
}): React.JSX.Element {
  const toneClassName = {
    base: 'border-base-300/55',
    primary: 'border-primary/25',
    warning: 'border-warning/40',
    success: 'border-success/35',
    error: 'border-error/40',
  }[tone];

  return <section className={`border-t pt-5 ${toneClassName}`}>{children}</section>;
}

function StaleReviewCard({ onReviewCurrentVersion }: { onReviewCurrentVersion: () => void }): React.JSX.Element {
  return (
    <PanelCard tone="warning">
      <h3 className="font-semibold">Review is out of date</h3>
      <p className="mt-2 text-sm leading-6 text-base-content/65">
        This review is based on an earlier version of your writing.
      </p>
      <button type="button" className="btn btn-warning btn-sm mt-4 rounded-xl" onClick={onReviewCurrentVersion}>
        Review current version
      </button>
    </PanelCard>
  );
}

function BeforeWritingState({
  dateKey,
  hasPendingRewritePractice,
}: {
  dateKey: string;
  hasPendingRewritePractice: boolean;
}): React.JSX.Element {
  return (
    <PanelCard tone="primary">
      <h3 className="font-semibold">Your desk is ready</h3>
      <p className="mt-2 text-sm leading-6 text-base-content/65">
        Today's writing is ready for {dateKey}. Start with your own words; feedback comes later.
      </p>
      <p className="mt-3 text-sm text-base-content/50">
        {hasPendingRewritePractice
          ? 'A saved sentence is waiting too, but it does not block today’s writing.'
          : 'No pending rewrite practice yet.'}
      </p>
    </PanelCard>
  );
}

function RewritePracticeCard({
  practice,
  inputValue,
  error,
  onInputChange,
  onComplete,
  onSkip,
}: {
  practice: WritingAttemptSnapshot['pendingRewritePractice'];
  inputValue: string;
  error: string | null;
  onInputChange: (value: string) => void;
  onComplete: () => void;
  onSkip: () => void;
}): React.JSX.Element | null {
  if (!practice) {
    return null;
  }

  const isCompleted = practice.status === 'completed';
  const canSubmit = inputValue.trim().length > 0 && !isCompleted;
  const showNativeModel = isCompleted && Boolean(practice.userRewriteText);

  return (
    <PanelCard tone="success">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-success">D+1 rewrite practice</p>
          <h3 className="mt-1 font-semibold">Practice this sentence</h3>
        </div>
        <span className="badge badge-success badge-soft">{practice.spacedStage}</span>
      </div>
      <div className="mt-4 space-y-3 text-sm leading-6 text-base-content/70">
        <p>
          <strong>Original:</strong> {practice.originalSentence}
        </p>
        <p>
          <strong>Focus pattern:</strong> {practice.focusPattern}
        </p>
        <p>{practice.prompt}</p>
      </div>
      <input
        className="input input-bordered mt-4 w-full"
        aria-label="Your rewrite practice answer"
        value={inputValue}
        onChange={(event) => onInputChange(event.target.value)}
        placeholder="Rewrite it in your own words."
        disabled={isCompleted}
      />
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn btn-success btn-sm rounded-xl" disabled={!canSubmit} onClick={onComplete}>
          {isCompleted ? 'Rewrite submitted' : 'Submit rewrite'}
        </button>
        {!isCompleted ? (
          <button type="button" className="btn btn-ghost btn-sm rounded-xl" onClick={onSkip}>
            Skip
          </button>
        ) : null}
      </div>
      {showNativeModel ? (
        <p className="mt-4 rounded-xl bg-base-100 p-3 text-sm leading-6">
          <strong>Native model:</strong> {practice.nativeModelSentence}
        </p>
      ) : (
        <p className="mt-4 text-sm text-base-content/50">Native model stays hidden until you submit.</p>
      )}
      {practice.isOlderThanSevenDays ? (
        <p className="mt-3 text-sm text-base-content/50">This older practice is de-prioritized from Today.</p>
      ) : null}
      {error ? (
        <div className="alert alert-error mt-4">
          <span>{error}</span>
        </div>
      ) : null}
    </PanelCard>
  );
}

function ReviewProgressCard({ progress }: { progress: ReviewProgressModel }): React.JSX.Element {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const currentPhase = progress.currentEvent?.phase ?? 'preparing';
  const currentTimestamp = now ?? progress.currentEvent?.at ?? progress.startedAt ?? 0;
  const startedAt = progress.startedAt ?? progress.currentEvent?.at ?? currentTimestamp;
  const elapsedMs = Math.max(0, currentTimestamp - startedAt);
  const waitingStartedEvent = latestProgressEvent(progress, 'waiting');
  const waitingElapsedMs =
    currentPhase === 'waiting' && waitingStartedEvent?.event === 'started'
      ? currentTimestamp - waitingStartedEvent.at
      : 0;
  const showSlowHint = waitingElapsedMs > 15_000;

  return (
    <PanelCard tone="primary">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">Review in progress</p>
          <h3 className="mt-1 font-semibold">{phaseLabels[currentPhase]}</h3>
        </div>
        <span className="badge badge-primary badge-soft">{formatDuration(elapsedMs)}</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-base-content/65">{phaseDescriptions[currentPhase]}</p>
      {showSlowHint ? (
        <div className="alert alert-info mt-4 py-2 text-sm">
          <span>The AI provider is still working. You can keep writing while this runs.</span>
        </div>
      ) : null}
      <ol className="mt-4 grid gap-2 text-sm">
        {reviewPhases.map((phase) => (
          <ReviewPhaseRow key={phase} phase={phase} progress={progress} currentPhase={currentPhase} />
        ))}
      </ol>
    </PanelCard>
  );
}

function ReviewPhaseRow({
  phase,
  progress,
  currentPhase,
}: {
  phase: ReviewProgressPhase;
  progress: ReviewProgressModel;
  currentPhase: ReviewProgressPhase;
}): React.JSX.Element {
  const event = latestProgressEvent(progress, phase);
  const isFailed = event?.event === 'failed';
  const isCompleted = event?.event === 'completed';
  const isActive = currentPhase === phase && !isCompleted && !isFailed;
  const markerClassName = isFailed
    ? 'bg-error text-error-content'
    : isCompleted
      ? 'bg-success text-success-content'
      : isActive
        ? 'bg-primary text-primary-content'
        : 'bg-base-300 text-base-content/50';
  const labelClassName = isActive ? 'text-base-content' : 'text-base-content/60';

  return (
    <li className="flex items-center gap-3">
      <span
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${markerClassName}`}
      >
        {isFailed ? '!' : isCompleted ? '✓' : reviewPhases.indexOf(phase) + 1}
      </span>
      <span className={`flex-1 ${labelClassName}`}>{phaseLabels[phase]}</span>
      {event ? <span className="text-xs text-base-content/45">{formatDuration(event.elapsedMs)}</span> : null}
    </li>
  );
}

function AfterWritingState({
  lastAutosaveAt,
  saveState,
  reviewState,
  reviewError,
  latestReviewRun,
  onReviewCurrentVersion,
}: {
  lastAutosaveAt: number | null;
  saveState: SaveState;
  reviewState: ReviewState;
  reviewError: string | null;
  latestReviewRun: ReviewRunSnapshot | null;
  onReviewCurrentVersion: () => void;
}): React.JSX.Element {
  const reviewDisabled = saveState === 'saving' || reviewState === 'reviewing';
  const failedCategory =
    reviewState === 'failed' ? (latestReviewRun?.summary?.errorCategory ?? inferErrorCategory(reviewError)) : null;
  const title = failedCategory ? errorTitles[failedCategory] : 'Get feedback';
  const copy = failedCategory
    ? failureCopyFor(failedCategory, reviewError)
    : 'Read once for the main idea, then ask the coach for one focused pattern.';

  return (
    <PanelCard tone={failedCategory ? 'error' : 'primary'}>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-base-content/60">{copy}</p>
      {failedCategory ? (
        <p className="mt-2 text-sm leading-6 text-base-content/55">
          Retry reviews the current editor content and creates a new review run.
        </p>
      ) : null}
      <button
        type="button"
        className={`btn mt-4 w-full rounded-xl ${failedCategory ? 'btn-error' : 'btn-primary'}`}
        disabled={reviewDisabled}
        aria-disabled={reviewDisabled}
        onClick={onReviewCurrentVersion}
      >
        {reviewState === 'reviewing' ? (
          <>
            <span className="loading loading-spinner loading-xs" />
            Reviewing...
          </>
        ) : failedCategory ? (
          'Retry current version'
        ) : (
          'Get Feedback'
        )}
      </button>
      <p className="mt-3 text-sm text-base-content/50">
        {lastAutosaveAt ? `Last autosave ${formatTime(lastAutosaveAt)}` : 'Autosave will appear here after writing.'}
      </p>
      {failedCategory ? <ReviewDetails reviewRun={latestReviewRun} fallbackErrorCategory={failedCategory} /> : null}
    </PanelCard>
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
  onReviewCurrentVersion,
}: {
  preview: ReviewPreviewSnapshot;
  reviewState: ReviewState;
  selfRepairAttempt: string;
  modelAnswerRevealed: boolean;
  onSelfRepairAttemptChange: (value: string) => void;
  onRevealModelAnswer: () => void;
  onSaveReview: () => void;
  onReviewCurrentVersion: () => void;
}): React.JSX.Element {
  const focusCorrection = getFocusCorrection(preview);
  const topCorrections = preview.operations.corrections.filter(
    (correction) =>
      correction.status !== 'low_confidence' && correction.correctionIndex !== focusCorrection?.correctionIndex,
  );
  const lowConfidenceCorrections = preview.operations.corrections.filter(
    (correction) => correction.status === 'low_confidence',
  );
  const firstReferenceRewrite = preview.operations.referenceRewrites[0];
  const firstRewritePractice = preview.operations.rewritePractice[0];
  const focusPatternTitle = focusCorrection
    ? (patternRule(focusCorrection) ?? focusCorrection.category)
    : 'Focus pattern';

  if (!focusCorrection || !preview.operations.selfRepair) {
    return (
      <PanelCard>
        <h3 className="font-semibold">Review unavailable</h3>
        <p className="mt-2 text-sm text-base-content/60">This review does not contain exactly one focus correction.</p>
      </PanelCard>
    );
  }

  return (
    <section className="grid gap-4" aria-label="Review preview">
      <ReviewQualitySummary preview={preview} focusPatternTitle={focusPatternTitle} />
      {preview.isStaleForCurrentWriting ? (
        <button type="button" className="btn btn-warning rounded-xl" onClick={onReviewCurrentVersion}>
          Retry current version
        </button>
      ) : null}

      <PanelCard tone="success">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-success">What you did well</p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-base-content/70">
          {preview.parsedOutput.summary.whatWentWell.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </PanelCard>

      <PanelCard tone="primary">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">Today’s focus</p>
        <h3 className="mt-2 text-lg font-semibold">{focusPatternTitle}</h3>
        <p className="mt-2 text-sm leading-6 text-base-content/60">
          {preview.parsedOutput.summary.focusPattern.reason}
        </p>
      </PanelCard>

      <PanelCard>
        <h3 className="font-semibold">Try rewriting this sentence</h3>
        <p className="mt-2 text-sm leading-6 text-base-content/65">{preview.operations.selfRepair.prompt}</p>
        <div className="mt-4 rounded-xl border border-info/25 bg-info/10 p-3 text-sm leading-6 text-base-content/70">
          Hint: {preview.operations.selfRepair.hint}
        </div>
        <textarea
          className="textarea textarea-bordered mt-4 min-h-28 w-full resize-y rounded-xl bg-base-100"
          value={selfRepairAttempt}
          onChange={(event) => onSelfRepairAttemptChange(event.target.value)}
          placeholder="Try your own rewrite before revealing the model answer."
          aria-label="Self-repair attempt"
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn btn-outline btn-sm rounded-xl" onClick={onRevealModelAnswer}>
            Reveal model answer
          </button>
        </div>
        {modelAnswerRevealed ? (
          <p className="mt-4 rounded-xl border border-primary/20 bg-primary/10 p-3 text-sm leading-6">
            <strong>Model answer:</strong> {focusCorrection.correctedText}
          </p>
        ) : null}
      </PanelCard>

      <CorrectionCard
        correction={focusCorrection}
        showAnswer={modelAnswerRevealed}
        reason={preview.parsedOutput.summary.focusPattern.reason}
      />

      <ReviewAccordion title="Other notes" badge={`${topCorrections.length}`}>
        {topCorrections.length > 0 ? (
          <div className="grid gap-3">
            {topCorrections.map((correction) => (
              <CorrectionCard correction={correction} key={correction.correctionIndex} showAnswer />
            ))}
          </div>
        ) : (
          <p className="text-sm text-base-content/55">No other anchored notes for this review.</p>
        )}
      </ReviewAccordion>

      {lowConfidenceCorrections.length > 0 ? (
        <ReviewAccordion title="Low-confidence suggestions" badge={`${lowConfidenceCorrections.length}`}>
          <div className="grid gap-3">
            {lowConfidenceCorrections.map((correction) => (
              <CorrectionCard correction={correction} key={correction.correctionIndex} showAnswer />
            ))}
          </div>
          <p className="mt-3 text-sm text-base-content/50">
            These suggestions stay separate and will not update learning history.
          </p>
        </ReviewAccordion>
      ) : null}

      {firstReferenceRewrite ? (
        <ReviewAccordion title="Reference rewrite" badge="1">
          <p className="writing-practice-surface rounded-xl bg-base-200 p-4 text-base text-base-content/75">
            {firstReferenceRewrite.text}
          </p>
          <p className="mt-3 rounded-xl border border-info/25 bg-info/10 p-3 text-sm leading-6 text-base-content/70">
            Notice the gap: {firstReferenceRewrite.noticeTheGap}
          </p>
        </ReviewAccordion>
      ) : null}

      {firstRewritePractice ? <ScheduledPracticeCard practice={firstRewritePractice} /> : null}

      <button
        type="button"
        className="btn btn-primary rounded-xl"
        disabled={reviewState === 'saving' || reviewState === 'saved'}
        onClick={onSaveReview}
      >
        {reviewState === 'saving' ? (
          <>
            <span className="loading loading-spinner loading-xs" />
            Saving review...
          </>
        ) : reviewState === 'saved' ? (
          'Review saved'
        ) : (
          'Save review and update learning history'
        )}
      </button>
      {reviewState === 'saved' ? <SaveSummaryCard /> : null}
    </section>
  );
}

function ReviewQualitySummary({
  preview,
  focusPatternTitle,
}: {
  preview: ReviewPreviewSnapshot;
  focusPatternTitle: string;
}): React.JSX.Element {
  const summary = preview.reviewRun.summary;
  const lowConfidenceCount = preview.operations.corrections.filter(
    (correction) => correction.status === 'low_confidence',
  ).length;
  const hasWarnings = (summary?.warningCount ?? 0) > 0 || lowConfidenceCount > 0;

  return (
    <PanelCard tone="success">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-success">Feedback ready</p>
          <h3 className="mt-1 font-semibold">Your coach found one focus pattern.</h3>
        </div>
        {summary?.durationMs ? (
          <span className="badge badge-success badge-soft">{formatDuration(summary.durationMs)}</span>
        ) : null}
      </div>
      <p className="mt-4 text-sm leading-6 text-base-content/65">
        <strong>Focus:</strong> {focusPatternTitle}
      </p>
      <p className="mt-2 text-sm leading-6 text-base-content/55">
        The technical review details are still available below, but the learning path stays focused on one pattern.
      </p>
      {preview.isStaleForCurrentWriting ? (
        <p className="mt-3 rounded-xl border border-warning/25 bg-warning/10 p-3 text-sm leading-6 text-base-content/65">
          This preview is based on an earlier writing version. Saving will keep it as stale history; use Retry current
          version for feedback on your latest writing.
        </p>
      ) : null}
      {hasWarnings ? (
        <p className="mt-3 rounded-xl border border-warning/25 bg-warning/10 p-3 text-sm leading-6 text-base-content/65">
          Warnings do not block saving. Low-confidence suggestions are shown separately and will not update learning
          history.
        </p>
      ) : null}
      <ReviewDetails reviewRun={preview.reviewRun} />
    </PanelCard>
  );
}

function SaveSummaryCard(): React.JSX.Element {
  return (
    <PanelCard tone="success">
      <h3 className="font-semibold">Learning history updated</h3>
      <p className="mt-2 text-sm leading-6 text-base-content/65">
        Anchored corrections, your self-repair attempt, reference rewrite, and tomorrow's practice are saved separately
        from the AI review progress.
      </p>
    </PanelCard>
  );
}

function ReviewDetails({
  reviewRun,
  fallbackErrorCategory,
}: {
  reviewRun: ReviewRunSnapshot | null;
  fallbackErrorCategory?: ReviewErrorCategory;
}): React.JSX.Element | null {
  if (!reviewRun) {
    return fallbackErrorCategory ? (
      <details className="mt-4 rounded-xl border border-base-300 bg-base-100 p-3 text-sm">
        <summary className="cursor-pointer font-semibold">Details</summary>
        <dl className="mt-3 grid gap-2 text-base-content/65">
          <DetailRow label="Error category" value={fallbackErrorCategory} />
        </dl>
      </details>
    ) : null;
  }

  const summary = reviewRun.summary;

  return (
    <details className="mt-4 rounded-xl border border-base-300 bg-base-100 p-3 text-sm">
      <summary className="cursor-pointer font-semibold">Details</summary>
      <dl className="mt-3 grid gap-2 text-base-content/65">
        <DetailRow label="Run id" value={reviewRun.id} mono />
        <DetailRow label="Provider" value={reviewRun.provider} />
        <DetailRow label="Model" value={reviewRun.model} />
        <DetailRow label="Status" value={reviewRun.status} />
        <DetailRow label="Validation" value={reviewRun.validationStatus ?? 'not available'} />
        <DetailRow label="Result" value={summary?.resultKind ?? 'not available'} />
        <DetailRow label="Error category" value={summary?.errorCategory ?? fallbackErrorCategory ?? 'none'} />
        <DetailRow label="Provider status" value={summary?.providerStatus ?? 'not available'} />
        <DetailRow
          label="Duration"
          value={
            summary?.durationMs !== null && summary?.durationMs !== undefined
              ? formatDuration(summary.durationMs)
              : 'not available'
          }
        />
        <DetailRow label="Warnings" value={`${summary?.warningCount ?? reviewRun.validationErrors.length}`} />
        <DetailRow label="Raw saved" value={summary?.rawSaved ? 'yes' : 'no'} />
      </dl>
      {summary ? <ReviewStatsDetails summary={summary} /> : null}
      {summary ? <PhaseTimingList summary={summary} /> : null}
    </details>
  );
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}): React.JSX.Element {
  return (
    <div className="grid gap-1 sm:grid-cols-[7rem_1fr]">
      <dt className="text-base-content/45">{label}</dt>
      <dd className={mono ? 'break-all font-mono text-xs' : 'break-words'}>{value}</dd>
    </div>
  );
}

function ReviewStatsDetails({ summary }: { summary: ReviewRunSummary }): React.JSX.Element {
  return (
    <div className="mt-4 border-t border-base-300 pt-3">
      <p className="font-semibold">Review stats</p>
      <dl className="mt-3 grid gap-2 text-sm text-base-content/65">
        <DetailRow label="Anchored" value={`${summary.reviewStats.anchoredCorrections}`} />
        <DetailRow label="Low confidence" value={`${summary.reviewStats.lowConfidenceCorrections}`} />
        <DetailRow label="Rewrite tasks" value={`${summary.reviewStats.generatedRewriteTasks}`} />
        <DetailRow label="Self-repair" value={`${summary.reviewStats.generatedSelfRepairAttempts}`} />
        <DetailRow label="References" value={`${summary.reviewStats.generatedReferenceRewrites}`} />
      </dl>
    </div>
  );
}

function PhaseTimingList({ summary }: { summary: ReviewRunSummary }): React.JSX.Element {
  return (
    <div className="mt-4 border-t border-base-300 pt-3">
      <p className="font-semibold">Phase timings</p>
      <dl className="mt-3 grid gap-2 text-sm text-base-content/65">
        {reviewPhases.map((phase) => (
          <DetailRow
            key={phase}
            label={phaseLabels[phase]}
            value={summary.phaseTimings[phase] === null ? 'not completed' : formatDuration(summary.phaseTimings[phase])}
          />
        ))}
      </dl>
    </div>
  );
}

function ReviewAccordion({
  title,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  badge: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="collapse collapse-arrow rounded-xl border border-base-300 bg-base-100">
      <input type="checkbox" defaultChecked={defaultOpen} aria-label={title} />
      <div className="collapse-title flex items-center justify-between gap-3 font-semibold">
        <span>{title}</span>
        <span className="badge badge-ghost">{badge}</span>
      </div>
      <div className="collapse-content">{children}</div>
    </div>
  );
}

function ScheduledPracticeCard({
  practice,
}: {
  practice: PreviewOperationsSnapshot['rewritePractice'][number];
}): React.JSX.Element {
  const focusIndexes = practice.focusCorrectionIndexes.join(', ');

  return (
    <PanelCard tone="success">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-success">Tomorrow practice scheduled</p>
          <h3 className="mt-1 font-semibold">One sentence saved for D+1</h3>
        </div>
        <span className="badge badge-success badge-soft">D+{practice.dueOffsetDays}</span>
      </div>
      <div className="mt-3 space-y-2 text-sm leading-6 text-base-content/65">
        <p>
          <strong>Reason:</strong> This follows today's focus correction{focusIndexes ? ` #${focusIndexes}` : ''}.
        </p>
        <p>
          <strong>Prompt:</strong> {practice.prompt}
        </p>
      </div>
      <p className="mt-3 text-sm text-base-content/50">The input field appears when this practice is due.</p>
    </PanelCard>
  );
}

function latestProgressEvent(
  progress: ReviewProgressModel,
  phase: ReviewProgressPhase,
): ReviewProgressModel['currentEvent'] {
  for (let index = progress.events.length - 1; index >= 0; index -= 1) {
    const event = progress.events[index];
    if (event.phase === phase) {
      return event;
    }
  }

  return null;
}

function inferErrorCategory(message: string | null): ReviewErrorCategory {
  if (!message) {
    return 'provider_error';
  }

  const normalized = message.toLowerCase();
  if (
    normalized.includes('api key') ||
    normalized.includes('settings') ||
    normalized.includes('configured') ||
    normalized.includes('base url') ||
    normalized.includes('model')
  ) {
    return 'missing_config';
  }

  if (normalized.includes('too long') || normalized.includes('timed out') || normalized.includes('timeout')) {
    return 'timeout';
  }

  if (normalized.includes('json') || normalized.includes('could not be used')) {
    return 'invalid_json';
  }

  if (normalized.includes('reliable') || normalized.includes('validation')) {
    return 'validation_failed';
  }

  if (normalized.includes('out of date') || normalized.includes('earlier version')) {
    return 'stale_content';
  }

  return 'provider_error';
}

function failureCopyFor(category: ReviewErrorCategory, reviewError: string | null): string {
  if (category === 'missing_config' && reviewError) {
    return reviewError;
  }

  switch (category) {
    case 'missing_config':
      return 'Add or update provider settings before reviewing again.';
    case 'timeout':
      return 'The AI provider did not respond in time. Try again in a moment.';
    case 'invalid_json':
      return 'The AI response was malformed. Try again or change the model in Settings.';
    case 'validation_failed':
      return 'The AI response arrived, but the suggestions could not be anchored or validated reliably.';
    case 'stale_content':
      return 'This review was based on an earlier writing version.';
    case 'provider_error':
      return 'The AI provider could not complete the request. Try again or check Settings.';
  }
}

function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}
