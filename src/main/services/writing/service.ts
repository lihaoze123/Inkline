import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  writingAttempts,
  writingRevisions,
  reviewRuns,
  rewriteChecks,
  rewriteTasks,
  type WritingAttempt,
  type WritingRevision,
  type ReviewRun,
  type rewriteChecks as rewriteChecksTable,
  type rewriteTasks as rewriteTasksTable,
} from '../../db/schema';
import { computeWritingContentHash, getLocalDateKey, normalizeWritingContent } from '../../../shared/writing/content';
import { getWritingTemplate } from '../../../shared/writing/templates';
import {
  completeRewritePracticeInputSchema,
  generateStarterPromptInputSchema,
  type GenerateStarterPromptInput,
  type GenerateStarterPromptResult,
  type GetWritingAttemptInput,
  skipRewritePracticeInputSchema,
  type CompleteRewritePracticeInput,
  type RewriteCheckSnapshot,
  type RewritePracticeSnapshot,
  type RewritePracticeUpdateResult,
  retryRewriteCheckInputSchema,
  type RetryRewriteCheckInput,
  type RetryRewriteCheckResult,
  type SaveWritingAttemptInput,
  type SaveWritingAttemptResult,
  type StarterPromptSnapshot,
  type SkipRewritePracticeInput,
  type WritingAttemptSnapshot,
} from '../../../shared/types/writing';
import { generateStructuredObject } from '../ai';
import { buildAiRuntimeConfigForFeature } from '../ai/runtime-config';

const starterPromptGenerationSchema = z.object({
  prompt: z.string().trim().min(1),
});

type StarterPromptGeneration = z.infer<typeof starterPromptGenerationSchema>;

function createId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

function toMillis(date: Date | null): number | null {
  return date ? date.getTime() : null;
}

function revisionToSnapshot(revision: WritingRevision): WritingAttemptSnapshot['activeRevision'] {
  return {
    id: revision.id,
    writingAttemptId: revision.writingAttemptId,
    content: revision.content,
    contentHash: revision.contentHash,
    createdAt: revision.createdAt.getTime(),
  };
}

type RewriteTaskRow = typeof rewriteTasksTable.$inferSelect;
type RewriteCheckRow = typeof rewriteChecksTable.$inferSelect;

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const REWRITE_PRACTICE_MAX_AGE_MS = 7 * ONE_DAY_MS;
const STARTER_PROMPT_DISCLOSURE_KEY = 'writing-practice-starter-prompt-disclosure-acknowledged';
const STARTER_PROMPT_TIMEOUT_MS = 45_000;

type StarterPromptDisclosureStore = {
  get: (key: string) => boolean | undefined;
  set: (key: string, value: boolean) => void;
};

let starterPromptDisclosureStore: StarterPromptDisclosureStore | null = null;

async function getStarterPromptDisclosureStore(): Promise<StarterPromptDisclosureStore> {
  if (!starterPromptDisclosureStore) {
    const Store = (await import('electron-store')).default;
    starterPromptDisclosureStore = new Store<{ [STARTER_PROMPT_DISCLOSURE_KEY]: boolean }>({
      name: 'starter-prompt-disclosure',
      defaults: { [STARTER_PROMPT_DISCLOSURE_KEY]: false },
    });
  }

  return starterPromptDisclosureStore;
}

export async function hasStarterPromptDisclosureAcknowledgement(): Promise<boolean> {
  const store = await getStarterPromptDisclosureStore();
  return store.get(STARTER_PROMPT_DISCLOSURE_KEY) === true;
}

export async function acknowledgeStarterPromptDisclosure(): Promise<boolean> {
  const store = await getStarterPromptDisclosureStore();
  store.set(STARTER_PROMPT_DISCLOSURE_KEY, true);
  return true;
}

function parseStarterPrompt(value: string | null): StarterPromptSnapshot | null {
  if (!value) {
    return null;
  }

  const parsed = JSON.parse(value) as unknown;
  if (typeof parsed !== 'object' || parsed === null || !('text' in parsed) || !('generatedAt' in parsed)) {
    return null;
  }

  const candidate = parsed as { text: unknown; generatedAt: unknown };
  if (typeof candidate.text !== 'string' || typeof candidate.generatedAt !== 'number') {
    return null;
  }

  return { text: candidate.text, generatedAt: candidate.generatedAt };
}

function staleReviewToSnapshot(reviewRun: ReviewRun | undefined): WritingAttemptSnapshot['staleReview'] {
  if (!reviewRun) {
    return null;
  }

  return {
    id: reviewRun.id,
    reviewedContentHash: reviewRun.contentHash,
    createdAt: reviewRun.createdAt.getTime(),
  };
}

function parseStringArrayJson(value: string | null): string[] | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) && parsed.every((entry) => typeof entry === 'string') ? parsed : null;
  } catch {
    return null;
  }
}

