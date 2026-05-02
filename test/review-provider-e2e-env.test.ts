import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildNativeDependencyLdLibraryPath } from '../scripts/review-provider-e2e';

const tempRoots: string[] = [];

describe('review provider e2e native dependency environment', () => {
  afterEach(async () => {
    for (const tempRoot of tempRoots.splice(0)) {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('prepends a detected Nix libsecret directory while preserving LD_LIBRARY_PATH', async () => {
    const nixStoreDir = await makeNixStoreWithLibsecret();
    const existingLdLibraryPath = ['/existing/one', '/existing/two'].join(path.delimiter);

    const result = buildNativeDependencyLdLibraryPath({
      currentLdLibraryPath: existingLdLibraryPath,
      nixStoreDir,
    });

    expect(result).toBe(
      [path.join(nixStoreDir, 'abc-libsecret-0.21.7', 'lib'), '/existing/one', '/existing/two'].join(path.delimiter),
    );
  });

  it('does not duplicate libsecret when the current library path already contains it', async () => {
    const nixStoreDir = await makeNixStoreWithLibsecret();
    const existingLibDir = path.join(nixStoreDir, 'already-present', 'lib');
    await mkdir(existingLibDir, { recursive: true });
    await writeFile(path.join(existingLibDir, 'libsecret-1.so.0'), '');
    const existingLdLibraryPath = [existingLibDir, '/existing'].join(path.delimiter);

    const result = buildNativeDependencyLdLibraryPath({
      currentLdLibraryPath: existingLdLibraryPath,
      nixStoreDir,
    });

    expect(result).toBe(existingLdLibraryPath);
  });

  it('keeps the existing library path when libsecret cannot be detected', async () => {
    const emptyStoreDir = await makeTempDir();

    const result = buildNativeDependencyLdLibraryPath({
      currentLdLibraryPath: '/existing',
      nixStoreDir: emptyStoreDir,
    });

    expect(result).toBe('/existing');
  });

  it('returns undefined when no library path exists and libsecret cannot be detected', async () => {
    const emptyStoreDir = await makeTempDir();

    const result = buildNativeDependencyLdLibraryPath({ nixStoreDir: emptyStoreDir });

    expect(result).toBeUndefined();
  });
});

async function makeNixStoreWithLibsecret(): Promise<string> {
  const nixStoreDir = await makeTempDir();
  const libDir = path.join(nixStoreDir, 'abc-libsecret-0.21.7', 'lib');
  await mkdir(libDir, { recursive: true });
  await writeFile(path.join(libDir, 'libsecret-1.so.0'), '');
  return nixStoreDir;
}

async function makeTempDir(): Promise<string> {
  const tempRoot = await mkdtemp(path.join(tmpdir(), 'english-coach-e2e-env-test-'));
  tempRoots.push(tempRoot);
  return tempRoot;
}
