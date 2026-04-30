import { createHash } from 'node:crypto';
import { locateAnchor, normalizeWritingContent, type AnchorLocation } from './anchoring';
import {
  reviewOutputSchema,
  type CorrectionStatus,
  type ErrorPattern,
  type ReviewInput,
  type ReviewOutput,
  type ValidationStatus,
} from './schemas';

export type ValidationIssueSeverity = 'error' | 'warning';

export type ValidationIssue = {
  severity: ValidationIssueSeverity;
  code: string;
  message: string;
  path?: string;
};

export type AnchoredCorrectionOperation = {
  correctionIndex: number;
  originalText: string;
  correctedText: string;
  explanation: string;
  category: ReviewOutput['corrections'][number]['category'];
  confidence: ReviewOutput['corrections'][number]['confidence'];
  status: CorrectionStatus;
  startOffset: number | null;
  endOffset: number | null;
  contentHash: string;
  matchedPatternId: string | null;
  newPatternSuggestion: ReviewOutput['corrections'][number]['newPatternSuggestion'];
  lowConfidenceReason?: string;
};

export type PatternOperation =
  | {
      kind: 'reuse_pattern';
      correctionIndex: number;
      patternId: string;
      updatesLongTermStats: false;
    }
  | {
      kind: 'suggest_new_pattern';
      correctionIndex: number;
      category: ReviewOutput['corrections'][number]['category'];
      rule: string;
      canonicalExample: string;
      patternKey: string;
      duplicateOfPatternId?: string;
      updatesLongTermStats: false;
    };

export type ReferenceRewriteOperation = {
  rewriteIndex: number;
  text: string;
  noticeTheGap: string;
  updatesLongTermStats: false;
};

export type SelfRepairOperation = {
  correctionIndex: number;
  prompt: string;
  hint: string;
  updatesLongTermStats: false;
};

export type RewritePracticeOperation = {
  taskIndex: number;
  kind: ReviewOutput['rewriteTasks'][number]['kind'];
  prompt: string;
  focusCorrectionIndexes: number[];
  dueOffsetDays: number;
  revealNativeModelAfterSubmit: boolean;
  updatesLongTermStats: false;
};

export type PreviewOperations = {
  corrections: AnchoredCorrectionOperation[];
  patternOperations: PatternOperation[];
  referenceRewrites: ReferenceRewriteOperation[];
  selfRepair: SelfRepairOperation | null;
  rewritePractice: RewritePracticeOperation[];
  inputBridge: {
    correctionIndex: number;
    examples: string[];
    updatesLongTermStats: false;
  } | null;
};

export type ReviewValidationResult = {
  schemaValid: boolean;
  validationStatus: ValidationStatus;
  issues: ValidationIssue[];
  anchoringSuccessRate: number;
  parsedOutput: ReviewOutput | null;
  operations: PreviewOperations;
};

type ValidateReviewOptions = {
  lowConfidenceInvalidThreshold?: number;
};

const DEFAULT_LOW_CONFIDENCE_INVALID_THRESHOLD = 0.5;
const GENERIC_WHAT_WENT_WELL = new Set(['good job', 'nice work', 'well done', 'good writing', 'great job']);

