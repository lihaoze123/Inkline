import { useEffect, useState } from 'react';
import type { RewriteCheckOutcome, RewriteCheckSnapshot, WritingAttemptSnapshot } from '@shared/types/writing';
import type { AiProviderDiagnostics } from '@shared/types/ai';
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
  isRewritePracticeChecking,
  onRewritePracticeInputChange,
  onCompleteRewritePractice,
  onRetryRewriteCheck,
  onSkipRewritePractice,
  onSnoozeRewritePractice,
  onReviewCurrentVersion,
}: LearningPanelProps): React.JSX.Element {
  const statusSentence =
    reviewState === 'reviewing'
      ? null
      : preview
        ? 'Focused review is ready.'
        : hasWritten
          ? 'Ask for feedback when the draft is ready.'
          : 'The coach waits until you write.';

  return (
    <aside
      className="scrollable flex min-h-0 flex-col gap-5 overflow-y-auto text-sm text-base-content/62 lg:pl-3"
      aria-label="Writing coach"
    >
      {statusSentence ? (
        <p id="learning-panel-title" className="leading-6 text-base-content/58">
          {statusSentence}
        </p>
      ) : null}

      {writing.staleReview ? <StaleReviewCard onReviewCurrentVersion={onReviewCurrentVersion} /> : null}

      {writing.pendingRewritePractice || completedRewritePractice ? (
        <details className="text-sm text-base-content/62" data-e2e="rewrite-practice-details">
          <summary className="cursor-pointer font-medium text-base-content/70" data-e2e="rewrite-practice-summary">
            Rewrite practice
          </summary>
          <RewritePracticeCard
            practice={completedRewritePractice ?? writing.pendingRewritePractice}
            inputValue={rewritePracticeInput}
            error={rewritePracticeError}
            isChecking={isRewritePracticeChecking}
            onInputChange={onRewritePracticeInputChange}
            onComplete={onCompleteRewritePractice}
            onRetryCheck={onRetryRewriteCheck}
            onSkip={onSkipRewritePractice}
            onSnooze={onSnoozeRewritePractice}
          />
        </details>
      ) : null}
      {hasWritten && reviewState === 'reviewing' ? <ReviewProgressCard progress={reviewProgress} /> : null}
      {hasWritten && preview ? (
        <div className="space-y-3">
          <p className="text-sm leading-6 text-base-content/60">Focused review is ready.</p>
          <button
            type="button"
            className="btn btn-ghost btn-sm rounded-xl px-0 text-primary"
            data-e2e="open-focused-review-button"
            onClick={onOpenFeedback}
          >
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
          <span className="selectable-content">{reviewError}</span>
        </div>
      ) : null}
    </aside>
  );
}

const reviewPhases: ReviewProgressPhase[] = ['preparing', 'requesting', 'waiting', 'checking', 'building_preview'];

const phaseLabels: Record<ReviewProgressPhase, string> = {
  preparing: 'Reading your draft',
  requesting: 'Sending the review request',
  waiting: 'Finding one useful pattern',
  checking: 'Checking the feedback',
  building_preview: 'Preparing rewrite practice',
};

const phaseStepLabels: Record<ReviewProgressPhase, string> = {
  preparing: 'Read',
  requesting: 'Send',
  waiting: 'Find pattern',
  checking: 'Check',
  building_preview: 'Prepare',
};

const phaseDescriptions: Record<ReviewProgressPhase, string> = {
  preparing: 'Reading the draft and practice context.',
  requesting: 'Sending the draft to your configured provider.',
  waiting: 'Waiting for focused feedback.',
  checking: 'Checking anchors, confidence, and learning actions.',
  building_preview: 'Preparing the rewrite step for review.',
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
    warning: 'rounded-lg bg-warning/10 p-4',
    success: '',
    error: 'rounded-lg bg-error/10 p-4',
  }[tone];

  return <section className={toneClassName}>{children}</section>;
}

