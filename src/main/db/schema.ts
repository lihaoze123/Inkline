import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const writingAttempts = sqliteTable(
  'writing_attempts',
  {
    id: text('id').primaryKey(),
    dateKey: text('date_key').notNull(),
    templateId: text('template_id', { enum: ['journal', 'cet4', 'cet6', 'free'] })
      .notNull()
      .default('journal'),
    generatedPromptJson: text('generated_prompt_json'),
    userGoal: text('user_goal'),
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
  (table) => [uniqueIndex('writing_attempts_date_template_unique').on(table.dateKey, table.templateId)],
);

export const writingRevisions = sqliteTable('writing_revisions', {
  id: text('id').primaryKey(),
  writingAttemptId: text('writing_attempt_id')
    .notNull()
    .references(() => writingAttempts.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  contentHash: text('content_hash').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const reviewRuns = sqliteTable('review_runs', {
  id: text('id').primaryKey(),
  writingAttemptId: text('writing_attempt_id')
    .notNull()
    .references(() => writingAttempts.id, { onDelete: 'cascade' }),
  writingRevisionId: text('writing_revision_id').references(() => writingRevisions.id, { onDelete: 'set null' }),
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
  summaryJson: text('summary_json'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
    .$onUpdate(() => new Date()),
});

export const errorPatterns = sqliteTable(
  'error_patterns',
  {
    id: text('id').primaryKey(),
    patternKey: text('pattern_key').notNull(),
    category: text('category', {
      enum: ['tense', 'agreement', 'article', 'collocation', 'word_order', 'chinglish', 'wordiness', 'spelling'],
    }).notNull(),
    rule: text('rule').notNull(),
    canonicalExample: text('canonical_example').notNull(),
    count: integer('count').notNull().default(0),
    firstSeenDateKey: text('first_seen_date_key').notNull(),
    lastSeenDateKey: text('last_seen_date_key').notNull(),
    recentExamplesJson: text('recent_examples_json').notNull().default('[]'),
    fingerprintJson: text('fingerprint_json'),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`)
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex('error_patterns_pattern_key_unique').on(table.patternKey)],
);

export const corrections = sqliteTable('corrections', {
  id: text('id').primaryKey(),
  reviewRunId: text('review_run_id')
    .notNull()
    .references(() => reviewRuns.id, { onDelete: 'cascade' }),
  patternId: text('pattern_id').references(() => errorPatterns.id, { onDelete: 'set null' }),
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

export const notebookEntries = sqliteTable('notebook_entries', {
  id: text('id').primaryKey(),
  reviewRunId: text('review_run_id')
    .notNull()
    .references(() => reviewRuns.id, { onDelete: 'cascade' }),
  dateKey: text('date_key').notNull(),
  templateId: text('template_id', { enum: ['journal', 'cet4', 'cet6', 'free'] }).notNull(),
  sourceText: text('source_text').notNull(),
  suggestedAlternativesJson: text('suggested_alternatives_json').notNull(),
  reason: text('reason'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
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
  nativeModelSentence: text('native_model_sentence').notNull().default(''),
  prompt: text('prompt').notNull(),
  promptContractJson: text('prompt_contract_json'),
  kind: text('kind', { enum: ['rewrite_original', 'new_context_reuse', 'pattern_detection'] })
    .notNull()
    .default('rewrite_original'),
  spacedStage: text('spaced_stage').notNull().default('D+1'),
  status: text('status', { enum: ['pending', 'in_progress', 'completed', 'skipped', 'snoozed', 'expired'] })
    .notNull()
    .default('pending'),
  userRewriteText: text('user_rewrite_text'),
  dueAt: integer('due_at', { mode: 'timestamp_ms' }),
  completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
  skippedAt: integer('skipped_at', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const rewriteChecks = sqliteTable('rewrite_checks', {
  id: text('id').primaryKey(),
  rewriteTaskId: text('rewrite_task_id')
    .notNull()
    .references(() => rewriteTasks.id, { onDelete: 'cascade' }),
  status: text('status', { enum: ['pending', 'in_progress', 'completed', 'failed', 'retryable'] })
    .notNull()
    .default('pending'),
  outcome: text('outcome', { enum: ['correct', 'partly_correct', 'incorrect'] }),
  feedback: text('feedback'),
  provider: text('provider'),
  model: text('model'),
  validationErrorsJson: text('validation_errors_json'),
  errorMessage: text('error_message'),
  diagnosticsJson: text('diagnostics_json'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
    .$onUpdate(() => new Date()),
  completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
});

export type WritingAttempt = typeof writingAttempts.$inferSelect;
export type InsertWritingAttempt = typeof writingAttempts.$inferInsert;
export type WritingRevision = typeof writingRevisions.$inferSelect;
export type InsertWritingRevision = typeof writingRevisions.$inferInsert;
export type ReviewRun = typeof reviewRuns.$inferSelect;
export type InsertReviewRun = typeof reviewRuns.$inferInsert;
export type RewriteCheck = typeof rewriteChecks.$inferSelect;
export type InsertRewriteCheck = typeof rewriteChecks.$inferInsert;
