import { useEffect, useState } from 'react';
import type { WritingAttemptSnapshot } from '@shared/types/writing';
import type {
  ReviewErrorCategory,
  ReviewProgressPhase,
  ReviewRunSnapshot,
  ReviewRunSummary,
} from '@shared/types/review';
import { formatTime } from './format';
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
  onOpenFeedback,
  rewritePracticeInput,
  completedRewritePractice,
  rewritePracticeError,
  onRewritePracticeInputChange,
  onCompleteRewritePractice,
  onSkipRewritePractice,
  onReviewCurrentVersion,
}: LearningPanelProps): React.JSX.Element {
  const statusSentence = preview
    ? 'Your focused review is ready when you want to inspect it.'
    : reviewState === 'reviewing'
      ? 'Reading your draft for one useful pattern.'
      : hasWritten
        ? 'When the draft feels complete enough, ask for one focused note.'
        : 'Write first. The coach will wait quietly.';

  return (
    <aside
      className="scrollable flex min-h-0 flex-col gap-5 overflow-y-auto text-sm text-base-content/62 lg:pl-3"
      aria-label="Writing coach"
    >
      <p id="learning-panel-title" className="leading-6 text-base-content/58">
        {statusSentence}
      </p>

      {writing.staleReview ? <StaleReviewCard onReviewCurrentVersion={onReviewCurrentVersion} /> : null}

      {writing.pendingRewritePractice || completedRewritePractice ? (
        <details className="text-sm text-base-content/62">
          <summary className="cursor-pointer font-medium text-base-content/70">Rewrite practice is waiting</summary>
          <RewritePracticeCard
            practice={completedRewritePractice ?? writing.pendingRewritePractice}
            inputValue={rewritePracticeInput}
            error={rewritePracticeError}
            onInputChange={onRewritePracticeInputChange}
            onComplete={onCompleteRewritePractice}
            onSkip={onSkipRewritePractice}
          />
        </details>
      ) : null}
      {hasWritten && reviewState === 'reviewing' ? (
        <details className="text-sm text-base-content/62">
          <summary className="cursor-pointer font-medium text-base-content/70">Review progress</summary>
          <ReviewProgressCard progress={reviewProgress} />
        </details>
      ) : null}
      {hasWritten && preview ? (
        <div className="space-y-3">
          <p className="text-sm leading-6 text-base-content/60">Focused review is ready.</p>
          <button type="button" className="btn btn-ghost btn-sm rounded-xl px-0 text-primary" onClick={onOpenFeedback}>
            Open focused review
          </button>
        </div>
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

function PanelCard({
  children,
  tone = 'base',
}: {
  children: React.ReactNode;
  tone?: 'base' | 'primary' | 'warning' | 'success' | 'error';
}): React.JSX.Element {
  const toneClassName = {
    base: '',
    primary: '',
    warning: 'border-l border-warning/40 pl-4',
    success: '',
    error: 'border-l border-error/40 pl-4',
  }[tone];

  return <section className={toneClassName}>{children}</section>;
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
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-success">D+1 rewrite practice</p>
        <h3 className="mt-1 font-semibold">Practice this sentence</h3>
        <p className="mt-1 text-xs text-base-content/45">{practice.spacedStage}</p>
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
  const waitingStartedEvent = latestProgressEvent(progress, 'waiting');
  const waitingElapsedMs =
    currentPhase === 'waiting' && waitingStartedEvent?.event === 'started'
      ? currentTimestamp - waitingStartedEvent.at
      : 0;
  const showSlowHint = waitingElapsedMs > 15_000;

  return (
    <PanelCard tone="primary">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">Review in progress</p>
        <h3 className="mt-1 font-semibold">{phaseLabels[currentPhase]}</h3>
      </div>
      <p className="mt-2 text-sm leading-6 text-base-content/65">{phaseDescriptions[currentPhase]}</p>
      {showSlowHint ? (
        <div className="alert alert-info mt-4 py-2 text-sm">
          <span>The AI provider is still working. You can keep writing while this runs.</span>
        </div>
      ) : null}
      <details className="mt-4 text-sm text-base-content/62">
        <summary className="cursor-pointer font-medium text-base-content/70">Review progress steps</summary>
        <ol className="mt-3 grid gap-2">
          {reviewPhases.map((phase) => (
            <ReviewPhaseRow key={phase} phase={phase} progress={progress} currentPhase={currentPhase} />
          ))}
        </ol>
      </details>
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
  const copy = failedCategory ? failureCopyFor(failedCategory, reviewError) : null;

  return (
    <PanelCard tone={failedCategory ? 'error' : 'primary'}>
      {copy ? <p className="text-sm leading-6 text-base-content/60">{copy}</p> : null}
      {failedCategory ? (
        <p className="mt-2 text-sm leading-6 text-base-content/55">
          Retry reviews the current editor content and creates a new review run.
        </p>
      ) : null}
      <button
        type="button"
        className={`btn w-full rounded-xl ${failedCategory ? 'btn-error mt-4' : 'btn-primary'}`}
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
      <p className="mt-3 text-xs text-base-content/38">
        {lastAutosaveAt ? `Autosaved ${formatTime(lastAutosaveAt)}` : 'Autosave will appear after writing.'}
      </p>
      {failedCategory ? <ReviewDetails reviewRun={latestReviewRun} fallbackErrorCategory={failedCategory} /> : null}
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
      <details className="mt-4 text-sm text-base-content/65">
        <summary className="cursor-pointer font-semibold text-base-content/72">Details</summary>
        <dl className="mt-3 grid gap-2 text-base-content/65">
          <DetailRow label="Error category" value={fallbackErrorCategory} />
        </dl>
      </details>
    ) : null;
  }

  const summary = reviewRun.summary;

  return (
    <details className="mt-4 text-sm text-base-content/65">
      <summary className="cursor-pointer font-semibold text-base-content/72">Details</summary>
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
    <div className="mt-4">
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
    <div className="mt-4">
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
