-- Development-stage reset after broadening journal into writing practice templates.
-- Existing local data may use the old journal_* schema and is intentionally discarded pre-production.
DROP TABLE IF EXISTS `rewrite_tasks`;
--> statement-breakpoint
DROP TABLE IF EXISTS `reference_rewrites`;
--> statement-breakpoint
DROP TABLE IF EXISTS `self_repair_attempts`;
--> statement-breakpoint
DROP TABLE IF EXISTS `corrections`;
--> statement-breakpoint
DROP TABLE IF EXISTS `review_runs`;
--> statement-breakpoint
DROP TABLE IF EXISTS `writing_revisions`;
--> statement-breakpoint
DROP TABLE IF EXISTS `writing_attempts`;
--> statement-breakpoint
DROP TABLE IF EXISTS `journal_revisions`;
--> statement-breakpoint
DROP TABLE IF EXISTS `journal_entries`;
--> statement-breakpoint
CREATE TABLE `writing_attempts` (
  `id` text PRIMARY KEY NOT NULL,
  `date_key` text NOT NULL,
  `template_id` text DEFAULT 'journal' NOT NULL,
  `generated_prompt_json` text,
  `user_goal` text,
  `active_revision_id` text,
  `last_review_run_id` text,
  `reviewed_at` integer,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `writing_attempts_date_template_unique` ON `writing_attempts` (`date_key`, `template_id`);
--> statement-breakpoint
CREATE TABLE `writing_revisions` (
  `id` text PRIMARY KEY NOT NULL,
  `writing_attempt_id` text NOT NULL,
  `content` text NOT NULL,
  `content_hash` text NOT NULL,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`writing_attempt_id`) REFERENCES `writing_attempts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `review_runs` (
  `id` text PRIMARY KEY NOT NULL,
  `writing_attempt_id` text NOT NULL,
  `writing_revision_id` text,
  `content_hash` text NOT NULL,
  `status` text DEFAULT 'draft' NOT NULL,
  `validation_status` text,
  `provider` text NOT NULL,
  `model` text NOT NULL,
  `input_snapshot_json` text,
  `raw_output_json` text,
  `parsed_output_json` text,
  `preview_operations_json` text,
  `validation_errors_json` text,
  `summary_json` text,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`writing_attempt_id`) REFERENCES `writing_attempts`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`writing_revision_id`) REFERENCES `writing_revisions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `corrections` (
  `id` text PRIMARY KEY NOT NULL,
  `review_run_id` text NOT NULL,
  `pattern` text DEFAULT '' NOT NULL,
  `original_text` text NOT NULL,
  `corrected_text` text NOT NULL,
  `explanation` text NOT NULL,
  `category` text DEFAULT 'fix' NOT NULL,
  `status` text DEFAULT 'suggested' NOT NULL,
  `start_offset` integer NOT NULL,
  `end_offset` integer NOT NULL,
  FOREIGN KEY (`review_run_id`) REFERENCES `review_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `self_repair_attempts` (
  `id` text PRIMARY KEY NOT NULL,
  `review_run_id` text NOT NULL,
  `correction_id` text,
  `attempt_text` text DEFAULT '' NOT NULL,
  `result` text NOT NULL,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`review_run_id`) REFERENCES `review_runs`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`correction_id`) REFERENCES `corrections`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `reference_rewrites` (
  `id` text PRIMARY KEY NOT NULL,
  `review_run_id` text NOT NULL,
  `rewrite_text` text NOT NULL,
  `notice_the_gap` text DEFAULT '' NOT NULL,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`review_run_id`) REFERENCES `review_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `rewrite_tasks` (
  `id` text PRIMARY KEY NOT NULL,
  `review_run_id` text NOT NULL,
  `original_sentence` text DEFAULT '' NOT NULL,
  `focus_pattern` text DEFAULT '' NOT NULL,
  `native_model_sentence` text DEFAULT '' NOT NULL,
  `prompt` text NOT NULL,
  `kind` text DEFAULT 'rewrite_original' NOT NULL,
  `spaced_stage` text DEFAULT 'D+1' NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `user_rewrite_text` text,
  `due_at` integer,
  `completed_at` integer,
  `skipped_at` integer,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`review_run_id`) REFERENCES `review_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
