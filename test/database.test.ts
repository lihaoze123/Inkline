import { readFileSync } from 'node:fs';
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

describe('database foundation migration', () => {
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
});
