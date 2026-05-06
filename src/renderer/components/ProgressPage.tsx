import { useState } from 'react';
import type {
  ErrorPatternSnapshot,
  MergeErrorPatternsInput,
  MergeErrorPatternsResult,
  PatternEvidenceCheckSummary,
  PatternEvidenceRepairSummary,
  PatternEvidenceStage,
  PatternEvidenceSummary,
} from '@shared/types/learning-assets';

const evidenceLabels: Record<PatternEvidenceStage, string> = {
  needs_repair: 'Needs repair',
  repaired_once: 'Repaired once',
  transferred_once: 'Transferred once',
  stable_after_spaced_reuse: 'Stable after spaced reuse',
};

const evidenceDescriptions: Record<PatternEvidenceStage, string> = {
  needs_repair: 'No D+1 check has repaired this pattern yet.',
  repaired_once: 'A D+1 original-sentence repair was checked as correct once.',
  transferred_once: 'A delayed new-context reuse check was correct once.',
  stable_after_spaced_reuse: 'A D+7 new-context reuse check was correct after spacing.',
};

type ProgressPageProps = {
  patterns: ErrorPatternSnapshot[];
  isLoading: boolean;
  isError: boolean;
  hasWritten: boolean;
  hasPendingRewrite: boolean;
  isMergePending: boolean;
  onMergePatterns: (input: MergeErrorPatternsInput) => Promise<MergeErrorPatternsResult>;
  onOpenPractice: () => void;
};

