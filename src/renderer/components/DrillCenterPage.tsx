import { useMemo } from 'react';
import type {
  ErrorPatternSnapshot,
  PatternEvidenceCheckSummary,
  PatternEvidenceRepairSummary,
  PatternEvidenceStage,
  PatternEvidenceSummary,
  PatternEvidenceTransferSummary,
} from '@shared/types/learning-assets';
import type { WritingAttemptSnapshot } from '@shared/types/writing';

const evidenceLabels: Record<PatternEvidenceStage, string> = {
  needs_repair: 'Needs repair',
  repaired_once: 'Repaired once',
  transferred_once: 'Transferred once',
  stable_after_spaced_reuse: 'Stable after spaced reuse',
};

const evidenceDescriptions: Record<PatternEvidenceStage, string> = {
  needs_repair: 'Needs a D+1 repair checked as correct.',
  repaired_once: 'D+1 repair was checked as correct once; delayed transfer comes next.',
  transferred_once: 'A delayed new-context reuse check was correct once.',
  stable_after_spaced_reuse: 'D+7 spaced reuse was checked as correct after spacing.',
};

type PendingRewritePractice = WritingAttemptSnapshot['pendingRewritePractice'];
type EvidenceContext = PatternEvidenceRepairSummary | PatternEvidenceTransferSummary;
type DrillTone = 'current' | 'attention' | 'waiting' | 'quiet';

type CurrentDrillMatch = {
  context: EvidenceContext;
  label: string;
};

type DrillState = {
  label: string;
  description: string;
  tone: DrillTone;
};

type DrillCandidate = {
  pattern: ErrorPatternSnapshot;
  evidence: PatternEvidenceSummary;
  currentMatch: CurrentDrillMatch | null;
  state: DrillState;
};

type DrillCenterPageProps = {
  patterns: ErrorPatternSnapshot[];
  pendingRewritePractice: PendingRewritePractice;
  isLoading: boolean;
  isError: boolean;
  onOpenPractice: () => void;
  onOpenProgress: () => void;
};

export function DrillCenterPage({
  patterns,
  pendingRewritePractice,
  isLoading,
  isError,
  onOpenPractice,
  onOpenProgress,
}: DrillCenterPageProps): React.JSX.Element {
  const candidates = useMemo(
    () =>
      patterns
        .filter((pattern) => pattern.active && pattern.mergedIntoPatternId === null)
        .map((pattern) => drillCandidateFor(pattern, pendingRewritePractice))
        .sort(compareDrillCandidates),
    [patterns, pendingRewritePractice],
  );

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-8" aria-labelledby="drill-center-page-title">
      <header className="ui-chrome pb-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">Drills</p>
        <h1 id="drill-center-page-title" className="editorial-heading mt-4 text-5xl text-base-content">
          Drill Center
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-base-content/60">
          A focused queue for repair and transfer work already created by saved reviews.
        </p>
      </header>

      <DrillCenterState
        isLoading={isLoading}
        isError={isError}
        isEmpty={candidates.length === 0}
        onOpenPractice={onOpenPractice}
      >
        <div className="grid max-w-5xl gap-3" data-e2e="drill-center-patterns">
          {candidates.map((candidate) => (
            <DrillPatternCard
              key={candidate.pattern.id}
              candidate={candidate}
              onOpenPractice={onOpenPractice}
              onOpenProgress={onOpenProgress}
            />
          ))}
        </div>
      </DrillCenterState>
    </section>
  );
}