function parseDiagnosticsJson(value: string | null): Record<string, unknown> | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function getLatestRewriteCheck(rewriteTaskId: string): RewriteCheckRow | null {
  return (
    db
      .select()
      .from(rewriteChecks)
      .where(eq(rewriteChecks.rewriteTaskId, rewriteTaskId))
      .orderBy(desc(rewriteChecks.createdAt), desc(rewriteChecks.updatedAt))
      .get() ?? null
  );
}

function rewriteCheckToSnapshot(check: RewriteCheckRow): RewriteCheckSnapshot {
  return {
    id: check.id,
    rewriteTaskId: check.rewriteTaskId,
    status: check.status,
    outcome: check.outcome,
    feedback: check.feedback ? { message: check.feedback } : null,
    provider: check.provider,
    model: check.model,
    validationErrors: parseStringArrayJson(check.validationErrorsJson),
    errorMessage: check.errorMessage,
    diagnostics: parseDiagnosticsJson(check.diagnosticsJson),
    createdAt: check.createdAt.getTime(),
    updatedAt: check.updatedAt.getTime(),
    completedAt: toMillis(check.completedAt),
  };
}

function rewriteTaskToSnapshot(task: RewriteTaskRow, nowMillis = Date.now()): RewritePracticeSnapshot {
  const latestRewriteCheck = getLatestRewriteCheck(task.id);

  return {
    id: task.id,
    reviewRunId: task.reviewRunId,
    originalSentence: task.originalSentence,
    focusPattern: task.focusPattern,
    nativeModelSentence: task.nativeModelSentence,
    prompt: task.prompt,
    practiceKind: 'rewrite_original',
    spacedStage: 'D+1',
    status: task.status,
    userRewriteText: task.userRewriteText,
    latestRewriteCheck: latestRewriteCheck ? rewriteCheckToSnapshot(latestRewriteCheck) : null,
    dueAt: toMillis(task.dueAt),
    createdAt: task.createdAt.getTime(),
    isOlderThanSevenDays: nowMillis - task.createdAt.getTime() > REWRITE_PRACTICE_MAX_AGE_MS,
  };
}

function getActiveRevision(entry: WritingAttempt): WritingRevision | null {
  if (!entry.activeRevisionId) {
    return null;
  }

  return db.select().from(writingRevisions).where(eq(writingRevisions.id, entry.activeRevisionId)).get() ?? null;
}

function getMostRecentStaleReview(attemptId: string): ReviewRun | undefined {
  return db
    .select()
    .from(reviewRuns)
    .where(eq(reviewRuns.writingAttemptId, attemptId))
    .orderBy(desc(reviewRuns.updatedAt), desc(reviewRuns.createdAt))
    .all()
    .find((reviewRun) => reviewRun.status === 'stale');
}

function getPendingRewritePractice(now = new Date()): RewriteTaskRow | null {
  const cutoff = new Date(now.getTime() - REWRITE_PRACTICE_MAX_AGE_MS);

  return (
    db
      .select()
      .from(rewriteTasks)
      .where(
        and(
          eq(rewriteTasks.status, 'pending'),
          eq(rewriteTasks.kind, 'rewrite_original'),
          lte(rewriteTasks.dueAt, now),
          gte(rewriteTasks.createdAt, cutoff),
        ),
      )
      .orderBy(desc(rewriteTasks.dueAt), desc(rewriteTasks.createdAt))
      .all()
      .find((task) => task.spacedStage === 'D+1') ?? null
  );
}

function buildSnapshot(entry: WritingAttempt): WritingAttemptSnapshot {
  const activeRevision = getActiveRevision(entry);
  const staleReview = getMostRecentStaleReview(entry.id);
  const pendingRewritePractice = getPendingRewritePractice();

  return {
    attemptId: entry.id,
    dateKey: entry.dateKey,
    templateId: entry.templateId,
    template: getWritingTemplate(entry.templateId),
    generatedPrompt: parseStarterPrompt(entry.generatedPromptJson),
    userGoal: entry.userGoal,
    activeRevision: activeRevision ? revisionToSnapshot(activeRevision) : null,
    lastAutosaveAt: toMillis(activeRevision?.createdAt ?? null),
    lastReviewRunId: entry.lastReviewRunId,
    staleReview: staleReviewToSnapshot(staleReview),
    pendingRewritePractice: pendingRewritePractice ? rewriteTaskToSnapshot(pendingRewritePractice) : null,
  };
}

