import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const RENDERER_DIR = path.resolve(process.cwd(), 'src/renderer');
const FORBIDDEN_IMPORTS = [
  'electron',
  'electron-store',
  'keytar',
  'better-sqlite3',
  'drizzle-orm',
  'ai',
  '@ai-sdk/',
  'fs',
  'node:fs',
  'node:fs/promises',
];

describe('renderer boundary', () => {
  it('does not import main-process, keychain, database, filesystem, or provider SDK modules', () => {
    const violations = rendererSourceFiles(RENDERER_DIR).flatMap((filePath) => {
      const source = readFileSync(filePath, 'utf8');
      return importedSpecifiers(source)
        .filter(isForbiddenRendererImport)
        .map((specifier) => `${path.relative(process.cwd(), filePath)} -> ${specifier}`);
    });

    expect(violations).toEqual([]);
  });
});

function rendererSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return rendererSourceFiles(entryPath);
    }

    return /\.(ts|tsx)$/.test(entry.name) ? [entryPath] : [];
  });
}

function importedSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const importPattern = /(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  let match = importPattern.exec(source);
  while (match) {
    const specifier = match[1];
    if (specifier) {
      specifiers.push(specifier);
    }
    match = importPattern.exec(source);
  }
  return specifiers;
}

function isForbiddenRendererImport(specifier: string): boolean {
  return FORBIDDEN_IMPORTS.some((forbidden) => {
    if (forbidden.endsWith('/')) {
      return specifier.startsWith(forbidden);
    }
    return specifier === forbidden || specifier.startsWith(`${forbidden}/`);
  });
}