function StaleReviewCard({ onReviewCurrentVersion }: { onReviewCurrentVersion: () => void }): React.JSX.Element {
  return (
    <PanelCard tone="warning">
      <h3 className="font-semibold">Review is from an earlier draft</h3>
      <p className="mt-2 text-sm leading-6 text-base-content/65">Run a fresh review before saving this version.</p>
      <button type="button" className="btn btn-warning btn-sm mt-4 rounded-xl" onClick={onReviewCurrentVersion}>
        Review current draft
      </button>
    </PanelCard>
  );
}

function RewritePracticeCard({
  practice,
  inputValue,
  error,
  isChecking,
  onInputChange,
  onComplete,
  onRetryCheck,
  onSkip,
  onSnooze,
}: {
  practice: WritingAttemptSnapshot['pendingRewritePractice'];
  inputValue: string;
  error: string | null;
  isChecking: boolean;
  onInputChange: (value: string) => void;
  onComplete: () => void;
  onRetryCheck: () => void;
  onSkip: () => void;
  onSnooze: () => void;
}): React.JSX.Element | null {
  if (!practice) {
    return null;
  }

  const latestCheck = practice.latestRewriteCheck;
  const isCompleted = practice.status === 'completed';
  const isTerminal = isCompleted || practice.status === 'skipped' || practice.status === 'expired';
  const isCheckInProgress = isChecking || latestCheck?.status === 'pending' || latestCheck?.status === 'in_progress';
  const canAct = !isTerminal;
  const canSubmit = inputValue.trim().length > 0 && canAct && !isCheckInProgress;
  const showNativeModel = isCompleted && Boolean(practice.userRewriteText);

  return (
    <PanelCard tone="success">
      <div data-e2e="rewrite-practice-card">
        <div className="ui-chrome">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-success">Next rewrite</p>
          <h3 className="mt-1 font-semibold">Practice the saved pattern</h3>
          <p className="mt-1 text-xs text-base-content/45">{practice.spacedStage}</p>
        </div>
        <div className="selectable-content mt-4 space-y-3 text-sm leading-6 text-base-content/70">
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
          placeholder="Rewrite the sentence in your own words."
          disabled={!canAct || isCheckInProgress}
          data-e2e="rewrite-practice-input"
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-success btn-sm rounded-xl"
            disabled={!canSubmit}
            data-e2e="rewrite-practice-submit"
            onClick={onComplete}
          >
            {isCheckInProgress ? 'Checking rewrite...' : isCompleted ? 'Rewrite submitted' : 'Submit rewrite'}
          </button>
          {canAct ? (
            <>
              <button
                type="button"
                className="btn btn-ghost btn-sm rounded-xl"
                disabled={isCheckInProgress}
                data-e2e="rewrite-practice-snooze"
                onClick={onSnooze}
              >
                Snooze
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm rounded-xl"
                disabled={isCheckInProgress}
                data-e2e="rewrite-practice-skip"
                onClick={onSkip}
              >
                Skip
              </button>
            </>
          ) : null}
        </div>
        {isCheckInProgress ? (
          <p className="mt-3 text-sm leading-6 text-base-content/55">Checking whether the pattern improved...</p>
        ) : null}
        {showNativeModel ? (
          <p className="selectable-content mt-4 rounded-xl bg-base-100/55 p-3 text-sm leading-6">
            <strong>Reference sentence:</strong> {practice.nativeModelSentence}
          </p>
        ) : canAct ? (
          <p className="ui-chrome mt-4 text-sm text-base-content/50">Reference sentence appears after you submit.</p>
        ) : null}
        {practice.status === 'expired' ? (
          <p className="ui-chrome mt-4 text-sm leading-6 text-base-content/55">
            This rewrite window was missed. Learning evidence is unchanged.
          </p>
        ) : null}
        {practice.status === 'skipped' ? (
          <p className="ui-chrome mt-4 text-sm leading-6 text-base-content/55">
            This rewrite was skipped. Learning evidence is unchanged.
          </p>
        ) : null}
        {latestCheck ? (
          <RewriteCheckFeedbackCard check={latestCheck} isChecking={isCheckInProgress} onRetryCheck={onRetryCheck} />
        ) : null}
        {practice.isOlderThanSevenDays ? (
          <p className="ui-chrome mt-3 text-sm text-base-content/50">Older practice stays available here.</p>
        ) : null}
        {error ? (
          <div className="alert alert-error mt-4">
            <span className="selectable-content">{error}</span>
          </div>
        ) : null}
      </div>
    </PanelCard>
  );
}