function DrillPatternCard({
  candidate,
  onOpenPractice,
  onOpenProgress,
}: {
  candidate: DrillCandidate;
  onOpenPractice: () => void;
  onOpenProgress: () => void;
}): React.JSX.Element {
  const { pattern, evidence, currentMatch, state } = candidate;
  const isCurrent = currentMatch !== null;

  return (
    <article
      className={`rounded-lg border p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] ${
        isCurrent
          ? 'border-primary/25 bg-primary/[0.055]'
          : state.tone === 'attention'
            ? 'border-warning/25 bg-warning/[0.055]'
            : 'border-base-300/35 bg-base-100/30'
      }`}
    >
      <div className="ui-chrome flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-base-content/45">
            <span>{pattern.category.replace(/_/g, ' ')}</span>
            {isCurrent ? <span className="rounded-full bg-primary/10 px-2 py-1 text-primary">Current task</span> : null}
          </div>
          <h2 className="selectable-content mt-2 text-lg font-semibold leading-7 text-base-content">{pattern.rule}</h2>
        </div>
        <p className="shrink-0 text-right text-sm font-semibold text-primary">
          {pattern.count}
          <span className="block text-xs font-medium text-base-content/45">times seen</span>
        </p>
      </div>

      <div className="ui-chrome mt-4 grid gap-4 border-t border-base-300/45 pt-4 md:grid-cols-[1fr_1fr_1.2fr]">
        <StatusBlock label="Lifecycle" title={pattern.lifecycle.label} body={pattern.lifecycle.description} />
        <StatusBlock
          label="Evidence"
          title={evidenceLabels[evidence.stage]}
          body={evidenceDescriptions[evidence.stage]}
        />
        <StatusBlock label="Next drill state" title={state.label} body={state.description} tone={state.tone} />
      </div>

      <div className="ui-chrome mt-4 grid gap-2 text-sm leading-6 text-base-content/62">
        <p>{repairContextLine(evidence.latestRepair)}</p>
        {evidence.latestTransfer ? <p>{transferContextLine(evidence.latestTransfer)}</p> : null}
        {pattern.lifecycle.blockingReason ? <p>{pattern.lifecycle.blockingReason}</p> : null}
      </div>

      <div className="ui-chrome mt-5 flex flex-wrap gap-3">
        {currentMatch ? (
          <button
            type="button"
            className="btn btn-primary btn-sm rounded-[0.65rem] px-5"
            data-e2e={`drill-open-practice-${pattern.id}`}
            onClick={onOpenPractice}
          >
            Open Practice
          </button>
        ) : null}
        <button type="button" className="btn btn-outline btn-sm rounded-[0.65rem] px-5" onClick={onOpenProgress}>
          Open Progress
        </button>
      </div>
    </article>
  );
}

function StatusBlock({
  label,
  title,
  body,
  tone = 'quiet',
}: {
  label: string;
  title: string;
  body: string;
  tone?: DrillTone;
}): React.JSX.Element {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-base-content/45">{label}</p>
      <p className={`mt-2 text-base font-semibold ${tone === 'attention' ? 'text-warning' : 'text-primary'}`}>
        {title}
      </p>
      <p className="mt-2 text-sm leading-6 text-base-content/62">{body}</p>
    </div>
  );
}

