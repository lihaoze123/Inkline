CREATE TABLE `learning_events` (
  `id` text PRIMARY KEY NOT NULL,
  `event_type` text NOT NULL,
  `occurred_at` integer NOT NULL,
  `dedupe_key` text,
  `review_run_id` text,
  `pattern_id` text,
  `rewrite_task_id` text,
  `rewrite_check_id` text,
  `payload_json` text DEFAULT '{}' NOT NULL,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`review_run_id`) REFERENCES `review_runs`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`pattern_id`) REFERENCES `error_patterns`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`rewrite_task_id`) REFERENCES `rewrite_tasks`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`rewrite_check_id`) REFERENCES `rewrite_checks`(`id`) ON UPDATE no action ON DELETE set null,
  CHECK (`event_type` IN (
    'review_saved',
    'rewrite_task_created',
    'rewrite_submitted',
    'rewrite_check_recorded',
    'rewrite_retry_requested',
    'rewrite_skipped',
    'rewrite_snoozed',
    'rewrite_expired',
    'pattern_merged'
  ))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `learning_events_dedupe_key_unique` ON `learning_events` (`dedupe_key`);
--> statement-breakpoint
CREATE INDEX `learning_events_occurred_at_idx` ON `learning_events` (`occurred_at`);
