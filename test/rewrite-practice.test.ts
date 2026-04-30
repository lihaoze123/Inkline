import { describe, expect, it } from 'vitest';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const MAX_AGE_MS = 7 * ONE_DAY_MS;

type RewriteStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'snoozed' | 'expired';

type RewritePracticeRecord = {
  id: string;
  originalSentence: string;
  focusPattern: string;
  nativeModelSentence: string;
  practiceKind: 'rewrite_original';
  spacedStage: 'D+1';
  status: RewriteStatus;
  userRewriteText: string | null;
  dueAt: number;
  createdAt: number;
  completedAt: number | null;
  skippedAt: number | null;
};

function createD1RewritePractice(createdAt: number): RewritePracticeRecord {
  return {
    id: 'rewrite_1',
    originalSentence: 'I go home',
    focusPattern: 'Use past tense for completed actions.',
    nativeModelSentence: 'I went home',
    practiceKind: 'rewrite_original',
    spacedStage: 'D+1',
    status: 'pending',
    userRewriteText: null,
    dueAt: createdAt + ONE_DAY_MS,
    createdAt,
    completedAt: null,
    skippedAt: null,
  };
}

function selectPracticeSlot(tasks: RewritePracticeRecord[], now: number): RewritePracticeRecord | null {
  return tasks
    .filter((task) => task.status === 'pending')
    .filter((task) => task.practiceKind === 'rewrite_original' && task.spacedStage === 'D+1')
    .filter((task) => task.dueAt <= now)
    .filter((task) => now - task.createdAt <= MAX_AGE_MS)
    .sort((left, right) => right.dueAt - left.dueAt || right.createdAt - left.createdAt)[0] ?? null;
}

function completePractice(task: RewritePracticeRecord, userRewriteText: string, now: number): RewritePracticeRecord {
  return {
    ...task,
    status: 'completed',
    userRewriteText: userRewriteText.trim(),
    completedAt: now,
  };
}

function skipPractice(task: RewritePracticeRecord, now: number): RewritePracticeRecord {
  return {
    ...task,
    status: 'skipped',
    skippedAt: now,
  };
}

describe('D+1 rewrite practice contract', () => {
  it('creates a pending rewrite_original task due on D+1', () => {
    const createdAt = Date.UTC(2026, 3, 29, 12);
    const task = createD1RewritePractice(createdAt);

    expect(task).toMatchObject({
      status: 'pending',
      practiceKind: 'rewrite_original',
      spacedStage: 'D+1',
      originalSentence: 'I go home',
      focusPattern: 'Use past tense for completed actions.',
    });
    expect(task.dueAt).toBe(createdAt + ONE_DAY_MS);
  });

  it('returns one due pending rewrite practice for the practice slot', () => {
    const createdAt = Date.UTC(2026, 3, 29, 12);
    const notDue = createD1RewritePractice(createdAt + ONE_DAY_MS);
    const due = createD1RewritePractice(createdAt);
    due.id = 'rewrite_due';

    expect(selectPracticeSlot([notDue, due], createdAt + ONE_DAY_MS)).toMatchObject({ id: 'rewrite_due' });
  });

  it('stores user rewrite and marks the task completed', () => {
    const now = Date.UTC(2026, 3, 30, 12);
    const completed = completePractice(createD1RewritePractice(now - ONE_DAY_MS), ' I went home. ', now);

    expect(completed.status).toBe('completed');
    expect(completed.userRewriteText).toBe('I went home.');
    expect(completed.completedAt).toBe(now);
  });

  it('marks the rewrite practice skipped', () => {
    const now = Date.UTC(2026, 3, 30, 12);
    const skipped = skipPractice(createD1RewritePractice(now - ONE_DAY_MS), now);

    expect(skipped.status).toBe('skipped');
    expect(skipped.skippedAt).toBe(now);
  });

  it('de-prioritizes tasks older than 7 days from the practice slot', () => {
    const now = Date.UTC(2026, 4, 8, 12);
    const staleTask = createD1RewritePractice(now - MAX_AGE_MS - 1);
    const freshTask = createD1RewritePractice(now - ONE_DAY_MS);
    freshTask.id = 'fresh_rewrite';

    expect(selectPracticeSlot([staleTask], now)).toBeNull();
    expect(selectPracticeSlot([staleTask, freshTask], now)).toMatchObject({ id: 'fresh_rewrite' });
  });
});