function DrillCenterState({
  isLoading,
  isError,
  isEmpty,
  onOpenPractice,
  children,
}: {
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  onOpenPractice: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  if (isLoading) {
    return <p className="ui-chrome text-sm text-base-content/60">Opening drill center...</p>;
  }

  if (isError) {
    return <p className="selectable-content text-sm text-error">Drill Center is unavailable right now.</p>;
  }

  if (isEmpty) {
    return (
      <section className="ui-chrome max-w-2xl pt-2">
        <h2 className="text-2xl font-semibold">No drill candidates yet</h2>
        <p className="mt-4 text-sm leading-6 text-base-content/60">
          Save reviews to collect patterns. Scheduled repair and transfer tasks will appear here.
        </p>
        <button type="button" className="btn btn-primary mt-6 rounded-[0.7rem]" onClick={onOpenPractice}>
          Start practice
        </button>
      </section>
    );
  }

  return <>{children}</>;
}

function drillCandidateFor(
  pattern: ErrorPatternSnapshot,
  pendingRewritePractice: PendingRewritePractice,
): DrillCandidate {
  const evidence = evidenceForPattern(pattern);
  const currentMatch = currentMatchForEvidence(evidence, pendingRewritePractice);
  return {
    pattern,
    evidence,
    currentMatch,
    state: drillStateFor(pattern, evidence, currentMatch),
  };
}

function evidenceForPattern(pattern: ErrorPatternSnapshot): PatternEvidenceSummary {
  return pattern.evidence ?? { stage: 'needs_repair', latestRepair: null, latestTransfer: null };
}

function currentMatchForEvidence(
  evidence: PatternEvidenceSummary,
  pendingRewritePractice: PendingRewritePractice,
): CurrentDrillMatch | null {
  if (!pendingRewritePractice) {
    return null;
  }

  if (evidence.latestRepair?.rewriteTaskId === pendingRewritePractice.id) {
    return {
      context: evidence.latestRepair,
      label: stageLabelFor(evidence.latestRepair),
    };
  }

  if (evidence.latestTransfer?.rewriteTaskId === pendingRewritePractice.id) {
    return {
      context: evidence.latestTransfer,
      label: stageLabelFor(evidence.latestTransfer),
    };
  }

  return null;
}

function drillStateFor(
  pattern: ErrorPatternSnapshot,
  evidence: PatternEvidenceSummary,
  currentMatch: CurrentDrillMatch | null,
): DrillState {
  if (currentMatch) {
    return {
      label: 'Ready in Practice',
      description: `${currentMatch.label} matches the current Practice task.`,
      tone: 'current',
    };
  }

  const attention = attentionLineForEvidence(evidence);
  if (attention) {
    return {
      label: 'Follow-up needed',
      description: attention,
      tone: 'attention',
    };
  }

  const scheduled = scheduledLineForEvidence(evidence);
  if (scheduled) {
    return {
      label: 'Scheduled',
      description: scheduled,
      tone: 'waiting',
    };
  }

  switch (evidence.stage) {
    case 'needs_repair':
      return {
        label: 'Repair next',
        description: 'Wait for the D+1 repair task from the saved review, then work it in Practice.',
        tone: 'waiting',
      };
    case 'repaired_once':
      return {
        label: 'Transfer next',
        description: 'The next useful drill is a delayed D+3 new-context transfer.',
        tone: 'waiting',
      };
    case 'transferred_once':
      return {
        label: 'Spaced reuse next',
        description: 'The next useful drill is D+7 spaced reuse in a new context.',
        tone: 'waiting',
      };
    case 'stable_after_spaced_reuse':
      return {
        label: pattern.lifecycle.status === 'stable' ? 'No due drill' : 'Keep in view',
        description: 'No current drill is due; keep using this pattern in future writing.',
        tone: 'quiet',
      };
  }
}

function attentionLineForEvidence(evidence: PatternEvidenceSummary): string | null {
  const contexts = [evidence.latestRepair, evidence.latestTransfer].filter(
    (context): context is EvidenceContext => context !== null,
  );

  return (
    contexts
      .map((context) => ({ context, line: attentionLineForContext(context) }))
      .filter((entry): entry is { context: EvidenceContext; line: string } => entry.line !== null)
      .sort((left, right) => contextRank(right.context) - contextRank(left.context))[0]?.line ?? null
  );
}

function attentionLineForContext(context: EvidenceContext): string | null {
  const label = stageLabelFor(context);
  const latestCheck = context.latestCheck;

  if (latestCheck?.status === 'retryable' || latestCheck?.status === 'failed') {
    return `${label} check needs retry; the saved answer is context, not success.`;
  }

  if (latestCheck?.status === 'completed') {
    if (latestCheck.outcome === 'partly_correct') {
      return `${label} was partly correct; keep it as context and try this stage again.`;
    }

    if (latestCheck.outcome === 'incorrect') {
      return `${label} was incorrect; keep it as context and try this stage again.`;
    }
  }

  return null;
}

function scheduledLineForEvidence(evidence: PatternEvidenceSummary): string | null {
  const contexts = [evidence.latestRepair, evidence.latestTransfer].filter(
    (context): context is EvidenceContext => context !== null,
  );

  return (
    contexts
      .map((context) => ({ context, line: scheduledLineForContext(context) }))
      .filter((entry): entry is { context: EvidenceContext; line: string } => entry.line !== null)
      .sort((left, right) => contextRank(right.context) - contextRank(left.context))[0]?.line ?? null
  );
}

function scheduledLineForContext(context: EvidenceContext): string | null {
  const label = stageLabelFor(context);

  switch (context.status) {
    case 'pending':
      return `${label} is waiting in the learning loop.`;
    case 'in_progress':
      return `${label} is already in progress.`;
    case 'snoozed':
      return `${label} is snoozed; evidence is unchanged.`;
    case 'skipped':
      return `${label} was skipped; evidence is unchanged.`;
    case 'expired':
      return `${label} window expired; evidence is unchanged.`;
    case 'completed':
      return null;
  }
}

function repairContextLine(repair: PatternEvidenceRepairSummary | null): string {
  if (!repair) {
    return 'D+1 repair: no repair task is recorded yet.';
  }

  return `${stageLabelFor(repair)}: ${taskStatusText(repair.status)}${checkSuffix(repair.latestCheck)}.`;
}

function transferContextLine(transfer: PatternEvidenceTransferSummary): string {
  return `${stageLabelFor(transfer)}: ${taskStatusText(transfer.status)}${checkSuffix(transfer.latestCheck)}.`;
}

function taskStatusText(status: EvidenceContext['status']): string {
  switch (status) {
    case 'pending':
      return 'waiting';
    case 'in_progress':
      return 'in progress';
    case 'completed':
      return 'submitted';
    case 'skipped':
      return 'skipped';
    case 'snoozed':
      return 'snoozed';
    case 'expired':
      return 'expired';
  }
}

function checkSuffix(check: PatternEvidenceCheckSummary | null): string {
  if (!check) {
    return '';
  }

  if (check.status === 'pending' || check.status === 'in_progress') {
    return '; check still running';
  }

  if (check.status === 'retryable' || check.status === 'failed') {
    return '; check needs retry';
  }

  switch (check.outcome) {
    case 'correct':
      return '; correct check recorded';
    case 'partly_correct':
      return '; partly correct check recorded';
    case 'incorrect':
      return '; incorrect check recorded';
    case null:
      return '';
  }
}

function stageLabelFor(context: EvidenceContext): string {
  if (context.practiceKind === 'rewrite_original') {
    return 'D+1 repair';
  }

  return context.spacedStage === 'D+7' ? 'D+7 spaced reuse' : 'D+3 transfer';
}

function contextRank(context: EvidenceContext): number {
  if (context.practiceKind === 'rewrite_original') {
    return 1;
  }

  return context.spacedStage === 'D+7' ? 3 : 2;
}

function compareDrillCandidates(left: DrillCandidate, right: DrillCandidate): number {
  const stateRankDifference = candidateSortRank(left) - candidateSortRank(right);
  if (stateRankDifference !== 0) {
    return stateRankDifference;
  }

  const updatedDifference = right.pattern.updatedAt - left.pattern.updatedAt;
  if (updatedDifference !== 0) {
    return updatedDifference;
  }

  const countDifference = right.pattern.count - left.pattern.count;
  if (countDifference !== 0) {
    return countDifference;
  }

  return left.pattern.id.localeCompare(right.pattern.id);
}

function candidateSortRank(candidate: DrillCandidate): number {
  if (candidate.currentMatch) {
    return 0;
  }

  if (candidate.pattern.lifecycle.status === 'needs_attention') {
    return 1;
  }

  switch (candidate.evidence.stage) {
    case 'needs_repair':
      return 2;
    case 'repaired_once':
      return 3;
    case 'transferred_once':
      return 4;
    case 'stable_after_spaced_reuse':
      return 5;
  }
}
