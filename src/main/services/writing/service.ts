import { randomUUID } from 'node:crypto';
import { clearTimeout, setTimeout } from 'node:timers';
import { net } from 'electron';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  writingAttempts,
  writingRevisions,
  reviewRuns,
  rewriteTasks,
  type WritingAttempt,
  type WritingRevision,
  type ReviewRun,
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
  type RewritePracticeSnapshot,
  type RewritePracticeUpdateResult,
  type SaveWritingAttemptInput,
  type SaveWritingAttemptResult,
  type StarterPromptSnapshot,
  type SkipRewritePracticeInput,
  type WritingAttemptSnapshot,
} from '../../../shared/types/writing';

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

function rewriteTaskToSnapshot(task: RewriteTaskRow, nowMillis = Date.now()): RewritePracticeSnapshot {
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

  return db
    .select()
    .from(rewriteTasks)
    .where(and(eq(rewriteTasks.status, 'pending'), eq(rewriteTasks.kind, 'rewrite_original'), lte(rewriteTasks.dueAt, now), gte(rewriteTasks.createdAt, cutoff)))
    .orderBy(desc(rewriteTasks.dueAt), desc(rewriteTasks.createdAt))
    .all()
    .find((task) => task.spacedStage === 'D+1') ?? null;
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

function parseStarterPromptResponse(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null || !('choices' in payload) || !Array.isArray(payload.choices)) {
    throw new Error('Provider response did not include prompt choices.');
  }

  const firstChoice = payload.choices[0] as unknown;
  if (typeof firstChoice !== 'object' || firstChoice === null || !('message' in firstChoice)) {
    throw new Error('Provider response did not include a prompt message.');
  }

  const message = firstChoice.message;
  if (typeof message !== 'object' || message === null || !('content' in message) || typeof message.content !== 'string') {
    throw new Error('Provider response message did not include prompt content.');
  }

  const trimmedContent = message.content.trim();
  const fencedJsonMatch = trimmedContent.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const jsonContent = fencedJsonMatch?.[1] ?? trimmedContent;
  const parsed = JSON.parse(jsonContent) as unknown;
  if (typeof parsed !== 'object' || parsed === null || !('prompt' in parsed) || typeof parsed.prompt !== 'string') {
    throw new Error('Provider prompt response did not match the expected shape.');
  }

  const prompt = parsed.prompt.trim();
  if (!prompt) {
    throw new Error('Provider returned an empty starter prompt.');
  }

  return prompt;
}

export async function generateStarterPrompt(input: GenerateStarterPromptInput): Promise<GenerateStarterPromptResult> {
  const parseResult = generateStarterPromptInputSchema.safeParse(input);
  if (!parseResult.success) {
    return { success: false, error: parseResult.error.issues[0].message };
  }

  if (!(await hasStarterPromptDisclosureAcknowledgement())) {
    return { success: false, disclosureRequired: true, error: 'Provider disclosure acknowledgement is required before generating a starter prompt.' };
  }

  const template = getWritingTemplate(parseResult.data.templateId);
  const userGoal = parseResult.data.userGoal?.trim() || null;
  const [{ getProviderApiKey }, { getSettingsSnapshot }] = await Promise.all([
    import('../credentials/service'),
    import('../settings/service'),
  ]);
  const settings = await getSettingsSnapshot();
  const apiKey = await getProviderApiKey();

  if (!settings.baseUrl || !settings.model) {
    return { success: false, error: 'OpenAI-compatible provider base URL and model are required.' };
  }

  if (!apiKey) {
    return { success: false, error: 'OpenAI-compatible provider API key is not configured. Add it in Settings before generating prompts.' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), STARTER_PROMPT_TIMEOUT_MS);

  try {
    const baseUrl = settings.baseUrl.trim().replace(/\/+$/, '');
    const url = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`;
    const response = await net.fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          { role: 'system', content: buildStarterPromptSystemPrompt() },
          { role: 'user', content: buildStarterPromptUserPrompt(template, userGoal) },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
        max_tokens: 500,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      const detail = errorText.trim().slice(0, 300);
      return { success: false, error: detail ? `Starter prompt request failed (${response.status}): ${detail}` : `Starter prompt request failed (${response.status}).` };
    }

    const starterPrompt: StarterPromptSnapshot = {
      text: parseStarterPromptResponse(await response.json()),
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
    const message = error instanceof Error && error.name === 'AbortError'
      ? 'Starter prompt request timed out.'
      : error instanceof Error
        ? error.message
        : 'Starter prompt generation failed.';
    return { success: false, error: message };
  } finally {
    clearTimeout(timeoutId);
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

    tx.update(writingAttempts).set({ activeRevisionId: revision.id, userGoal: normalizedUserGoal }).where(eq(writingAttempts.id, entry.id)).run();

    if (entry.lastReviewRunId) {
      const lastReviewRun = tx.select().from(reviewRuns).where(eq(reviewRuns.id, entry.lastReviewRunId)).get();

      if (lastReviewRun?.status === 'review_saved' && lastReviewRun.contentHash !== contentHash) {
        tx.update(reviewRuns).set({ status: 'stale' }).where(eq(reviewRuns.id, lastReviewRun.id)).run();
        tx
          .update(writingAttempts)
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
  const entry = reviewRun ? db.select().from(writingAttempts).where(eq(writingAttempts.id, reviewRun.writingAttemptId)).get() : undefined;
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
  const entry = reviewRun ? db.select().from(writingAttempts).where(eq(writingAttempts.id, reviewRun.writingAttemptId)).get() : undefined;
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
