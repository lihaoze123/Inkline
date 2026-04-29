CREATE TABLE `journals` (
  `id` text PRIMARY KEY NOT NULL,
  `content` text DEFAULT '' NOT NULL,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `review_runs` (
  `id` text PRIMARY KEY NOT NULL,
  `journal_id` text NOT NULL,
  `provider` text NOT NULL,
  `model` text NOT NULL,
  `raw_output_json` text,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`journal_id`) REFERENCES `journals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `corrections` (
  `id` text PRIMARY KEY NOT NULL,
  `review_run_id` text NOT NULL,
  `original_text` text NOT NULL,
  `corrected_text` text NOT NULL,
  `explanation` text NOT NULL,
  `start_offset` integer NOT NULL,
  `end_offset` integer NOT NULL,
  FOREIGN KEY (`review_run_id`) REFERENCES `review_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `rewrite_tasks` (
  `id` text PRIMARY KEY NOT NULL,
  `review_run_id` text NOT NULL,
  `prompt` text NOT NULL,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`review_run_id`) REFERENCES `review_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
