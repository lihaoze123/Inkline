import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { ProviderOptions } from '@ai-sdk/provider-utils';
import { db } from '../../../db/client';
import { writingAttempts, writingRevisions, reviewRuns } from '../../../db/schema';
import { getWritingTemplate } from '../../../../shared/writing/templates';
import {
  validateReviewResult,
  type PreviewOperations,
  type ReviewValidationResult,
} from '../../../../shared/review-contract';
import {
  reviewProgressEventSchema,
  reviewRunSummarySchema,
  type ReviewErrorCategory,
  type ReviewProgressEvent,
  type ReviewProgressPhase,
  type ReviewRunResultKind,
  type ReviewRunSummary,
} from '../../../../shared/types/review';
import {
  aiProviderDiagnosticsSchema,
  safeAiProviderDiagnosticErrorMessage,
  sanitizeAiProviderDiagnosticText,
  type AiProviderDiagnostics,
  type AiProviderFailureKind,
} from '../../../../shared/types/ai';
import { getSettingsSnapshot, type ReviewSettingsSnapshot } from '../../settings/service';
import { hasReviewDisclosureAcknowledgement } from '../lib/disclosure';
import { buildReviewInput } from '../lib/input';
import { getAiProviderDiagnosticsFromError } from '../../ai';
import { getProviderSettingsForFeature } from '../../ai/runtime-config';
import { buildProviderReasoningOptions } from '../../ai/reasoning-options';
import { callOpenAiCompatibleReviewAgent } from '../lib/openai-compatible-agent';
import { buildReviewPersistenceDecision } from '../lib/persistence-decision';
import { buildReviewUserPrompt, REVIEW_SYSTEM_PROMPT } from '../lib/prompt';
import { reviewRunToSnapshot } from '../lib/snapshots';
import { startReviewInputSchema, type ReviewAgent, type StartReviewInput, type StartReviewOutput } from '../types';

type StartReviewOptions = {
  agent?: ReviewAgent;
  hasDisclosureAcknowledgement?: () => boolean;
  settings?: ReviewSettingsSnapshot;
  onProgress?: (event: ReviewProgressEvent) => void;
};

type PhaseTimingState = {
  currentPhase: ReviewProgressPhase | null;
  phaseStartedAt: number | null;
  startedAt: number;
  timings: Record<ReviewProgressPhase, number | null>;
};

function createId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

function createPhaseTimingState(startedAt: number): PhaseTimingState {
  return {
    currentPhase: null,
    phaseStartedAt: null,
    startedAt,
    timings: {
      preparing: null,
      requesting: null,
      waiting: null,
      checking: null,
      building_preview: null,
    },
  };
}

function beginPhase(
  runId: string,
  timingState: PhaseTimingState,
  phase: ReviewProgressPhase,
  onProgress: StartReviewOptions['onProgress'],
): void {
  const at = Date.now();
  timingState.currentPhase = phase;
  timingState.phaseStartedAt = at;
  emitProgress(onProgress, {
    runId,
    phase,
    event: 'started',
    at,
    elapsedMs: at - timingState.startedAt,
  });
}

function completeCurrentPhase(
  runId: string,
  timingState: PhaseTimingState,
  onProgress: StartReviewOptions['onProgress'],
): void {
  const phase = timingState.currentPhase;
  const phaseStartedAt = timingState.phaseStartedAt;
  if (!phase || phaseStartedAt === null) {
    return;
  }

  const at = Date.now();
  timingState.timings[phase] = at - phaseStartedAt;
  emitProgress(onProgress, {
    runId,
    phase,
    event: 'completed',
    at,
    elapsedMs: at - timingState.startedAt,
  });
  timingState.currentPhase = null;
  timingState.phaseStartedAt = null;
}

function failCurrentPhase(
  runId: string,
  timingState: PhaseTimingState,
  onProgress: StartReviewOptions['onProgress'],
  errorCategory: ReviewErrorCategory,
): void {
  const phase = timingState.currentPhase;
  const phaseStartedAt = timingState.phaseStartedAt;
  if (!phase || phaseStartedAt === null) {
    return;
  }

  const at = Date.now();
  timingState.timings[phase] = at - phaseStartedAt;
  emitProgress(onProgress, {
    runId,
    phase,
    event: 'failed',
    at,
    elapsedMs: at - timingState.startedAt,
    errorCategory,
  });
  timingState.currentPhase = null;
  timingState.phaseStartedAt = null;
}