export function validateReviewResult(
  input: ReviewInput,
  agentOutput: unknown,
  options: ValidateReviewOptions = {},
): ReviewValidationResult {
  const parseResult = reviewOutputSchema.safeParse(agentOutput);
  if (!parseResult.success) {
    return invalidResult(
      parseResult.error.issues.map((issue) => ({
        severity: 'error',
        code: 'schema_invalid',
        message: issue.message,
        path: issue.path.join('.'),
      })),
    );
  }

  const output = parseResult.data;
  const issues: ValidationIssue[] = [];
  const correctionCount = output.corrections.length;
  const existingPatternIds = new Set(input.existingPatterns.map((pattern) => pattern.id));
  const normalizedContentHash = input.contentHash;
  const actualContentHash = hashNormalizedContent(input.writingContent);
  if (normalizedContentHash !== actualContentHash) {
    issues.push({
      severity: 'error',
      code: 'content_hash_mismatch',
      message: 'contentHash does not match normalized writing content',
    });
  }

  const anchoredCorrections = output.corrections.map((correction, correctionIndex): AnchoredCorrectionOperation => {
    const anchorResult = locateAnchor(input.writingContent, correction.anchor);
    const anchorLocation = anchorResult.success === true ? anchorResult.location : null;

    if (anchorResult.success === false) {
      issues.push({
        severity: 'warning',
        code: 'anchor_failed',
        message: anchorResult.failure.reason,
        path: `corrections.${correctionIndex}.anchor`,
      });
    }

    if (anchorLocation && normalizeWritingContent(correction.originalText) !== anchorLocation.matchedText) {
      issues.push({
        severity: 'warning',
        code: 'original_text_mismatch',
        message: 'originalText does not match the anchored exact quote; anchor exact text is authoritative',
        path: `corrections.${correctionIndex}.originalText`,
      });
    }

    if (correction.matchedPatternId && !existingPatternIds.has(correction.matchedPatternId)) {
      issues.push({
        severity: 'error',
        code: 'matched_pattern_missing',
        message: `matchedPatternId does not exist: ${correction.matchedPatternId}`,
        path: `corrections.${correctionIndex}.matchedPatternId`,
      });
    }

    return correctionOperation(
      input.contentHash,
      correction,
      correctionIndex,
      anchorLocation,
      anchorResult.success === false ? anchorResult.failure.reason : undefined,
    );
  });

  validateCaps(input, output, issues);
  validateFocus(output, correctionCount, issues);
  validateSelfRepair(output, issues);
  validateReferenceRewrites(output, issues);
  validateRewriteTasks(output, correctionCount, issues);
  validateInputBridge(input, output, issues);
  validateWhatWentWell(input, output, issues);
  validateUpgradeExclusion(output, issues);

  const lowConfidenceCount = anchoredCorrections.filter((correction) => correction.status === 'low_confidence').length;
  const anchoringSuccessRate = correctionCount === 0 ? 1 : (correctionCount - lowConfidenceCount) / correctionCount;
  const threshold = options.lowConfidenceInvalidThreshold ?? DEFAULT_LOW_CONFIDENCE_INVALID_THRESHOLD;

  let validationStatus: ValidationStatus = 'valid';
  if (issues.some((issue) => issue.severity === 'error')) {
    validationStatus = 'invalid';
  } else if (correctionCount > 0 && lowConfidenceCount / correctionCount > threshold) {
    validationStatus = 'invalid';
    issues.push({
      severity: 'error',
      code: 'too_many_low_confidence_anchors',
      message: 'low-confidence corrections exceed the invalid threshold',
    });
  } else if (lowConfidenceCount > 0 || issues.some((issue) => issue.severity === 'warning')) {
    validationStatus = 'valid_with_warnings';
  }

  return {
    schemaValid: true,
    validationStatus,
    issues,
    anchoringSuccessRate,
    parsedOutput: output,
    operations:
      validationStatus === 'invalid'
        ? emptyOperations()
        : buildPreviewOperations(output, anchoredCorrections, input.existingPatterns),
  };
}

function invalidResult(issues: ValidationIssue[]): ReviewValidationResult {
  return {
    schemaValid: false,
    validationStatus: 'invalid',
    issues,
    anchoringSuccessRate: 0,
    parsedOutput: null,
    operations: emptyOperations(),
  };
}

function emptyOperations(): PreviewOperations {
  return {
    corrections: [],
    patternOperations: [],
    referenceRewrites: [],
    selfRepair: null,
    rewritePractice: [],
    inputBridge: null,
  };
}

function correctionOperation(
  contentHash: string,
  correction: ReviewOutput['corrections'][number],
  correctionIndex: number,
  anchorLocation: AnchorLocation | null,
  anchorFailureReason: string | undefined,
): AnchoredCorrectionOperation {
  const isLowConfidence = !anchorLocation || correction.confidence === 'low';

  return {
    correctionIndex,
    originalText: correction.originalText,
    correctedText: correction.correctedText,
    explanation: correction.explanation,
    category: correction.category,
    confidence: correction.confidence,
    status: isLowConfidence ? 'low_confidence' : 'suggested',
    startOffset: anchorLocation?.startOffset ?? null,
    endOffset: anchorLocation?.endOffset ?? null,
    contentHash,
    matchedPatternId: correction.matchedPatternId ?? null,
    newPatternSuggestion: correction.newPatternSuggestion ?? null,
    lowConfidenceReason: anchorFailureReason ?? (correction.confidence === 'low' ? 'model_low_confidence' : undefined),
  };
}

function validateCaps(input: ReviewInput, output: ReviewOutput, issues: ValidationIssue[]): void {
  if (output.corrections.length > input.maxCorrections) {
    issues.push({ severity: 'error', code: 'max_corrections_exceeded', message: 'corrections exceed maxCorrections' });
  }
  if (output.referenceRewrites.length > input.maxReferenceRewrites) {
    issues.push({
      severity: 'error',
      code: 'max_reference_rewrites_exceeded',
      message: 'referenceRewrites exceed maxReferenceRewrites',
    });
  }
  if (output.rewriteTasks.length > input.maxRewriteTasks) {
    issues.push({
      severity: 'error',
      code: 'max_rewrite_tasks_exceeded',
      message: 'rewriteTasks exceed maxRewriteTasks',
    });
  }
  if (output.upgradeOpportunities.length > input.maxUpgradeOpportunities) {
    issues.push({
      severity: 'error',
      code: 'max_upgrade_opportunities_exceeded',
      message: 'upgradeOpportunities exceed maxUpgradeOpportunities',
    });
  }
}