function getOrCreateWritingAttempt(templateId: GetWritingAttemptInput['templateId'] = 'journal'): WritingAttempt {
  const dateKey = getLocalDateKey();
  const existing = db
    .select()
    .from(writingAttempts)
    .where(eq(writingAttempts.dateKey, dateKey))
    .all()
    .find((entry) => entry.templateId === templateId);

  if (existing) {
    return existing;
  }

  return db
    .insert(writingAttempts)
    .values({
      id: createId('writing'),
      dateKey,
      templateId,
    })
    .returning()
    .get();
}

export function getWritingAttempt(input: GetWritingAttemptInput = { templateId: 'journal' }): WritingAttemptSnapshot {
  const entry = getOrCreateWritingAttempt(input.templateId);
  return buildSnapshot(entry);
}

export function getDueRewritePracticeForPractice(now = new Date()): RewritePracticeSnapshot | null {
  const practice = getPendingRewritePractice(now);
  return practice ? rewriteTaskToSnapshot(practice, now.getTime()) : null;
}

function buildStarterPromptSystemPrompt(): string {
  return 'You design English writing practice starter prompts for Chinese native speakers. Return only JSON matching the requested shape. Do not write the essay for the user.';
}

function buildStarterPromptUserPrompt(template: WritingAttemptSnapshot['template'], userGoal: string | null): string {
  return `Create one starter prompt/topic for an AI-assisted writing practice app.

Template: ${template.title}
Description: ${template.description}
Starter behavior: ${template.starterPromptBehavior}
Review focus later: ${template.reviewFocus}
Scenario context: ${template.scenarioContext ?? 'none'}
User-provided goal/topic: ${userGoal ?? 'none'}

Rules:
- Return JSON only: { "prompt": "..." }
- The prompt/topic itself should be in English.
- For CET-4 or CET-6, include a short Chinese helper note after the English topic if useful.
- Do not include word-count targets, timers, scores, or mock-exam instructions.
- Do not draft the essay or provide an outline that replaces independent writing.
- Keep it concise enough to fit above a writing editor.`;
}

export async function generateStarterPrompt(input: GenerateStarterPromptInput): Promise<GenerateStarterPromptResult> {
  const parseResult = generateStarterPromptInputSchema.safeParse(input);
  if (!parseResult.success) {
    return { success: false, error: parseResult.error.issues[0].message };
  }

  if (!(await hasStarterPromptDisclosureAcknowledgement())) {
    return {
      success: false,
      disclosureRequired: true,
      error: 'Provider disclosure acknowledgement is required before generating a starter prompt.',
    };
  }

  const template = getWritingTemplate(parseResult.data.templateId);
  const userGoal = parseResult.data.userGoal?.trim() || null;

  try {
    const runtimeConfig = await buildAiRuntimeConfigForFeature('starterPrompt');
    const generation = await generateStructuredObject<StarterPromptGeneration>({
      runtimeConfig,
      systemPrompt: buildStarterPromptSystemPrompt(),
      userPrompt: buildStarterPromptUserPrompt(template, userGoal),
      schema: starterPromptGenerationSchema,
      schemaName: 'starter_prompt',
      schemaDescription: 'A concise English writing practice starter prompt.',
      temperature: 0.7,
      maxOutputTokens: 500,
      timeoutMs: STARTER_PROMPT_TIMEOUT_MS,
      maxRetries: 0,
    });
    const starterPrompt: StarterPromptSnapshot = {
      text: generation.output.prompt,
      generatedAt: Date.now(),
    };

    const entry = getOrCreateWritingAttempt(parseResult.data.templateId);
    const updatedEntry = db
      .update(writingAttempts)
      .set({
        generatedPromptJson: JSON.stringify(starterPrompt),
        userGoal,
      })
      .where(eq(writingAttempts.id, entry.id))
      .returning()
      .get();

    return { success: true, writing: buildSnapshot(updatedEntry), starterPrompt };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Starter prompt generation failed.';
    return { success: false, error: message };
  }
}

