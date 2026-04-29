import Database from 'better-sqlite3';
import { app } from 'electron';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import path from 'node:path';
import * as schema from './schema';

export function getDatabasePath(): string {
  return path.join(app.getPath('userData'), 'english-coach.sqlite');
}

const sqlite = new Database(getDatabasePath());
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });
export { sqlite };