function validateFocus(output: ReviewOutput, correctionCount: number, issues: ValidationIssue[]): void {
  const focusIndex = output.summary.focusPattern.correctionIndex;
  if (correctionCount === 0) {
    issues.push({
      severity: 'error',
      code: 'focus_correction_missing',
      message: 'summary.focusPattern requires at least one correction',
    });
  } else if (focusIndex >= correctionCount) {
    issues.push({
      severity: 'error',
      code: 'focus_correction_missing',
      message: 'summary.focusPattern references a missing correction',
    });
  }
}

function validateSelfRepair(output: ReviewOutput, issues: ValidationIssue[]): void {
  if (output.selfRepairTask.correctionIndex !== output.summary.focusPattern.correctionIndex) {
    issues.push({
      severity: 'error',
      code: 'self_repair_focus_mismatch',
      message: 'selfRepairTask must reference the focus correction',
    });
  }

  const focusCorrection = output.corrections[output.summary.focusPattern.correctionIndex];
  if (focusCorrection && output.selfRepairTask.hint.includes(focusCorrection.correctedText)) {
    issues.push({
      severity: 'error',
      code: 'self_repair_hint_leaks_answer',
      message: 'selfRepairTask.hint must not reveal the full corrected text',
    });
  }
}

function validateReferenceRewrites(output: ReviewOutput, issues: ValidationIssue[]): void {
  output.referenceRewrites.forEach((rewrite, rewriteIndex) => {
    if (rewrite.noticeTheGap.trim().length === 0) {
      issues.push({
        severity: 'error',
        code: 'reference_rewrite_missing_gap',
        message: 'reference rewrite lacks noticeTheGap',
        path: `referenceRewrites.${rewriteIndex}.noticeTheGap`,
      });
    }
  });
}

function validateRewriteTasks(output: ReviewOutput, correctionCount: number, issues: ValidationIssue[]): void {
  output.rewriteTasks.forEach((task, taskIndex) => {
    if (task.kind !== 'rewrite_original') {
      issues.push({
        severity: 'error',
        code: 'unsupported_rewrite_task_kind',
        message: 'v0.1 only supports rewrite_original rewrite tasks',
        path: `rewriteTasks.${taskIndex}.kind`,
      });
    }

    task.focusCorrectionIndexes.forEach((correctionIndex) => {
      if (correctionIndex >= correctionCount) {
        issues.push({
          severity: 'error',
          code: 'rewrite_task_correction_missing',
          message: 'rewrite task references a missing correction index',
          path: `rewriteTasks.${taskIndex}.focusCorrectionIndexes`,
        });
      }
    });
  });
}

function validateInputBridge(input: ReviewInput, output: ReviewOutput, issues: ValidationIssue[]): void {
  if (output.inputBridge.correctionIndex !== output.summary.focusPattern.correctionIndex) {
    issues.push({
      severity: 'error',
      code: 'input_bridge_focus_mismatch',
      message: 'inputBridge must focus on the focus correction',
    });
  }

  if (output.inputBridge.examples.length > input.maxInputExamples) {
    issues.push({
      severity: 'error',
      code: 'max_input_examples_exceeded',
      message: 'inputBridge examples exceed maxInputExamples',
    });
  }

  const focusCorrection = output.corrections[output.summary.focusPattern.correctionIndex];
  if (focusCorrection) {
    const focusTerms = tokenize(`${focusCorrection.correctedText} ${focusCorrection.newPatternSuggestion?.rule ?? ''}`);
    const matchingExamples = output.inputBridge.examples.filter(
      (example) => tokenOverlap(tokenize(example), focusTerms) > 0,
    );
    if (output.inputBridge.examples.length > 0 && matchingExamples.length === 0) {
      issues.push({
        severity: 'warning',
        code: 'input_bridge_examples_not_focus_pattern',
        message: 'inputBridge examples do not appear to match the focus pattern',
      });
    }
  }
}

