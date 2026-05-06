import { describe, expect, it, vi } from 'vitest';
import { learningEvents } from '../src/main/db/schema';
import type { learningEvents as learningEventsTable } from '../src/main/db/schema';
import type { db as appDatabase } from '../src/main/db/client';
import {
  learningEventSnapshotSchema,
  learningEventTypeSchema,
  listLearningEventsOutputSchema,
} from '../src/shared/types/learning-assets';

vi.mock('../src/main/db/client', () => ({
  db: {},
  getDatabasePath: () => ':memory:',
  sqlite: {},
}));

type AppDatabase = typeof appDatabase;
type LearningEventRow = typeof learningEventsTable.$inferSelect;

const baseDate = new Date('2026-05-06T09:00:00.000Z');

class FakeLearningEventDatabase {
  private rows: LearningEventRow[] = [];

  asAppDatabase(): AppDatabase {
    return this as unknown as AppDatabase;
  }

  select(): {
    from: (table: unknown) => {
      where: (condition: unknown) => { get: () => LearningEventRow | undefined; all: () => LearningEventRow[] };
      orderBy: () => { limit: (limit: number) => { all: () => LearningEventRow[] } };
    };
  } {
    return {
      from: (table: unknown) => {
        if (table !== learningEvents) {
          throw new Error('Unknown table');
        }

        return {
          where: (condition: unknown) => {
            const dedupeKey = firstStringInCondition(condition);
            const rows = this.rows.filter((row) => row.dedupeKey === dedupeKey);
            return {
              get: () => rows[0],
              all: () => [...rows],
            };
          },
          orderBy: () => ({
            limit: (limit: number) => ({
              all: () =>
                [...this.rows]
                  .sort(
                    (left, right) =>
                      right.occurredAt.getTime() - left.occurredAt.getTime() ||
                      right.createdAt.getTime() - left.createdAt.getTime(),
                  )
                  .slice(0, limit),
            }),
          }),
        };
      },
    };
  }

  insert(table: unknown): {
    values: (value: unknown) => { returning: () => { get: () => LearningEventRow }; run: () => void };
  } {
    if (table !== learningEvents) {
      throw new Error('Unknown table');
    }

    return {
      values: (value) => {
        const row = {
          ...(value as Record<string, unknown>),
          createdAt: baseDate,
        } as LearningEventRow;
        this.rows.push(row);
        return {
          returning: () => ({ get: () => row }),
          run: () => undefined,
        };
      },
    };
  }

  seed(row: LearningEventRow): void {
    this.rows.push(row);
  }

  allRows(): LearningEventRow[] {
    return [...this.rows];
  }
}

describe('learning event contracts', () => {
  it('defines the learning event vocabulary without mastery claims', () => {
    expect(learningEventTypeSchema.options).toEqual([
      'review_saved',
      'rewrite_task_created',
      'rewrite_submitted',
      'rewrite_check_recorded',
      'rewrite_retry_requested',
      'rewrite_skipped',
      'rewrite_snoozed',
      'rewrite_expired',
      'pattern_merged',
      'correction_applied',
    ]);
  });

  it('parses event snapshots with numeric timestamps and payload objects', () => {
    const parsed = learningEventSnapshotSchema.parse({
      id: 'learning_event_1',
      eventType: 'rewrite_check_recorded',
      occurredAt: baseDate.getTime(),
      dedupeKey: 'rewrite_check_recorded:rewrite_check_1',
      reviewRunId: 'review_1',
      patternId: 'pattern_1',
      rewriteTaskId: 'rewrite_1',
      rewriteCheckId: 'rewrite_check_1',
      payload: { checkStatus: 'completed', outcome: 'correct' },
      createdAt: baseDate.getTime(),
    });

    expect(parsed.payload).toMatchObject({ checkStatus: 'completed', outcome: 'correct' });
    expect(listLearningEventsOutputSchema.parse([parsed])).toHaveLength(1);
  });

  it('dedupes append helper calls and lists recent events newest first', async () => {
    const database = new FakeLearningEventDatabase();
    const { appendLearningEvent, listLearningEvents } = await import('../src/main/services/learning-assets/service');

    const older = appendLearningEvent(
      {
        eventType: 'review_saved',
        occurredAt: new Date(baseDate.getTime() - 1_000),
        dedupeKey: 'review_saved:review_1:review_saved',
        reviewRunId: 'review_1',
        payload: { finalStatus: 'review_saved' },
      },
      database.asAppDatabase(),
    );
    const duplicate = appendLearningEvent(
      {
        eventType: 'review_saved',
        occurredAt: baseDate,
        dedupeKey: 'review_saved:review_1:review_saved',
        reviewRunId: 'review_1',
        payload: { finalStatus: 'review_saved' },
      },
      database.asAppDatabase(),
    );
    database.seed({
      id: 'learning_event_latest',
      eventType: 'rewrite_snoozed',
      occurredAt: new Date(baseDate.getTime() + 1_000),
      dedupeKey: 'rewrite_snoozed:rewrite_1:1777410000000',
      reviewRunId: 'review_1',
      patternId: null,
      rewriteTaskId: 'rewrite_1',
      rewriteCheckId: null,
      payloadJson: JSON.stringify({ dueAt: baseDate.getTime() + 86_400_000 }),
      createdAt: baseDate,
    });

    const events = listLearningEvents(database.asAppDatabase());

    expect(older?.eventType).toBe('review_saved');
    expect(duplicate).toBeNull();
    expect(database.allRows()).toHaveLength(2);
    expect(events.map((event) => event.id)).toEqual(['learning_event_latest', older?.id]);
    expect(events[0]?.payload).toMatchObject({ dueAt: baseDate.getTime() + 86_400_000 });
  });
});

function firstStringInCondition(condition: unknown): string | undefined {
  const values: string[] = [];
  collectStringValues(condition, values);
  return values[0];
}

function collectStringValues(value: unknown, values: string[]): void {
  if (typeof value === 'string') {
    values.push(value);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectStringValues(item, values));
    return;
  }

  if (typeof value !== 'object' || value === null) {
    return;
  }

  if (value.constructor?.name === 'Param' && 'value' in value) {
    collectStringValues((value as { value: unknown }).value, values);
    return;
  }

  if ('queryChunks' in value) {
    collectStringValues((value as { queryChunks: unknown }).queryChunks, values);
  }
}
