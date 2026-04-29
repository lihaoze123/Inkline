ALTER TABLE `rewrite_tasks` ADD `native_model_sentence` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `rewrite_tasks` ADD `spaced_stage` text DEFAULT 'D+1' NOT NULL;
--> statement-breakpoint
ALTER TABLE `rewrite_tasks` ADD `user_rewrite_text` text;
--> statement-breakpoint
ALTER TABLE `rewrite_tasks` ADD `completed_at` integer;
--> statement-breakpoint
ALTER TABLE `rewrite_tasks` ADD `skipped_at` integer;
