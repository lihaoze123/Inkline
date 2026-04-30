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
  return (
    <aside
      className="scrollable flex min-h-0 flex-col gap-4 overflow-y-auto rounded-xl border border-base-300/70 bg-base-100 p-5"
      aria-labelledby="learning-panel-title"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/70">Coach panel</p>
        <h2 id="learning-panel-title" className="mt-1 text-2xl font-semibold tracking-[-0.03em]">
          Next step
        </h2>
      </div>

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
  preparing: 'Preparing writing',
  requesting: 'Sending request',
  waiting: 'Waiting for AI',
  checking: 'Checking reliability',
  building_preview: 'Building preview',
};

const phaseDescriptions: Record<ReviewProgressPhase, string> = {
  preparing: 'Organizing the current writing and learning context.',
  requesting: 'Packaging the review request for the provider.',
  waiting: 'The provider is generating feedback.',
  checking: 'Validating anchors, confidence, and learning actions.',
  building_preview: 'Preparing the review you can inspect before saving.',
};

const errorTitles: Record<ReviewErrorCategory, string> = {
  missing_config: 'Review needs setup',
  provider_error: 'AI service connection failed',
  timeout: 'AI service is taking too long',
  invalid_json: 'AI response could not be read',
  validation_failed: 'AI suggestions were not reliable enough',
  stale_content: 'Review is out of date',
};

function PanelCard({
  children,
  tone = 'base',
}: {
  children: React.ReactNode;
  tone?: 'base' | 'primary' | 'warning' | 'success' | 'error';
}): React.JSX.Element {
  const toneClassName = {
    base: 'border-base-300 bg-base-200/45',
    primary: 'border-primary/25 bg-primary/10',
    warning: 'border-warning/30 bg-warning/10',
    success: 'border-success/30 bg-success/10',
    error: 'border-error/30 bg-error/10',
  }[tone];

  return <section className={`rounded-xl border p-4 ${toneClassName}`}>{children}</section>;
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
      <h3 className="font-semibold">Before writing</h3>
      <p className="mt-2 text-sm leading-6 text-base-content/65">
        Today's writing is ready for {dateKey}. Start with free writing; feedback comes later.
      </p>
      <p className="mt-3 text-sm text-base-content/50">
        {hasPendingRewritePractice
          ? 'You can practice one saved sentence first, or ignore it and write.'
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
  const title = failedCategory ? errorTitles[failedCategory] : 'After writing';
  const copy = failedCategory
    ? failureCopyFor(failedCategory, reviewError)
    : 'Read once for the main idea, then ask for a focused review.';

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
          'Review current writing'
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

      <PanelCard tone="primary">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">Today's focus</p>
        <h3 className="mt-1 text-lg font-semibold">{focusPatternTitle}</h3>
        <p className="mt-2 text-sm leading-6 text-base-content/60">
          {preview.parsedOutput.summary.focusPattern.reason}
        </p>
      </PanelCard>

      <PanelCard>
        <h3 className="font-semibold">Try fixing this</h3>
        <p className="mt-2 text-sm leading-6 text-base-content/65">{preview.operations.selfRepair.prompt}</p>
        <div className="mt-4 rounded-xl border border-info/25 bg-info/10 p-3 text-sm leading-6 text-base-content/70">
          Hint: {preview.operations.selfRepair.hint}
        </div>
        <textarea
          className="textarea textarea-bordered mt-4 min-h-28 w-full resize-y"
          value={selfRepairAttempt}
          onChange={(event) => onSelfRepairAttemptChange(event.target.value)}
          placeholder="Try your own correction before revealing the model answer."
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

      <ReviewAccordion
        title="What you did well"
        badge={`${preview.parsedOutput.summary.whatWentWell.length}`}
        defaultOpen
      >
        <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-base-content/70">
          {preview.parsedOutput.summary.whatWentWell.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </ReviewAccordion>

      <ReviewAccordion title="Other corrections" badge={`${topCorrections.length}`}>
        {topCorrections.length > 0 ? (
          <div className="grid gap-3">
            {topCorrections.map((correction) => (
              <CorrectionCard correction={correction} key={correction.correctionIndex} showAnswer />
            ))}
          </div>
        ) : (
          <p className="text-sm text-base-content/55">No other anchored corrections.</p>
        )}
      </ReviewAccordion>

      {lowConfidenceCorrections.length > 0 ? (
        <ReviewAccordion title="Other suggestions" badge={`${lowConfidenceCorrections.length}`}>
          <div className="grid gap-3">
            {lowConfidenceCorrections.map((correction) => (
              <CorrectionCard correction={correction} key={correction.correctionIndex} showAnswer />
            ))}
          </div>
          <p className="mt-3 text-sm text-base-content/50">
            These are low-confidence suggestions and will not update pattern counts or rewrite practice.
          </p>
        </ReviewAccordion>
      ) : null}

      {firstReferenceRewrite ? (
        <ReviewAccordion title="Reference rewrite" badge="1">
          <p className="rounded-xl bg-base-200 p-3 text-sm leading-6 text-base-content/75">
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
  const stats = summary?.reviewStats ?? {
    anchoredCorrections: preview.operations.corrections.filter((correction) => correction.status !== 'low_confidence')
      .length,
    lowConfidenceCorrections: preview.operations.corrections.filter(
      (correction) => correction.status === 'low_confidence',
    ).length,
    generatedRewriteTasks: preview.operations.rewritePractice.length,
    generatedSelfRepairAttempts: preview.operations.selfRepair ? 1 : 0,
    generatedReferenceRewrites: preview.operations.referenceRewrites.length,
  };
  const hasWarnings = (summary?.warningCount ?? 0) > 0 || stats.lowConfidenceCorrections > 0;

  return (
    <PanelCard tone="success">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-success">Review ready</p>
          <h3 className="mt-1 font-semibold">Quality summary</h3>
        </div>
        {summary?.durationMs ? (
          <span className="badge badge-success badge-soft">{formatDuration(summary.durationMs)}</span>
        ) : null}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <SummaryMetric label="Anchored" value={stats.anchoredCorrections} />
        <SummaryMetric label="Suggestions" value={stats.lowConfidenceCorrections} />
        <SummaryMetric label="Practice" value={stats.generatedRewriteTasks} />
        <SummaryMetric label="References" value={stats.generatedReferenceRewrites} />
      </div>
      <p className="mt-4 text-sm leading-6 text-base-content/65">
        <strong>Focus:</strong> {focusPatternTitle}
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

function SummaryMetric({ label, value }: { label: string; value: number }): React.JSX.Element {
  return (
    <div className="rounded-xl bg-base-100/70 p-3">
      <p className="text-lg font-semibold leading-none">{value}</p>
      <p className="mt-1 text-xs text-base-content/50">{label}</p>
    </div>
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