function RewriteCheckFeedbackCard({
  check,
  isChecking,
  onRetryCheck,
}: {
  check: RewriteCheckSnapshot;
  isChecking: boolean;
  onRetryCheck: () => void;
}): React.JSX.Element | null {
  if (isChecking || check.status === 'pending' || check.status === 'in_progress') {
    return (
      <div className="ui-chrome mt-4 rounded-lg bg-primary/[0.05] p-3 text-sm leading-6 text-base-content/62">
        Checking your rewrite now. The rewrite is saved while the evaluator runs.
      </div>
    );
  }

  if (check.status === 'completed' && check.outcome) {
    const copy = rewriteOutcomeCopy(check.outcome);
    return (
      <div className={`selectable-content mt-4 rounded-lg bg-base-100/45 p-3 text-sm leading-6 ${copy.className}`}>
        <p className="font-semibold text-base-content/78">{copy.title}</p>
        {check.feedback?.message ? <p className="mt-1 text-base-content/65">{check.feedback.message}</p> : null}
        {check.feedback?.nextStep ? <p className="mt-2 text-base-content/58">Next: {check.feedback.nextStep}</p> : null}
      </div>
    );
  }

  if (check.status === 'failed' || check.status === 'retryable') {
    return (
      <div className="selectable-content mt-4 rounded-lg bg-error/10 p-3 text-sm leading-6 text-base-content/65">
        <p className="font-semibold text-base-content/78">Rewrite saved, check did not finish.</p>
        <p className="mt-1">
          {check.errorMessage ?? 'The evaluator could not check this rewrite. Your submitted rewrite was preserved.'}
        </p>
        <button type="button" className="btn btn-outline btn-sm mt-3 rounded-xl" onClick={onRetryCheck}>
          Retry check
        </button>
      </div>
    );
  }

  return null;
}

function rewriteOutcomeCopy(outcome: RewriteCheckOutcome): { title: string; className: string } {
  switch (outcome) {
    case 'correct':
      return {
        title: 'Good repair.',
        className: 'text-success',
      };
    case 'partly_correct':
      return {
        title: 'Progress on the pattern.',
        className: 'text-warning',
      };
    case 'incorrect':
      return {
        title: 'Keep this pattern in view.',
        className: 'text-error',
      };
  }
}

function ReviewProgressCard({ progress }: { progress: ReviewProgressModel }): React.JSX.Element {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const currentPhase = progress.currentEvent?.phase ?? 'preparing';
  const startedAt = progress.startedAt ?? progress.currentEvent?.at ?? now;
  const totalElapsedMs = now - startedAt;
  const phaseStartedEvent = latestStartedProgressEvent(progress, currentPhase);
  const currentPhaseElapsedMs = phaseStartedEvent ? now - phaseStartedEvent.at : totalElapsedMs;
  const showSlowHint = totalElapsedMs > 15_000;

  return (
    <section className="space-y-3 text-sm text-base-content/62" aria-label="Review progress">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">Reviewing</p>
        <h3 className="mt-1 font-semibold text-base-content/80">{phaseLabels[currentPhase]}</h3>
        <p className="mt-1 text-sm leading-6 text-base-content/58">{phaseDescriptions[currentPhase]}</p>
      </div>
      <ol className="grid gap-1.5">
        {reviewPhases.map((phase) => (
          <ReviewPhaseRow
            key={phase}
            phase={phase}
            progress={progress}
            currentPhase={currentPhase}
            currentPhaseElapsedMs={currentPhaseElapsedMs}
          />
        ))}
      </ol>
      {showSlowHint ? (
        <p className="text-xs leading-5 text-base-content/42">Taking longer than usual — you can keep writing.</p>
      ) : null}
    </section>
  );
}

