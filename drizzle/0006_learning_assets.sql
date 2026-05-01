CREATE TABLE `error_patterns` (
  `id` text PRIMARY KEY NOT NULL,
  `pattern_key` text NOT NULL,
  `category` text NOT NULL,
  `rule` text NOT NULL,
  `canonical_example` text NOT NULL,
  `count` integer DEFAULT 0 NOT NULL,
  `first_seen_date_key` text NOT NULL,
  `last_seen_date_key` text NOT NULL,
  `recent_examples_json` text DEFAULT '[]' NOT NULL,
  `active` integer DEFAULT true NOT NULL,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `error_patterns_pattern_key_unique` ON `error_patterns` (`pattern_key`);
--> statement-breakpoint
CREATE TABLE `notebook_entries` (
  `id` text PRIMARY KEY NOT NULL,
  `review_run_id` text NOT NULL,
  `date_key` text NOT NULL,
  `template_id` text NOT NULL,
  `source_text` text NOT NULL,
  `suggested_alternatives_json` text NOT NULL,
  `reason` text,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`review_run_id`) REFERENCES `review_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `corrections` ADD `pattern_id` text REFERENCES `error_patterns`(`id`) ON DELETE set null;
