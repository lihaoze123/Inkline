CREATE TABLE `journal_entries` (
  `id` text PRIMARY KEY NOT NULL,
  `date_key` text NOT NULL,
  `active_revision_id` text,
  `last_review_run_id` text,
  `reviewed_at` integer,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `journal_entries_date_key_unique` ON `journal_entries` (`date_key`);
--> statement-breakpoint
CREATE TABLE `journal_revisions` (
  `id` text PRIMARY KEY NOT NULL,
  `journal_entry_id` text NOT NULL,
  `content` text NOT NULL,
  `content_hash` text NOT NULL,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`journal_entry_id`) REFERENCES `journal_entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `review_runs` (
  `id` text PRIMARY KEY NOT NULL,
  `journal_entry_id` text NOT NULL,
  `journal_revision_id` text,
  `content_hash` text NOT NULL,
  `status` text DEFAULT 'draft' NOT NULL,
  `validation_status` text,
  `provider` text NOT NULL,
  `model` text NOT NULL,
  `input_snapshot_json` text,
  `raw_output_json` text,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`journal_entry_id`) REFERENCES `journal_entries`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`journal_revision_id`) REFERENCES `journal_revisions`(`id`) ON UPDATE no action ON DELETE set null
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
  `prompt` text NOT NULL,
  `kind` text DEFAULT 'rewrite_original' NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `due_at` integer,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`review_run_id`) REFERENCES `review_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
