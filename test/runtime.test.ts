import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RUNTIME_IS_PACKAGED_ENV,
  RUNTIME_RESOURCES_PATH_ENV,
  getPackagedResourcesPath,
  isPackagedRuntime,
  isTruthyEnvValue,
} from '../src/main/runtime';

const electronMockState = vi.hoisted(() => ({
  isPackaged: false,
  userDataPath: '',
  setPathCalls: [] as Array<{ name: string; value: string }>,
}));

vi.mock('electron', () => ({
  app: {
    get isPackaged(): boolean {
      return electronMockState.isPackaged;
    },
    getPath(name: string): string {
      if (name !== 'userData') {
        throw new Error(`Unexpected Electron path lookup: ${name}`);
      }

      return electronMockState.userDataPath;
    },
    setPath(name: string, value: string): void {
      electronMockState.setPathCalls.push({ name, value });
    },
  },
}));

describe('runtime packaging flags', () => {
  const originalPackagedFlag = process.env[RUNTIME_IS_PACKAGED_ENV];
  const originalResourcesPathFlag = process.env[RUNTIME_RESOURCES_PATH_ENV];
  const originalTz = process.env.TZ;

  beforeEach(() => {
    vi.resetModules();
    electronMockState.isPackaged = false;
    electronMockState.userDataPath = '/tmp/Inkline';
    electronMockState.setPathCalls = [];
    delete process.env[RUNTIME_IS_PACKAGED_ENV];
    delete process.env[RUNTIME_RESOURCES_PATH_ENV];
    process.env.TZ = 'UTC';
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

    if (originalTz === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = originalTz;
    }
  });

  it('parses truthy environment values', () => {
    expect(isTruthyEnvValue('1')).toBe(true);
    expect(isTruthyEnvValue('true')).toBe(true);
    expect(isTruthyEnvValue('yes')).toBe(true);
    expect(isTruthyEnvValue('0')).toBe(false);
    expect(isTruthyEnvValue(undefined)).toBe(false);
  });

  it('treats Electron packaged apps as packaged runtimes', () => {
    expect(isPackagedRuntime(true)).toBe(true);
  });

  it('treats Nix-wrapped Electron apps as packaged when the runtime flag is set', () => {
    expect(isPackagedRuntime(false, '1')).toBe(true);
  });

  it('uses the packaged resources path override when set', () => {
    process.env[RUNTIME_RESOURCES_PATH_ENV] = '/nix/store/inkline/resources';

    expect(getPackagedResourcesPath('/electron/resources')).toBe('/nix/store/inkline/resources');
  });

  it('keeps unpackaged development runtimes isolated under the dev userData directory', async () => {
    await import('../src/main/env-setup');

    expect(process.env[RUNTIME_IS_PACKAGED_ENV]).toBe('0');
    expect(electronMockState.setPathCalls).toEqual([
      { name: 'userData', value: path.join(electronMockState.userDataPath, 'dev') },
    ]);
  });

  it('does not apply the dev userData suffix when the Nix runtime flag is set', async () => {
    process.env[RUNTIME_IS_PACKAGED_ENV] = '1';

    await import('../src/main/env-setup');

    expect(process.env[RUNTIME_IS_PACKAGED_ENV]).toBe('1');
    expect(electronMockState.setPathCalls).toEqual([]);
  });
});
