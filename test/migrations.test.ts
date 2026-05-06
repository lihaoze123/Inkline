import path from 'node:path';
import type * as NodeFs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RUNTIME_IS_PACKAGED_ENV, RUNTIME_RESOURCES_PATH_ENV } from '../src/main/runtime';

const electronMockState = vi.hoisted(() => ({
  isPackaged: false,
}));

const migrationMockState = vi.hoisted(() => ({
  migrationsFolder: '',
  folderExists: true,
}));

vi.mock('electron', () => ({
  app: {
    get isPackaged(): boolean {
      return electronMockState.isPackaged;
    },
  },
}));

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof NodeFs>();

  return {
    ...actual,
    existsSync(): boolean {
      return migrationMockState.folderExists;
    },
  };
});

vi.mock('../src/main/db/client', () => ({
  db: {},
}));

vi.mock('drizzle-orm/better-sqlite3/migrator', () => ({
  migrate(_db: object, options: { migrationsFolder: string }): void {
    migrationMockState.migrationsFolder = options.migrationsFolder;
  },
}));

describe('migration folder resolution', () => {
  const originalPackagedFlag = process.env[RUNTIME_IS_PACKAGED_ENV];
  const originalResourcesPathFlag = process.env[RUNTIME_RESOURCES_PATH_ENV];
  const originalResourcesPathDescriptor = Object.getOwnPropertyDescriptor(process, 'resourcesPath');

  beforeEach(() => {
    vi.resetModules();
    electronMockState.isPackaged = false;
    migrationMockState.migrationsFolder = '';
    migrationMockState.folderExists = true;
    delete process.env[RUNTIME_IS_PACKAGED_ENV];
    delete process.env[RUNTIME_RESOURCES_PATH_ENV];
    Object.defineProperty(process, 'resourcesPath', {
      configurable: true,
      value: '/nix/store/inkline/resources',
    });
  });

  afterEach(() => {
    if (originalPackagedFlag === undefined) {
      delete process.env[RUNTIME_IS_PACKAGED_ENV];
    } else {
      process.env[RUNTIME_IS_PACKAGED_ENV] = originalPackagedFlag;
    }

    if (originalResourcesPathFlag === undefined) {
      delete process.env[RUNTIME_RESOURCES_PATH_ENV];
    } else {
      process.env[RUNTIME_RESOURCES_PATH_ENV] = originalResourcesPathFlag;
    }

    if (originalResourcesPathDescriptor) {
      Object.defineProperty(process, 'resourcesPath', originalResourcesPathDescriptor);
    } else {
      Reflect.deleteProperty(process, 'resourcesPath');
    }
  });

  it('uses development migrations for unpackaged development runtimes', async () => {
    const { runMigrations } = await import('../src/main/db/migrate');

    expect(runMigrations()).toEqual({ success: true });
    expect(migrationMockState.migrationsFolder).toBe(path.resolve(process.cwd(), 'drizzle'));
  });

  it('uses packaged migrations from the Nix resources path override when both runtime flags are set', async () => {
    process.env[RUNTIME_IS_PACKAGED_ENV] = '1';
    process.env[RUNTIME_RESOURCES_PATH_ENV] = '/nix/store/inkline-app/lib/inkline/resources';
    const { runMigrations } = await import('../src/main/db/migrate');

    expect(runMigrations()).toEqual({ success: true });
    expect(migrationMockState.migrationsFolder).toBe(
      path.join('/nix/store/inkline-app/lib/inkline/resources', 'drizzle'),
    );
  });
});