function validateWhatWentWell(input: ReviewInput, output: ReviewOutput, issues: ValidationIssue[]): void {
  if (output.summary.whatWentWell.length === 0) {
    issues.push({
      severity: 'error',
      code: 'what_went_well_empty',
      message: 'whatWentWell must contain at least one concrete item',
    });
  }

  if (output.summary.whatWentWell.length > input.maxWhatWentWell) {
    issues.push({
      severity: 'error',
      code: 'max_what_went_well_exceeded',
      message: 'whatWentWell exceeds maxWhatWentWell',
    });
  }

  output.summary.whatWentWell.forEach((item, index) => {
    const normalized = item.trim().toLowerCase().replace(/[.!]/g, '');
    if (GENERIC_WHAT_WENT_WELL.has(normalized) || item.trim().split(/\s+/).length < 3) {
      issues.push({
        severity: 'warning',
        code: 'what_went_well_generic',
        message: 'whatWentWell should be concrete',
        path: `summary.whatWentWell.${index}`,
      });
    }
  });
}

function validateUpgradeExclusion(output: ReviewOutput, issues: ValidationIssue[]): void {
  if (output.upgradeOpportunities.length > 0) {
    issues.push({
      severity: 'warning',
      code: 'upgrade_opportunities_ignored',
      message: 'upgradeOpportunities are empty or ignored in v0.1',
    });
  }

  output.corrections.forEach((correction, correctionIndex) => {
    if (correction.category === 'wordiness' && /upgrade opportunity/i.test(correction.explanation)) {
      issues.push({
        severity: 'error',
        code: 'upgrade_mixed_into_corrections',
        message: 'upgrade opportunities must not be mixed into corrections',
        path: `corrections.${correctionIndex}.explanation`,
      });
    }
  });
}

function buildPreviewOperations(
  output: ReviewOutput,
  corrections: AnchoredCorrectionOperation[],
  existingPatterns: ErrorPattern[],
): PreviewOperations {
  return {
    corrections,
    patternOperations: corrections.flatMap((correction) => patternOperation(correction, existingPatterns)),
    referenceRewrites: output.referenceRewrites.map((rewrite, rewriteIndex) => ({
      rewriteIndex,
      text: rewrite.text,
      noticeTheGap: rewrite.noticeTheGap,
      updatesLongTermStats: false,
    })),
    selfRepair: {
      correctionIndex: output.selfRepairTask.correctionIndex,
      prompt: output.selfRepairTask.prompt,
      hint: output.selfRepairTask.hint,
      updatesLongTermStats: false,
    },
    rewritePractice: output.rewriteTasks
      .map((task, taskIndex) => ({ task, taskIndex }))
      .filter(({ task }) =>
        task.focusCorrectionIndexes.every(
          (correctionIndex) => corrections[correctionIndex]?.status !== 'low_confidence',
        ),
      )
      .map(({ task, taskIndex }) => ({
        taskIndex,
        kind: task.kind,
        prompt: task.prompt,
        focusCorrectionIndexes: task.focusCorrectionIndexes,
        dueOffsetDays: task.dueOffsetDays ?? 1,
        revealNativeModelAfterSubmit: task.revealNativeModelAfterSubmit ?? true,
        updatesLongTermStats: false,
      })),
    inputBridge: {
      correctionIndex: output.inputBridge.correctionIndex,
      examples: output.inputBridge.examples,
      updatesLongTermStats: false,
    },
  };
}

function patternOperation(
  correction: AnchoredCorrectionOperation,
  existingPatterns: ErrorPattern[],
): PatternOperation[] {
  if (correction.status === 'low_confidence') {
    return [];
  }

  if (correction.matchedPatternId) {
    return [
      {
        kind: 'reuse_pattern',
        correctionIndex: correction.correctionIndex,
        patternId: correction.matchedPatternId,
        updatesLongTermStats: false,
      },
    ];
  }

  if (correction.newPatternSuggestion) {
    const patternKey = normalizePatternKey(
      correction.newPatternSuggestion.category,
      correction.newPatternSuggestion.rule,
    );
    const duplicate = existingPatterns.find(
      (pattern) => normalizePatternKey(pattern.category, pattern.rule) === patternKey,
    );
    return [
      {
        kind: 'suggest_new_pattern',
        correctionIndex: correction.correctionIndex,
        category: correction.newPatternSuggestion.category,
        rule: correction.newPatternSuggestion.rule,
        canonicalExample: correction.newPatternSuggestion.canonicalExample,
        patternKey,
        duplicateOfPatternId: duplicate?.id,
        updatesLongTermStats: false,
      },
    ];
  }

  return [];
}

function hashNormalizedContent(content: string): string {
  return createHash('sha256').update(normalizeWritingContent(content)).digest('hex');
}

function normalizePatternKey(category: string, rule: string): string {
  return `${category}:${rule
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')}`;
}

function tokenize(text: string): Set<string> {
  return new Set(text.toLowerCase().match(/[a-z]{3,}/g) ?? []);
}

function tokenOverlap(left: Set<string>, right: Set<string>): number {
  let count = 0;
  left.forEach((token) => {
    if (right.has(token)) {
      count += 1;
    }
  });
  return count;
}
