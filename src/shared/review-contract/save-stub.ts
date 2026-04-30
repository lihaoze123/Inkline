import type { PreviewOperations } from './validation';

export type SaveSimulationSummary = {
  savedReviewRunIds: string[];
  patternCountIncrements: Record<string, number>;
  rewriteTaskIds: string[];
  referenceRewriteIds: string[];
  selfRepairAttemptIds: string[];
};

type SavedRun = {
  reviewRunId: string;
  operations: PreviewOperations;
};

export class ReviewSaveStub {
  private readonly savedRuns = new Map<string, SavedRun>();
  private readonly patternCountIncrements = new Map<string, number>();
  private readonly rewriteTaskIds = new Set<string>();
  private readonly referenceRewriteIds = new Set<string>();
  private readonly selfRepairAttemptIds = new Set<string>();

  saveReviewRun(reviewRunId: string, operations: PreviewOperations): SaveSimulationSummary {
    if (!this.savedRuns.has(reviewRunId)) {
      this.savedRuns.set(reviewRunId, { reviewRunId, operations });
      this.applyOperations(reviewRunId, operations);
    }

    return this.summary();
  }

  summary(): SaveSimulationSummary {
    return {
      savedReviewRunIds: Array.from(this.savedRuns.keys()).sort(),
      patternCountIncrements: Object.fromEntries(
        Array.from(this.patternCountIncrements.entries()).sort(([left], [right]) => left.localeCompare(right)),
      ),
      rewriteTaskIds: Array.from(this.rewriteTaskIds).sort(),
      referenceRewriteIds: Array.from(this.referenceRewriteIds).sort(),
      selfRepairAttemptIds: Array.from(this.selfRepairAttemptIds).sort(),
    };
  }

  private applyOperations(reviewRunId: string, operations: PreviewOperations): void {
    operations.patternOperations.forEach((operation) => {
      if (operation.kind === 'reuse_pattern') {
        this.patternCountIncrements.set(
          operation.patternId,
          (this.patternCountIncrements.get(operation.patternId) ?? 0) + 1,
        );
      }
    });

    operations.rewritePractice.forEach((operation) => {
      this.rewriteTaskIds.add(`${reviewRunId}:rewrite:${operation.taskIndex}`);
    });

    operations.referenceRewrites.forEach((operation) => {
      this.referenceRewriteIds.add(`${reviewRunId}:reference:${operation.rewriteIndex}`);
    });

    if (operations.selfRepair) {
      this.selfRepairAttemptIds.add(`${reviewRunId}:self-repair:${operations.selfRepair.correctionIndex}`);
    }
  }
}
