import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../../../db/client';
import { journalEntries, journalRevisions, reviewRuns, type ReviewRun } from '../../../db/schema';
import { validateReviewResult } from '../../../../shared/review-contract';
import { reviewRunSnapshotSchema, type ReviewRunSnapshot } from '../../../../shared/types/review';
import { getSettingsSnapshot, type ReviewSettingsSnapshot } from '../../settings/service';
import { hasReviewDisclosureAcknowledgement } from '../lib/disclosure';
import { buildReviewInput } from '../lib/input';
import { callOpenAiCompatibleReviewAgent } from '../lib/openai-compatible-agent';
import { buildReviewPersistenceDecision } from '../lib/persistence-decision';
import { buildReviewUserPrompt, REVIEW_SYSTEM_PROMPT } from '../lib/prompt';
import { startReviewInputSchema, type ReviewAgent, type StartReviewInput, type StartReviewOutput } from '../types';

type StartReviewOptions = {
  agent?: ReviewAgent;
  hasDisclosureAcknowledgement?: () => boolean;
  settings?: ReviewSettingsSnapshot;
};

function createId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

function reviewRunToSnapshot(reviewRun: ReviewRun): ReviewRunSnapshot {
  return reviewRunSnapshotSchema.parse({
    id: reviewRun.id,
    journalEntryId: reviewRun.journalEntryId,
    journalRevisionId: reviewRun.journalRevisionId,
    contentHash: reviewRun.contentHash,
    status: reviewRun.status,
    validationStatus: reviewRun.validationStatus,
    provider: reviewRun.provider,
    model: reviewRun.model,
    validationErrors: parseValidationErrors(reviewRun.validationErrorsJson),
    createdAt: reviewRun.createdAt.getTime(),
    updatedAt: reviewRun.updatedAt.getTime(),
  });
}

export async function startReview(input: StartReviewInput, options: StartReviewOptions = {}): Promise<StartReviewOutput> {
  const parseResult = startReviewInputSchema.safeParse(input);
  if (!parseResult.success) {
    return { success: false, error: parseResult.error.issues[0].message };
  }

  const hasDisclosureAcknowledgement = options.hasDisclosureAcknowledgement ?? hasReviewDisclosureAcknowledgement;
  if (!hasDisclosureAcknowledgement()) {
    return { success: false, disclosureRequired: true, error: 'Provider disclosure acknowledgement is required before review.' };
  }

  const revision = db.select().from(journalRevisions).where(eq(journalRevisions.id, parseResult.data.journalRevisionId)).get();
  if (!revision || revision.journalEntryId !== parseResult.data.journalEntryId) {
    return { success: false, error: 'Current journal revision was not found.' };
  }

  const entry = db.select().from(journalEntries).where(eq(journalEntries.id, parseResult.data.journalEntryId)).get();
  if (!entry || entry.activeRevisionId !== revision.id) {
    return { success: false, error: 'Review requires the current active journal revision.' };
  }

  const settings = options.settings ?? (await getSettingsSnapshot());
  const reviewInput = buildReviewInput({ journalContent: revision.content, contentHash: revision.contentHash, date: entry.dateKey });
  const reviewRunId = createId('review');

  const reviewingRun = db
    .insert(reviewRuns)
    .values({
      id: reviewRunId,
      journalEntryId: entry.id,
      journalRevisionId: revision.id,
      contentHash: revision.contentHash,
      status: 'reviewing',
      provider: settings.provider,
      model: settings.model,
      inputSnapshotJson: JSON.stringify(reviewInput),
      validationErrorsJson: JSON.stringify([]),
    })
    .returning()
    .get();

  try {
    const agent = options.agent ?? callOpenAiCompatibleReviewAgent;
    const agentResponse = await agent({
      systemPrompt: REVIEW_SYSTEM_PROMPT,
      userPrompt: buildReviewUserPrompt(reviewInput),
      input: reviewInput,
    });
    const persistenceDecision = buildReviewPersistenceDecision({
      validation: validateReviewResult(reviewInput, agentResponse.output),
      rawOutput: agentResponse.rawOutput,
      rawResponseStorageEnabled: settings.rawResponseStorageEnabled,
    });

    const finalRun = db
      .update(reviewRuns)
      .set({
        status: persistenceDecision.status,
        validationStatus: persistenceDecision.validationStatus,
        validationErrorsJson: persistenceDecision.validationErrorsJson,
        rawOutputJson: persistenceDecision.rawOutputJson,
        parsedOutputJson: persistenceDecision.status === 'review_ready' ? JSON.stringify(persistenceDecision.validation.parsedOutput) : null,
        previewOperationsJson: persistenceDecision.status === 'review_ready' ? JSON.stringify(persistenceDecision.validation.operations) : null,
      })
      .where(eq(reviewRuns.id, reviewingRun.id))
      .returning()
      .get();

    return {
      success: persistenceDecision.status === 'review_ready',
      reviewRun: reviewRunToSnapshot(finalRun),
      error: persistenceDecision.status === 'review_failed' ? 'Review output did not pass validation.' : undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Review failed.';
    const recoverableMessage = message.includes('provider API key') || message.includes('base URL') || message.includes('model') || message.includes('keychain')
      ? message
      : 'Review failed.';
    const failedRun = db
      .update(reviewRuns)
      .set({
        status: 'review_failed',
        validationStatus: 'invalid',
        validationErrorsJson: JSON.stringify([message]),
      })
      .where(eq(reviewRuns.id, reviewingRun.id))
      .returning()
      .get();

    return { success: false, reviewRun: reviewRunToSnapshot(failedRun), error: recoverableMessage };
  }
}

function parseValidationErrors(value: string | null): string[] {
  if (!value) {
    return [];
  }

  const parsed = JSON.parse(value) as unknown;
  return Array.isArray(parsed) && parsed.every((item) => typeof item === 'string') ? parsed : [];
}