function ReviewPhaseRow({
  phase,
  progress,
  currentPhase,
  currentPhaseElapsedMs,
}: {
  phase: ReviewProgressPhase;
  progress: ReviewProgressModel;
  currentPhase: ReviewProgressPhase;
  currentPhaseElapsedMs: number;
}): React.JSX.Element {
  const event = latestProgressEvent(progress, phase);
  const isFailed = event?.event === 'failed';
  const isCompleted = event?.event === 'completed';
  const isActive = currentPhase === phase && !isCompleted && !isFailed;
  const markerClassName = isFailed
    ? 'bg-error text-error-content'
    : isCompleted
      ? 'bg-success/90 text-success-content'
      : isActive
        ? 'bg-primary text-primary-content'
        : 'bg-base-300 text-base-content/45';
  const labelClassName = isActive ? 'text-base-content/82' : 'text-base-content/52';

  return (
    <li className="flex items-center gap-2">
      <span
        className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[0.7rem] font-semibold ${markerClassName}`}
      >
        {isFailed ? '!' : isCompleted ? '✓' : reviewPhases.indexOf(phase) + 1}
      </span>
      <span className={`flex-1 leading-5 ${labelClassName}`}>{phaseStepLabels[phase]}</span>
      {isActive ? <span className="text-xs text-base-content/42">{formatDuration(currentPhaseElapsedMs)}</span> : null}
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
      {copy ? <p className="selectable-content text-sm leading-6 text-base-content/60">{copy}</p> : null}
      {failedCategory ? (
        <p className="mt-2 text-sm leading-6 text-base-content/55">
          Retry uses the current editor content and creates a fresh review.
        </p>
      ) : null}
      {reviewState === 'reviewing' ? (
        <p className="text-xs leading-5 text-base-content/42">Reviewing current draft...</p>
      ) : (
        <button
          type="button"
          className={`btn w-full rounded-xl ${failedCategory ? 'btn-error mt-4' : 'btn-primary'}`}
          disabled={reviewDisabled}
          aria-disabled={reviewDisabled}
          data-e2e="get-feedback-button"
          onClick={onReviewCurrentVersion}
        >
          {failedCategory ? 'Retry review' : 'Review draft'}
        </button>
      )}
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
        <summary className="cursor-pointer font-medium text-base-content/50">Technical details</summary>
        <dl className="selectable-content mt-3 grid gap-2 text-base-content/65">
          <DetailRow label="Error category" value={fallbackErrorCategory} />
        </dl>
      </details>
    ) : null;
  }

  const summary = reviewRun.summary;

  return (
    <details className="mt-4 text-sm text-base-content/65">
      <summary className="cursor-pointer font-semibold text-base-content/72">Details</summary>
      <dl className="selectable-content mt-3 grid gap-2 text-base-content/65">
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
      {summary?.providerDiagnostics ? <ProviderDiagnosticsDetails diagnostics={summary.providerDiagnostics} /> : null}
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
      <dl className="selectable-content mt-3 grid gap-2 text-sm text-base-content/65">
        <DetailRow label="Anchored" value={`${summary.reviewStats.anchoredCorrections}`} />
        <DetailRow label="Low confidence" value={`${summary.reviewStats.lowConfidenceCorrections}`} />
        <DetailRow label="Rewrite tasks" value={`${summary.reviewStats.generatedRewriteTasks}`} />
        <DetailRow label="Self-repair" value={`${summary.reviewStats.generatedSelfRepairAttempts}`} />
        <DetailRow label="References" value={`${summary.reviewStats.generatedReferenceRewrites}`} />
      </dl>
    </div>
  );
}

function ProviderDiagnosticsDetails({ diagnostics }: { diagnostics: AiProviderDiagnostics }): React.JSX.Element {
  const usage = diagnostics.usage;
  const warnings =
    diagnostics.warnings.length > 0
      ? diagnostics.warnings.join(' | ')
      : diagnostics.warningCount > 0
        ? `${diagnostics.warningCount} provider warning(s)`
        : 'none';

  return (
    <div className="mt-4">
      <p className="font-semibold">Provider diagnostics</p>
      <dl className="selectable-content mt-3 grid gap-2 text-sm text-base-content/65">
        <DetailRow label="Failure" value={diagnostics.failureKind ?? 'none'} />
        <DetailRow label="Finish" value={diagnostics.finishReason ?? 'not available'} />
        <DetailRow label="Raw finish" value={diagnostics.rawFinishReason ?? 'not available'} />
        <DetailRow label="Input tokens" value={formatTokenCount(usage?.inputTokens)} />
        <DetailRow label="Output tokens" value={formatTokenCount(usage?.outputTokens)} />
        <DetailRow label="Reasoning" value={formatTokenCount(usage?.reasoningTokens)} />
        <DetailRow label="Text tokens" value={formatTokenCount(usage?.textTokens)} />
        <DetailRow label="Cached input" value={formatTokenCount(usage?.cachedInputTokens)} />
        <DetailRow label="Response id" value={diagnostics.responseId ?? 'not available'} mono />
        <DetailRow label="Response model" value={diagnostics.responseModelId ?? 'not available'} />
        <DetailRow
          label="Metadata"
          value={diagnostics.providerMetadataKeys.length > 0 ? diagnostics.providerMetadataKeys.join(', ') : 'none'}
        />
        <DetailRow
          label="Thinking"
          value={
            diagnostics.reasoningEnabled === null ? 'not available' : diagnostics.reasoningEnabled ? 'enabled' : 'off'
          }
        />
        <DetailRow label="Effort" value={diagnostics.reasoningEffort ?? 'not available'} />
        <DetailRow label="Requested effort" value={diagnostics.reasoningRequestedEffort ?? 'not available'} />
        <DetailRow label="Effective effort" value={diagnostics.reasoningEffectiveEffort ?? 'provider default'} />
        <DetailRow label="Fallback" value={diagnostics.reasoningFallbackUsed ? 'used' : 'none'} />
        {diagnostics.reasoningFallbackReason ? (
          <DetailRow label="Fallback reason" value={diagnostics.reasoningFallbackReason} />
        ) : null}
        <DetailRow label="Warnings" value={warnings} />
        <DetailRow label="Error name" value={diagnostics.errorName ?? 'none'} />
        <DetailRow label="Error" value={diagnostics.errorMessage ?? 'none'} />
      </dl>
    </div>
  );
}

function PhaseTimingList({ summary }: { summary: ReviewRunSummary }): React.JSX.Element {
  return (
    <div className="mt-4">
      <p className="font-semibold">Phase timings</p>
      <dl className="selectable-content mt-3 grid gap-2 text-sm text-base-content/65">
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

function latestStartedProgressEvent(
  progress: ReviewProgressModel,
  phase: ReviewProgressPhase,
): ReviewProgressModel['currentEvent'] {
  for (let index = progress.events.length - 1; index >= 0; index -= 1) {
    const event = progress.events[index];
    if (event.phase === phase && event.event === 'started') {
      return event;
    }
  }

  return null;
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

function formatTokenCount(value: number | null | undefined): string {
  return value === null || value === undefined ? 'not available' : value.toLocaleString('en-US');
}
