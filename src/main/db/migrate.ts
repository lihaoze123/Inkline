import { app } from 'electron';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { db } from './client';

export type MigrationResult =
  | { success: true }
  | { success: false; reason: 'missing-folder' | 'error'; error?: string };

export function runMigrations(): MigrationResult {
  const migrationsFolder = app.isPackaged
    ? path.join(process.resourcesPath, 'drizzle')
    : path.resolve(process.cwd(), 'drizzle');

  if (!existsSync(migrationsFolder)) {
    return { success: false, reason: 'missing-folder' };
  }

  try {
    migrate(db, { migrationsFolder });
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown migration error';
    return { success: false, reason: 'error', error: message };
  }
}
