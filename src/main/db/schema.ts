import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const journalEntries = sqliteTable(
  'journal_entries',
  {
    id: text('id').primaryKey(),
    dateKey: text('date_key').notNull(),
    activeRevisionId: text('active_revision_id'),
    lastReviewRunId: text('last_review_run_id'),
    reviewedAt: integer('reviewed_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`)
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex('journal_entries_date_key_unique').on(table.dateKey)]
);

export const journalRevisions = sqliteTable('journal_revisions', {
  id: text('id').primaryKey(),
  journalEntryId: text('journal_entry_id')
    .notNull()
    .references(() => journalEntries.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  contentHash: text('content_hash').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const reviewRuns = sqliteTable('review_runs', {
  id: text('id').primaryKey(),
  journalEntryId: text('journal_entry_id')
    .notNull()
    .references(() => journalEntries.id, { onDelete: 'cascade' }),
  journalRevisionId: text('journal_revision_id').references(() => journalRevisions.id, { onDelete: 'set null' }),
  contentHash: text('content_hash').notNull(),
  status: text('status', {
    enum: ['draft', 'reviewing', 'review_ready', 'review_saved', 'review_failed', 'stale', 'discarded'],
  })
    .notNull()
    .default('draft'),
  validationStatus: text('validation_status', { enum: ['valid', 'valid_with_warnings', 'invalid'] }),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  inputSnapshotJson: text('input_snapshot_json'),
  rawOutputJson: text('raw_output_json'),
  parsedOutputJson: text('parsed_output_json'),
  previewOperationsJson: text('preview_operations_json'),
  validationErrorsJson: text('validation_errors_json'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
    .$onUpdate(() => new Date()),
});

export const corrections = sqliteTable('corrections', {
  id: text('id').primaryKey(),
  reviewRunId: text('review_run_id')
    .notNull()
    .references(() => reviewRuns.id, { onDelete: 'cascade' }),
  pattern: text('pattern').notNull().default(''),
  originalText: text('original_text').notNull(),
  correctedText: text('corrected_text').notNull(),
  explanation: text('explanation').notNull(),
  category: text('category', { enum: ['fix', 'upgrade', 'model'] })
    .notNull()
    .default('fix'),
  status: text('status', { enum: ['suggested', 'kept', 'dismissed', 'stale', 'low_confidence'] })
    .notNull()
    .default('suggested'),
  startOffset: integer('start_offset').notNull(),
  endOffset: integer('end_offset').notNull(),
});

export const selfRepairAttempts = sqliteTable('self_repair_attempts', {
  id: text('id').primaryKey(),
  reviewRunId: text('review_run_id')
    .notNull()
    .references(() => reviewRuns.id, { onDelete: 'cascade' }),
  correctionId: text('correction_id').references(() => corrections.id, { onDelete: 'set null' }),
  attemptText: text('attempt_text').notNull().default(''),
  result: text('result', {
    enum: ['correct', 'partly_correct', 'incorrect', 'skipped', 'revealed_without_attempt'],
  }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const referenceRewrites = sqliteTable('reference_rewrites', {
  id: text('id').primaryKey(),
  reviewRunId: text('review_run_id')
    .notNull()
    .references(() => reviewRuns.id, { onDelete: 'cascade' }),
  rewriteText: text('rewrite_text').notNull(),
  noticeTheGap: text('notice_the_gap').notNull().default(''),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const rewriteTasks = sqliteTable('rewrite_tasks', {
  id: text('id').primaryKey(),
  reviewRunId: text('review_run_id')
    .notNull()
    .references(() => reviewRuns.id, { onDelete: 'cascade' }),
  originalSentence: text('original_sentence').notNull().default(''),
  focusPattern: text('focus_pattern').notNull().default(''),
  prompt: text('prompt').notNull(),
  kind: text('kind', { enum: ['rewrite_original', 'new_context_reuse', 'pattern_detection'] })
    .notNull()
    .default('rewrite_original'),
  status: text('status', { enum: ['pending', 'in_progress', 'completed', 'skipped', 'snoozed', 'expired'] })
    .notNull()
    .default('pending'),
  dueAt: integer('due_at', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export type JournalEntry = typeof journalEntries.$inferSelect;
export type InsertJournalEntry = typeof journalEntries.$inferInsert;
export type JournalRevision = typeof journalRevisions.$inferSelect;
export type InsertJournalRevision = typeof journalRevisions.$inferInsert;
export type ReviewRun = typeof reviewRuns.$inferSelect;
export type InsertReviewRun = typeof reviewRuns.$inferInsert;
