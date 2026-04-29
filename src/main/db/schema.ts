import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const journals = sqliteTable('journals', {
  id: text('id').primaryKey(),
  content: text('content').notNull().default(''),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
    .$onUpdate(() => new Date()),
});

export const reviewRuns = sqliteTable('review_runs', {
  id: text('id').primaryKey(),
  journalId: text('journal_id')
    .notNull()
    .references(() => journals.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  rawOutputJson: text('raw_output_json'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const corrections = sqliteTable('corrections', {
  id: text('id').primaryKey(),
  reviewRunId: text('review_run_id')
    .notNull()
    .references(() => reviewRuns.id, { onDelete: 'cascade' }),
  originalText: text('original_text').notNull(),
  correctedText: text('corrected_text').notNull(),
  explanation: text('explanation').notNull(),
  startOffset: integer('start_offset').notNull(),
  endOffset: integer('end_offset').notNull(),
});

export const rewriteTasks = sqliteTable('rewrite_tasks', {
  id: text('id').primaryKey(),
  reviewRunId: text('review_run_id')
    .notNull()
    .references(() => reviewRuns.id, { onDelete: 'cascade' }),
  prompt: text('prompt').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export type Journal = typeof journals.$inferSelect;
export type InsertJournal = typeof journals.$inferInsert;
export type ReviewRun = typeof reviewRuns.$inferSelect;
export type InsertReviewRun = typeof reviewRuns.$inferInsert;
