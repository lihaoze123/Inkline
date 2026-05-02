CREATE TABLE `rewrite_checks` (
  `id` text PRIMARY KEY NOT NULL,
  `rewrite_task_id` text NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `outcome` text,
  `feedback` text,
  `provider` text,
  `model` text,
  `validation_errors_json` text,
  `error_message` text,
  `diagnostics_json` text,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `completed_at` integer,
  FOREIGN KEY (`rewrite_task_id`) REFERENCES `rewrite_tasks`(`id`) ON UPDATE no action ON DELETE cascade,
  CHECK (`status` IN ('pending', 'in_progress', 'completed', 'failed', 'retryable')),
  CHECK (`outcome` IS NULL OR `outcome` IN ('correct', 'partly_correct', 'incorrect')),
  CHECK ((`status` = 'completed' AND `outcome` IS NOT NULL) OR (`status` <> 'completed' AND `outcome` IS NULL))
);
--> statement-breakpoint
CREATE INDEX `rewrite_checks_task_created_at_idx` ON `rewrite_checks` (`rewrite_task_id`, `created_at`);