function emitProgress(onProgress: StartReviewOptions['onProgress'], event: ReviewProgressEvent): void {
  onProgress?.(reviewProgressEventSchema.parse(event));
}

export async function startReview(
  input: StartReviewInput,
  options: StartReviewOptions = {},
): Promise<StartReviewOutput> {
  const parseResult = startReviewInputSchema.safeParse(input);
  if (!parseResult.success) {
    return { success: false, error: parseResult.error.issues[0].message };
  }

  const hasDisclosureAcknowledgement = options.hasDisclosureAcknowledgement ?? hasReviewDisclosureAcknowledgement;
  if (!hasDisclosureAcknowledgement()) {
    return {
      success: false,
      disclosureRequired: true,
      error: 'Provider disclosure acknowledgement is required before review.',
    };
  }

  const revision = db
    .select()
    .from(writingRevisions)
    .where(eq(writingRevisions.id, parseResult.data.writingRevisionId))
    .get();
  if (!revision || revision.writingAttemptId !== parseResult.data.writingAttemptId) {
    return { success: false, error: 'Current writing revision was not found.' };
  }

  const entry = db
    .select()
    .from(writingAttempts)
    .where(eq(writingAttempts.id, parseResult.data.writingAttemptId))
    .get();
  if (!entry || entry.activeRevisionId !== revision.id) {
    return { success: false, error: 'Review requires the current active writing revision.' };
  }

  const reviewRunId = createId('review');
  const startedAt = Date.now();
  const timingState = createPhaseTimingState(startedAt);
  beginPhase(reviewRunId, timingState, 'preparing', options.onProgress);

  const settings = options.settings ?? (await getSettingsSnapshot());
  const reviewProviderMetadata = getReviewProviderMetadata(settings);
  const generatedPrompt = entry.generatedPromptJson
    ? (JSON.parse(entry.generatedPromptJson) as { text?: unknown }).text
    : null;
  const template = getWritingTemplate(entry.templateId);
  const reviewInput = buildReviewInput({
    writingContent: revision.content,
    contentHash: revision.contentHash,
    date: entry.dateKey,
    writingTemplate: {
      id: template.id,
      title: template.title,
      reviewFocus: template.reviewFocus,
      scenarioContext: template.scenarioContext,
      trackGuidance: template.trackGuidance,
    },
    generatedPrompt: typeof generatedPrompt === 'string' ? generatedPrompt : null,
    userGoal: entry.userGoal,
  });

  const reviewingRun = db
    .insert(reviewRuns)
    .values({
      id: reviewRunId,
      writingAttemptId: entry.id,
      writingRevisionId: revision.id,
      contentHash: revision.contentHash,
      status: 'reviewing',
      provider: reviewProviderMetadata.provider,
      model: reviewProviderMetadata.model,
      inputSnapshotJson: JSON.stringify(reviewInput),
      validationErrorsJson: JSON.stringify([]),
    })
    .returning()
    .get();

  try {
    completeCurrentPhase(reviewRunId, timingState, options.onProgress);
    beginPhase(reviewRunId, timingState, 'requesting', options.onProgress);
    const agent = options.agent ?? callOpenAiCompatibleReviewAgent;
    const agentRequest = {
      systemPrompt: REVIEW_SYSTEM_PROMPT,
      userPrompt: buildReviewUserPrompt(reviewInput),
      input: reviewInput,
      providerOptions: buildReviewProviderOptions(settings),
    };
    completeCurrentPhase(reviewRunId, timingState, options.onProgress);

    beginPhase(reviewRunId, timingState, 'waiting', options.onProgress);
    const agentResponse = await agent(agentRequest);
    const providerDiagnostics = sanitizeProviderDiagnosticsForSummary(agentResponse.providerDiagnostics ?? null);
    completeCurrentPhase(reviewRunId, timingState, options.onProgress);

    beginPhase(reviewRunId, timingState, 'checking', options.onProgress);
    const validation = validateReviewResult(reviewInput, agentResponse.output);
    const persistenceDecision = buildReviewPersistenceDecision({
      validation,
      rawOutput: agentResponse.rawOutput,
      rawResponseStorageEnabled: settings.rawResponseStorageEnabled,
    });

    if (persistenceDecision.status === 'review_failed') {
      failCurrentPhase(reviewRunId, timingState, options.onProgress, 'validation_failed');
      const summary = buildReviewRunSummary({
        timingState,
        validation,
        resultKind: 'failed',
        errorCategory: 'validation_failed',
        providerStatus: null,
        providerDiagnostics: addFailureKindToProviderDiagnostics(providerDiagnostics, 'validation_failed'),
        rawSaved: Boolean(persistenceDecision.rawOutputJson),
      });
      const failedRun = db
        .update(reviewRuns)
        .set({
          status: persistenceDecision.status,
          validationStatus: persistenceDecision.validationStatus,
          validationErrorsJson: persistenceDecision.validationErrorsJson,
          rawOutputJson: persistenceDecision.rawOutputJson,
          parsedOutputJson: null,
          previewOperationsJson: null,
          summaryJson: JSON.stringify(summary),
        })
        .where(eq(reviewRuns.id, reviewingRun.id))
        .returning()
        .get();

      return {
        success: false,
        reviewRun: reviewRunToSnapshot(failedRun),
        error: 'Review output did not pass validation.',
      };
    }

    completeCurrentPhase(reviewRunId, timingState, options.onProgress);
    beginPhase(reviewRunId, timingState, 'building_preview', options.onProgress);
    const currentEntryForCompletion = db.select().from(writingAttempts).where(eq(writingAttempts.id, entry.id)).get();
    const isStaleAtCompletion = currentEntryForCompletion?.activeRevisionId !== revision.id;
    const resultKind = isStaleAtCompletion
      ? 'stale'
      : persistenceDecision.validationStatus === 'valid_with_warnings'
        ? 'ready_with_warnings'
        : 'ready';
    completeCurrentPhase(reviewRunId, timingState, options.onProgress);
    const summary = buildReviewRunSummary({
      timingState,
      validation,
      resultKind,
      errorCategory: isStaleAtCompletion ? 'stale_content' : null,
      providerStatus: null,
      providerDiagnostics,
      rawSaved: Boolean(persistenceDecision.rawOutputJson),
    });

    const finalRun = db
      .update(reviewRuns)
      .set({
        status: persistenceDecision.status,
        validationStatus: persistenceDecision.validationStatus,
        validationErrorsJson: persistenceDecision.validationErrorsJson,
        rawOutputJson: persistenceDecision.rawOutputJson,
        parsedOutputJson: JSON.stringify(persistenceDecision.validation.parsedOutput),
        previewOperationsJson: JSON.stringify(persistenceDecision.validation.operations),
        summaryJson: JSON.stringify(summary),
      })
      .where(eq(reviewRuns.id, reviewingRun.id))
      .returning()
      .get();

    return {
      success: true,
      reviewRun: reviewRunToSnapshot(finalRun),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Review failed.';
    const existingProviderDiagnostics = getAiProviderDiagnosticsFromError(error);
    const errorCategory = classifyReviewError(message, existingProviderDiagnostics?.failureKind ?? null);
    const providerStatus = providerStatusFromError(message);
    const providerDiagnostics = buildProviderDiagnosticsForError(error, errorCategory, existingProviderDiagnostics);
    const recoverableMessage = errorCategory === 'missing_config' ? message : userFacingErrorFor(errorCategory);
    const persistedErrorMessage =
      errorCategory === 'missing_config' ? sanitizeAiProviderDiagnosticText(message) : recoverableMessage;
    failCurrentPhase(reviewRunId, timingState, options.onProgress, errorCategory);
    const summary = buildReviewRunSummary({
      timingState,
      validation: null,
      resultKind: 'failed',
      errorCategory,
      providerStatus,
      providerDiagnostics,
      rawSaved: false,
    });
    const failedRun = db
      .update(reviewRuns)
      .set({
        status: 'review_failed',
        validationStatus: 'invalid',
        validationErrorsJson: JSON.stringify([persistedErrorMessage]),
        summaryJson: JSON.stringify(summary),
      })
      .where(eq(reviewRuns.id, reviewingRun.id))
      .returning()
      .get();

    return { success: false, reviewRun: reviewRunToSnapshot(failedRun), error: recoverableMessage };
  }
}

function getReviewProviderMetadata(
  settings: ReviewSettingsSnapshot,
): Pick<ReviewSettingsSnapshot, 'provider' | 'model'> {
  const providerSettings = getProviderSettingsForFeature(settings, 'review');
  return {
    provider: providerSettings.provider,
    model: providerSettings.model,
  };
}

function buildReviewProviderOptions(settings: ReviewSettingsSnapshot): ProviderOptions | undefined {
  const providerSettings = getProviderSettingsForFeature(settings, 'review');
  return buildProviderReasoningOptions({
    providerId: providerSettings.providerId,
    model: providerSettings.model,
    thinkingEnabled: settings.reviewThinkingEnabled,
    baseUrl: providerSettings.providerId === 'openai-compatible' ? providerSettings.baseUrl : undefined,
  });
}

function buildReviewRunSummary(params: {
  timingState: PhaseTimingState;
  validation: ReviewValidationResult | null;
  resultKind: ReviewRunResultKind;
  errorCategory: ReviewErrorCategory | null;
  providerStatus: string | null;
  providerDiagnostics: AiProviderDiagnostics | null;
  rawSaved: boolean;
}): ReviewRunSummary {
  const completedAt = Date.now();
  const summary = {
    startedAt: params.timingState.startedAt,
    completedAt,
    durationMs: completedAt - params.timingState.startedAt,
    phaseTimings: params.timingState.timings,
    resultKind: params.resultKind,
    errorCategory: params.errorCategory,
    providerStatus: params.providerStatus,
    providerDiagnostics: params.providerDiagnostics,
    reviewStats: statsFromOperations(params.validation?.operations ?? null),
    warningCount: params.validation?.issues.filter((issue) => issue.severity === 'warning').length ?? 0,
    rawSaved: params.rawSaved,
  };

  return reviewRunSummarySchema.parse(summary);
}

function statsFromOperations(operations: PreviewOperations | null): ReviewRunSummary['reviewStats'] {
  if (!operations) {
    return {
      anchoredCorrections: 0,
      lowConfidenceCorrections: 0,
      generatedRewriteTasks: 0,
      generatedSelfRepairAttempts: 0,
      generatedReferenceRewrites: 0,
    };
  }

  return {
    anchoredCorrections: operations.corrections.filter((correction) => correction.status !== 'low_confidence').length,
    lowConfidenceCorrections: operations.corrections.filter((correction) => correction.status === 'low_confidence')
      .length,
    generatedRewriteTasks: operations.rewritePractice.length,
    generatedSelfRepairAttempts: operations.selfRepair ? 1 : 0,
    generatedReferenceRewrites: operations.referenceRewrites.length,
  };
}

function buildProviderDiagnosticsForError(
  error: unknown,
  errorCategory: ReviewErrorCategory,
  existingDiagnostics: AiProviderDiagnostics | null,
): AiProviderDiagnostics {
  const message = error instanceof Error ? error.message : 'Review failed.';
  const errorName = error instanceof Error ? error.name : null;
  const failureKind = existingDiagnostics?.failureKind ?? failureKindFromErrorCategory(errorCategory);
  const sanitized = sanitizeProviderDiagnosticsForSummary({
    finishReason: existingDiagnostics?.finishReason ?? null,
    rawFinishReason: existingDiagnostics?.rawFinishReason ?? null,
    usage: existingDiagnostics?.usage ?? null,
    warningCount: existingDiagnostics?.warningCount ?? 0,
    warnings: existingDiagnostics?.warnings ?? [],
    responseId: existingDiagnostics?.responseId ?? null,
    responseModelId: existingDiagnostics?.responseModelId ?? null,
    providerMetadataKeys: existingDiagnostics?.providerMetadataKeys ?? [],
    reasoningEnabled: existingDiagnostics?.reasoningEnabled ?? null,
    reasoningEffort: existingDiagnostics?.reasoningEffort ?? null,
    reasoningRequestedEffort: existingDiagnostics?.reasoningRequestedEffort ?? null,
    reasoningEffectiveEffort: existingDiagnostics?.reasoningEffectiveEffort ?? null,
    reasoningFallbackUsed: existingDiagnostics?.reasoningFallbackUsed ?? false,
    reasoningFallbackReason: existingDiagnostics?.reasoningFallbackReason ?? null,
    errorName: existingDiagnostics?.errorName ?? errorName,
    errorMessage: existingDiagnostics?.errorMessage ?? message,
    failureKind,
  });
  if (!sanitized) {
    throw new Error('Provider diagnostics could not be built.');
  }
  return sanitized;
}

function addFailureKindToProviderDiagnostics(
  diagnostics: AiProviderDiagnostics | null,
  failureKind: AiProviderFailureKind,
): AiProviderDiagnostics | null {
  return sanitizeProviderDiagnosticsForSummary(diagnostics, failureKind);
}

function classifyReviewError(
  message: string,
  providerFailureKind: AiProviderFailureKind | null = null,
): ReviewErrorCategory {
  if (providerFailureKind === 'missing_config') {
    return 'missing_config';
  }

  if (providerFailureKind === 'timeout') {
    return 'timeout';
  }

  if (providerFailureKind === 'invalid_json') {
    return 'invalid_json';
  }

  if (providerFailureKind === 'validation_failed') {
    return 'validation_failed';
  }

  const normalizedMessage = message.toLowerCase();
  if (
    normalizedMessage.includes('provider api key') ||
    normalizedMessage.includes('api key is not configured') ||
    normalizedMessage.includes('api key is unavailable') ||
    normalizedMessage.includes('base url') ||
    normalizedMessage.includes('model') ||
    normalizedMessage.includes('keychain')
  ) {
    return 'missing_config';
  }

  if (normalizedMessage.includes('timed out')) {
    return 'timeout';
  }

  if (message.includes('invalid JSON') || message.includes('Provider JSON')) {
    return 'invalid_json';
  }

  return 'provider_error';
}

function failureKindFromErrorCategory(errorCategory: ReviewErrorCategory): AiProviderFailureKind | null {
  switch (errorCategory) {
    case 'missing_config':
      return 'missing_config';
    case 'timeout':
      return 'timeout';
    case 'invalid_json':
      return 'invalid_json';
    case 'validation_failed':
      return 'validation_failed';
    case 'provider_error':
      return 'provider_error';
    case 'stale_content':
      return null;
  }
}

function sanitizeProviderDiagnosticsForSummary(
  diagnostics: AiProviderDiagnostics | null,
  failureKindOverride?: AiProviderFailureKind,
): AiProviderDiagnostics | null {
  if (!diagnostics) {
    return null;
  }

  const failureKind = failureKindOverride ?? diagnostics.failureKind;
  return aiProviderDiagnosticsSchema.parse({
    ...diagnostics,
    failureKind,
    warnings: diagnostics.warnings
      .map((warning) => sanitizeProviderWarningForSummary(warning))
      .filter((warning) => warning.length > 0),
    errorMessage: diagnostics.errorMessage
      ? safeAiProviderDiagnosticErrorMessage({ failureKind, message: diagnostics.errorMessage })
      : null,
  });
}

function sanitizeProviderWarningForSummary(warning: string): string {
  const sanitized = sanitizeAiProviderDiagnosticText(warning);
  if (sanitized.startsWith('Provider rejected reasoningEffort none;')) {
    return sanitized;
  }

  const typePrefix = sanitized.split(':')[0]?.trim();
  if (typePrefix && /^[A-Za-z0-9_-]+$/.test(typePrefix)) {
    return typePrefix;
  }

  return 'Provider warning.';
}

function providerStatusFromError(message: string): string | null {
  const statusMatch = message.match(/\((\d{3})\)/);
  return statusMatch?.[1] ?? null;
}

function userFacingErrorFor(errorCategory: ReviewErrorCategory): string {
  switch (errorCategory) {
    case 'timeout':
      return 'AI service took too long. Try again in a moment.';
    case 'invalid_json':
      return 'AI response could not be used. Try again or change the model in Settings.';
    case 'provider_error':
      return 'AI service connection failed. Try again or check Settings.';
    case 'validation_failed':
      return 'AI suggestions could not be used reliably. Try again.';
    case 'stale_content':
      return 'This review is based on an earlier version of your writing.';
    case 'missing_config':
      return 'Review needs provider settings before it can run.';
  }
}