export function ProgressPage({
  patterns,
  isLoading,
  isError,
  hasWritten,
  hasPendingRewrite,
  isMergePending,
  onMergePatterns,
  onOpenPractice,
}: ProgressPageProps): React.JSX.Element {
  const [mergeSelections, setMergeSelections] = useState<Record<string, string>>({});
  const [mergeError, setMergeError] = useState<string | null>(null);

  const handleMerge = async (targetPattern: ErrorPatternSnapshot): Promise<void> => {
    const sourcePatternId = mergeSelections[targetPattern.id];
    if (!sourcePatternId || sourcePatternId === targetPattern.id) {
      return;
    }

    setMergeError(null);
    const result = await onMergePatterns({ sourcePatternId, targetPatternId: targetPattern.id });
    if (result.success === false) {
      setMergeError(result.error);
      return;
    }

    setMergeSelections((current) => {
      const nextSelections = { ...current };
      delete nextSelections[targetPattern.id];
      delete nextSelections[sourcePatternId];
      return nextSelections;
    });
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-9" aria-labelledby="progress-page-title">
      <header className="ui-chrome pb-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">Progress</p>
        <h1 id="progress-page-title" className="editorial-heading mt-4 text-5xl text-base-content">
          Pattern evidence
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-base-content/60">
          A calm record of patterns that have appeared in saved reviews and later rewrite practice.
        </p>
      </header>

      <div className="ui-chrome grid max-w-4xl gap-5 md:grid-cols-3">
        <section className="rounded-lg bg-base-100/24 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-base-content/45">Current draft</p>
          <p className="mt-3 text-2xl font-semibold">{hasWritten ? 'In progress' : 'Ready'}</p>
          <p className="mt-3 text-sm leading-6 text-base-content/60">The active template keeps the session focused.</p>
        </section>
        <section className="rounded-lg bg-base-100/24 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-base-content/45">Next rewrite</p>
          <p className="mt-3 text-2xl font-semibold">{hasPendingRewrite ? 'Waiting' : 'After review'}</p>
          <p className="mt-3 text-sm leading-6 text-base-content/60">
            Repair and transfer tasks appear as evidence becomes ready.
          </p>
        </section>
        <section className="rounded-lg bg-base-100/24 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-base-content/45">Patterns</p>
          <p className="mt-3 text-2xl font-semibold">{patterns.length}</p>
          <p className="mt-3 text-sm leading-6 text-base-content/60">
            Review count is separate from learning evidence.
          </p>
        </section>
      </div>

      {mergeError ? <p className="ui-chrome max-w-4xl text-sm text-error">{mergeError}</p> : null}

      <LearningPageState
        isLoading={isLoading}
        isError={isError}
        isEmpty={patterns.length === 0}
        emptyTitle="No recurring patterns yet"
        emptyBody="Save a review and repeated grammar or wording patterns will collect here."
        onOpenPractice={onOpenPractice}
      >
        <div className="grid max-w-5xl gap-4 xl:grid-cols-2">
          {patterns.map((pattern) => {
            const evidence = evidenceForPattern(pattern);
            const evidenceContext = evidenceContextFor(evidence);
            const mergeCandidates = mergeCandidatesForPattern(pattern, patterns);
            const selectedSourceId = mergeSelections[pattern.id] ?? '';

            return (
              <article
                key={pattern.id}
                className="rounded-lg bg-base-100/32 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
              >
                <div className="ui-chrome flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-base-content/45">
                      {pattern.category.replace('_', ' ')}
                    </p>
                    <h2 className="selectable-content mt-2 text-xl font-semibold leading-7 text-base-content">
                      {pattern.rule}
                    </h2>
                  </div>
                  <p className="shrink-0 text-right text-sm font-semibold text-primary">
                    {pattern.count}
                    <span className="block text-xs font-medium text-base-content/45">times seen</span>
                  </p>
                </div>

                <div className="ui-chrome mt-5 border-t border-base-300/45 pt-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-base-content/45">
                    Learning evidence
                  </p>
                  <p className="mt-2 text-lg font-semibold text-primary">{evidenceLabels[evidence.stage]}</p>
                  <p className="mt-2 text-sm leading-6 text-base-content/62">{evidenceDescriptions[evidence.stage]}</p>
                  {evidenceContext ? (
                    <p className="mt-2 text-sm leading-6 text-base-content/62">{evidenceContext}</p>
                  ) : null}
                </div>

                <div className="selectable-content">
                  <p className="mt-4 text-sm leading-6 text-base-content/62">{pattern.canonicalExample}</p>
                  <p className="ui-chrome mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-base-content/45">
                    Last seen {formatDateKeyLabel(pattern.lastSeenDateKey)}
                  </p>
                  {pattern.recentExamples.length > 0 ? (
                    <div className="mt-3 grid gap-2">
                      {pattern.recentExamples.slice(0, 2).map((example) => (
                        <p key={example} className="text-sm leading-6 text-base-content/68">
                          {example}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>

                {mergeCandidates.length > 0 ? (
                  <div className="ui-chrome mt-5 border-t border-base-300/45 pt-4">
                    <label
                      className="text-xs font-semibold uppercase tracking-[0.14em] text-base-content/45"
                      htmlFor={`merge-source-${pattern.id}`}
                    >
                      Merge duplicate
                    </label>
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                      <select
                        id={`merge-source-${pattern.id}`}
                        className="select select-bordered min-h-11 flex-1 rounded-lg bg-base-100/70 text-sm"
                        value={selectedSourceId}
                        disabled={isMergePending}
                        onChange={(event) => {
                          setMergeSelections((current) => ({
                            ...current,
                            [pattern.id]: event.target.value,
                          }));
                        }}
                      >
                        <option value="">Choose pattern</option>
                        {mergeCandidates.map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>
                            {candidate.rule}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn btn-secondary min-h-11 rounded-lg px-5"
                        disabled={!selectedSourceId || isMergePending}
                        onClick={() => {
                          void handleMerge(pattern);
                        }}
                      >
                        Merge
                      </button>
                    </div>
                    {selectedSourceId ? (
                      <p className="mt-3 text-xs leading-5 text-base-content/55">
                        Keeps this pattern and removes the selected duplicate from active review.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </LearningPageState>
    </section>
  );
}

function LearningPageState({
  isLoading,
  isError,
  isEmpty,
  emptyTitle,
  emptyBody,
  onOpenPractice,
  children,
}: {
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  emptyTitle: string;
  emptyBody: string;
  onOpenPractice: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  if (isLoading) {
    return <p className="ui-chrome text-sm text-base-content/60">Opening learning history...</p>;
  }

  if (isError) {
    return <p className="selectable-content text-sm text-error">Learning history is unavailable right now.</p>;
  }

  if (isEmpty) {
    return (
      <section className="ui-chrome max-w-2xl pt-2">
        <h2 className="text-2xl font-semibold">{emptyTitle}</h2>
        <p className="mt-4 text-sm leading-6 text-base-content/60">{emptyBody}</p>
        <button type="button" className="btn btn-primary mt-6 rounded-[0.7rem]" onClick={onOpenPractice}>
          Start practice
        </button>
      </section>
    );
  }

  return <>{children}</>;
}

function evidenceForPattern(pattern: ErrorPatternSnapshot): PatternEvidenceSummary {
  return pattern.evidence ?? { stage: 'needs_repair', latestRepair: null };
}

function mergeCandidatesForPattern(
  targetPattern: ErrorPatternSnapshot,
  patterns: ErrorPatternSnapshot[],
): ErrorPatternSnapshot[] {
  return patterns.filter(
    (pattern) =>
      pattern.id !== targetPattern.id &&
      pattern.active &&
      !pattern.mergedIntoPatternId &&
      pattern.category === targetPattern.category,
  );
}

function evidenceContextFor(evidence: PatternEvidenceSummary): string | null {
  const repair = evidence.latestRepair;
  if (!repair) {
    return 'No D+1 repair check is recorded yet.';
  }

  const lifecycleContext = lifecycleContextFor(repair);
  if (lifecycleContext) {
    return lifecycleContext;
  }

  return checkContextFor(repair.latestCheck);
}

function lifecycleContextFor(repair: PatternEvidenceRepairSummary): string | null {
  switch (repair.status) {
    case 'skipped':
      return 'Latest D+1 repair was skipped; evidence is unchanged.';
    case 'snoozed':
      return 'Latest D+1 repair is snoozed; evidence is unchanged.';
    case 'expired':
      return 'Latest D+1 repair window expired; evidence is unchanged.';
    case 'completed':
      return repair.latestCheck ? null : 'D+1 repair was submitted; no completed check is recorded yet.';
    case 'in_progress':
      return 'D+1 repair is in progress.';
    case 'pending':
      return 'D+1 repair is waiting.';
  }
}

function checkContextFor(check: PatternEvidenceCheckSummary | null): string | null {
  if (!check) {
    return null;
  }

  if (check.status === 'pending' || check.status === 'in_progress') {
    return 'Latest D+1 check is still running.';
  }

  if (check.status === 'retryable' || check.status === 'failed') {
    return 'Latest D+1 check needs retry; evidence is unchanged.';
  }

  switch (check.outcome) {
    case 'correct':
      return 'Latest D+1 check repaired the original sentence.';
    case 'partly_correct':
      return 'Latest D+1 check was partly correct; evidence is unchanged.';
    case 'incorrect':
      return 'Latest D+1 check was incorrect; evidence is unchanged.';
    case null:
      return null;
  }
}

function formatDateKeyLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map((part) => Number.parseInt(part, 10));
  if (!year || !month || !day) {
    return dateKey;
  }

  return new Date(year, month - 1, day).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
