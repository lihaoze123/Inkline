import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const REQUIRED_TABLE_DEFINITIONS = [
  'CREATE TABLE `writing_attempts`',
  'CREATE TABLE `writing_revisions`',
  'CREATE TABLE `review_runs`',
  'CREATE TABLE `corrections`',
  'CREATE TABLE `self_repair_attempts`',
  'CREATE TABLE `reference_rewrites`',
  'CREATE TABLE `rewrite_tasks`',
];

type MigrationJournal = {
  entries: Array<{ tag: string }>;
};

describe('database foundation migration', () => {
  it('registers every SQL migration file in the Drizzle journal', () => {
    const migrationDir = path.resolve(process.cwd(), 'drizzle');
    const journal = JSON.parse(readFileSync(path.join(migrationDir, 'meta/_journal.json'), 'utf8')) as MigrationJournal;
    const registeredTags = new Set(journal.entries.map((entry) => entry.tag));
    const sqlTags = readdirSync(migrationDir)
      .filter((fileName) => fileName.endsWith('.sql'))
      .map((fileName) => fileName.replace(/\.sql$/, ''));

    for (const tag of sqlTags) {
      expect(registeredTags.has(tag)).toBe(true);
    }
  });

  it('defines the v0.1 local SQLite tables and constraints', () => {
    const migrationSql = readFileSync(path.resolve(process.cwd(), 'drizzle/0000_foundation.sql'), 'utf8');

    for (const tableDefinition of REQUIRED_TABLE_DEFINITIONS) {
      expect(migrationSql).toContain(tableDefinition);
    }

    expect(migrationSql).toContain('`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL');
    expect(migrationSql).toContain('`content_hash` text NOT NULL');
    expect(migrationSql).toContain('FOREIGN KEY (`writing_attempt_id`) REFERENCES `writing_attempts`(`id`)');
    expect(migrationSql).toContain('FOREIGN KEY (`review_run_id`) REFERENCES `review_runs`(`id`)');
    expect(migrationSql).not.toContain('api_key');
  });

  it('defines durable rewrite-check attempts linked to rewrite tasks', () => {
    const migrationSql = readFileSync(path.resolve(process.cwd(), 'drizzle/0007_rewrite_checks.sql'), 'utf8');

    expect(migrationSql).toContain('CREATE TABLE `rewrite_checks`');
    expect(migrationSql).toContain('FOREIGN KEY (`rewrite_task_id`) REFERENCES `rewrite_tasks`(`id`)');
    expect(migrationSql).toContain(
      "CHECK (`status` IN ('pending', 'in_progress', 'completed', 'failed', 'retryable'))",
    );
    expect(migrationSql).toContain(
      "CHECK (`outcome` IS NULL OR `outcome` IN ('correct', 'partly_correct', 'incorrect'))",
    );
    expect(migrationSql).toContain('`provider` text');
    expect(migrationSql).toContain('`model` text');
    expect(migrationSql).toContain('`validation_errors_json` text');
    expect(migrationSql).toContain('`error_message` text');
  });

  it('adds nullable fingerprint storage to durable error patterns', () => {
    const migrationSql = readFileSync(path.resolve(process.cwd(), 'drizzle/0008_pattern_fingerprints.sql'), 'utf8');

    expect(migrationSql).toContain('ALTER TABLE `error_patterns` ADD `fingerprint_json` text');
  });

  it('adds hidden prompt-contract storage to rewrite tasks', () => {
    const migrationSql = readFileSync(
      path.resolve(process.cwd(), 'drizzle/0009_rewrite_task_prompt_contract.sql'),
      'utf8',
    );

    expect(migrationSql).toContain('ALTER TABLE `rewrite_tasks` ADD `prompt_contract_json` text');
  });

  it('adds merge traceability storage to durable error patterns', () => {
    const migrationSql = readFileSync(path.resolve(process.cwd(), 'drizzle/0010_pattern_merge.sql'), 'utf8');

    expect(migrationSql).toContain('ALTER TABLE `error_patterns` ADD `merged_into_pattern_id` text');
    expect(migrationSql).toContain('ALTER TABLE `error_patterns` ADD `merged_at` integer');
  });

  it('adds durable learning events with dedupe and parent links', () => {
    const migrationSql = readFileSync(path.resolve(process.cwd(), 'drizzle/0011_learning_events.sql'), 'utf8');

    expect(migrationSql).toContain('CREATE TABLE `learning_events`');
    expect(migrationSql).toContain('`event_type` text NOT NULL');
    expect(migrationSql).toContain('`occurred_at` integer NOT NULL');
    expect(migrationSql).toContain('`dedupe_key` text');
    expect(migrationSql).toContain('`payload_json` text DEFAULT');
    expect(migrationSql).toContain('FOREIGN KEY (`review_run_id`) REFERENCES `review_runs`(`id`)');
    expect(migrationSql).toContain('FOREIGN KEY (`pattern_id`) REFERENCES `error_patterns`(`id`)');
    expect(migrationSql).toContain('FOREIGN KEY (`rewrite_task_id`) REFERENCES `rewrite_tasks`(`id`)');
    expect(migrationSql).toContain('FOREIGN KEY (`rewrite_check_id`) REFERENCES `rewrite_checks`(`id`)');
    expect(migrationSql).toContain('CREATE UNIQUE INDEX `learning_events_dedupe_key_unique`');
    expect(migrationSql).toContain("'rewrite_retry_requested'");
  });
});
