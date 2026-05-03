import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const electronMockState = vi.hoisted(() => ({
  userDataPath: '',
}));

const sqliteMockState = vi.hoisted(() => ({
  openedPath: '',
  parentExistedOnOpen: false,
  pragmas: [] as string[],
}));

type DatabaseClientModule = {
  getDatabasePath(): string;
  sqlite: {
    close(): void;
  };
};

vi.mock('electron', () => ({
  app: {
    getPath(name: string): string {
      if (name !== 'userData') {
        throw new Error(`Unexpected Electron path lookup: ${name}`);
      }

      return electronMockState.userDataPath;
    },
  },
}));

vi.mock('better-sqlite3', async () => {
  const fs = await import('node:fs');
  const nodePath = await import('node:path');

  function MockDatabase(databasePath: string): object {
    sqliteMockState.openedPath = databasePath;
    sqliteMockState.parentExistedOnOpen = fs.existsSync(nodePath.dirname(databasePath));

    if (!sqliteMockState.parentExistedOnOpen) {
      throw new Error('SQLite parent directory did not exist before open');
    }

    return {
      close(): void {},
      pragma(pragma: string): void {
        sqliteMockState.pragmas.push(pragma);
      },
    };
  }

  return {
    default: vi.fn(MockDatabase),
  };
});

vi.mock('drizzle-orm/better-sqlite3', () => ({
  drizzle(): object {
    return {};
  },
}));

describe('database client startup', () => {
  let tempRoot: string | null = null;
  let dbClient: DatabaseClientModule | null = null;

  beforeEach(() => {
    vi.resetModules();
    electronMockState.userDataPath = '';
    sqliteMockState.openedPath = '';
    sqliteMockState.parentExistedOnOpen = false;
    sqliteMockState.pragmas = [];
    tempRoot = mkdtempSync(path.join(tmpdir(), 'Inkline-db-'));
  });

  afterEach(() => {
    if (dbClient !== null) {
      dbClient.sqlite.close();
      dbClient = null;
    }

    if (tempRoot !== null) {
      rmSync(tempRoot, { recursive: true, force: true });
      tempRoot = null;
    }
  });

  it('creates the missing userData directory before opening SQLite', async () => {
    if (tempRoot === null) {
      throw new Error('Expected tempRoot to be initialized');
    }

    const userDataPath = path.join(tempRoot, 'missing-user-data');
    electronMockState.userDataPath = userDataPath;

    expect(existsSync(userDataPath)).toBe(false);

    dbClient = await import('../src/main/db/client');

    expect(dbClient.getDatabasePath()).toBe(path.join(userDataPath, 'Inkline.sqlite'));
    expect(sqliteMockState.openedPath).toBe(path.join(userDataPath, 'Inkline.sqlite'));
    expect(sqliteMockState.parentExistedOnOpen).toBe(true);
    expect(existsSync(userDataPath)).toBe(true);
    expect(sqliteMockState.pragmas).toEqual(['journal_mode = WAL', 'foreign_keys = ON']);
  });
});