export function saveWritingAttempt(input: SaveWritingAttemptInput): SaveWritingAttemptResult {
  const normalizedContent = normalizeWritingContent(input.content);
  const contentHash = computeWritingContentHash(normalizedContent);
  const entry = getOrCreateWritingAttempt(input.templateId);
  const activeRevision = getActiveRevision(entry);

  const trimmedUserGoal = input.userGoal?.trim() ?? entry.userGoal ?? null;
  const normalizedUserGoal = trimmedUserGoal && trimmedUserGoal.length > 0 ? trimmedUserGoal : null;

  if (entry.userGoal !== normalizedUserGoal) {
    db.update(writingAttempts).set({ userGoal: normalizedUserGoal }).where(eq(writingAttempts.id, entry.id)).run();
  }

  if (activeRevision?.contentHash === contentHash) {
    const currentEntry = db.select().from(writingAttempts).where(eq(writingAttempts.id, entry.id)).get() ?? entry;
    return { ...buildSnapshot(currentEntry), saved: false };
  }

  const updatedEntry = db.transaction((tx) => {
    const revision = tx
      .insert(writingRevisions)
      .values({
        id: createId('revision'),
        writingAttemptId: entry.id,
        content: normalizedContent,
        contentHash,
      })
      .returning()
      .get();

    tx.update(writingAttempts)
      .set({ activeRevisionId: revision.id, userGoal: normalizedUserGoal })
      .where(eq(writingAttempts.id, entry.id))
      .run();

    if (entry.lastReviewRunId) {
      const lastReviewRun = tx.select().from(reviewRuns).where(eq(reviewRuns.id, entry.lastReviewRunId)).get();

      if (lastReviewRun?.status === 'review_saved' && lastReviewRun.contentHash !== contentHash) {
        tx.update(reviewRuns).set({ status: 'stale' }).where(eq(reviewRuns.id, lastReviewRun.id)).run();
        tx.update(writingAttempts)
          .set({ lastReviewRunId: null, reviewedAt: null })
          .where(eq(writingAttempts.id, entry.id))
          .run();
      }
    }

    const savedEntry = tx.select().from(writingAttempts).where(eq(writingAttempts.id, entry.id)).get();

    if (!savedEntry) {
      throw new Error('Unable to load saved writing attempt.');
    }

    return savedEntry;
  });

  return { ...buildSnapshot(updatedEntry), saved: true };
}

export function completeRewritePractice(input: CompleteRewritePracticeInput): RewritePracticeUpdateResult {
  const parseResult = completeRewritePracticeInputSchema.safeParse(input);
  if (!parseResult.success) {
    return { success: false, error: parseResult.error.issues[0].message };
  }

  const task = db.select().from(rewriteTasks).where(eq(rewriteTasks.id, parseResult.data.rewriteTaskId)).get();
  if (!task) {
    return { success: false, error: 'Rewrite practice was not found.' };
  }

  const reviewRun = db.select().from(reviewRuns).where(eq(reviewRuns.id, task.reviewRunId)).get();
  const entry = reviewRun
    ? db.select().from(writingAttempts).where(eq(writingAttempts.id, reviewRun.writingAttemptId)).get()
    : undefined;
  const currentWriting = entry ? buildSnapshot(entry) : getWritingAttempt();

  if (task.status !== 'pending' && task.status !== 'in_progress') {
    return { success: true, writing: currentWriting, rewritePractice: rewriteTaskToSnapshot(task) };
  }

  const updatedTask = db
    .update(rewriteTasks)
    .set({
      status: 'completed',
      userRewriteText: parseResult.data.userRewriteText.trim(),
      completedAt: new Date(),
    })
    .where(eq(rewriteTasks.id, parseResult.data.rewriteTaskId))
    .returning()
    .get();

  const updatedWriting = entry ? buildSnapshot(entry) : getWritingAttempt();
  return { success: true, writing: updatedWriting, rewritePractice: rewriteTaskToSnapshot(updatedTask) };
}

export function retryRewriteCheck(input: RetryRewriteCheckInput): RetryRewriteCheckResult {
  const parseResult = retryRewriteCheckInputSchema.safeParse(input);
  if (!parseResult.success) {
    return { success: false, error: parseResult.error.issues[0].message };
  }

  return {
    success: false,
    error: 'Rewrite-check retry is not implemented yet.',
  };
}

export function skipRewritePractice(input: SkipRewritePracticeInput): RewritePracticeUpdateResult {
  const parseResult = skipRewritePracticeInputSchema.safeParse(input);
  if (!parseResult.success) {
    return { success: false, error: parseResult.error.issues[0].message };
  }

  const task = db.select().from(rewriteTasks).where(eq(rewriteTasks.id, parseResult.data.rewriteTaskId)).get();
  if (!task) {
    return { success: false, error: 'Rewrite practice was not found.' };
  }

  const reviewRun = db.select().from(reviewRuns).where(eq(reviewRuns.id, task.reviewRunId)).get();
  const entry = reviewRun
    ? db.select().from(writingAttempts).where(eq(writingAttempts.id, reviewRun.writingAttemptId)).get()
    : undefined;
  const currentWriting = entry ? buildSnapshot(entry) : getWritingAttempt();

  if (task.status !== 'pending' && task.status !== 'in_progress') {
    return { success: true, writing: currentWriting, rewritePractice: rewriteTaskToSnapshot(task) };
  }

  const updatedTask = db
    .update(rewriteTasks)
    .set({
      status: 'skipped',
      skippedAt: new Date(),
    })
    .where(eq(rewriteTasks.id, parseResult.data.rewriteTaskId))
    .returning()
    .get();

  const updatedWriting = entry ? buildSnapshot(entry) : getWritingAttempt();
  return { success: true, writing: updatedWriting, rewritePractice: rewriteTaskToSnapshot(updatedTask) };
}
