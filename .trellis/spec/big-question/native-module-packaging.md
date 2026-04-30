# Native Module Packaging with Electron Forge + Vite

> **Severity**: P0 - App fails to start after packaging

## Problem

After packaging with Electron Forge + Vite, the app crashes immediately:

```
Error: Cannot find module 'better-sqlite3'
Require stack:
- /path/to/app.asar/.vite/build/main.js
```

Development (`npm start`) works fine, but packaged app (`npm run package`) fails.

## Common Native Modules Affected

- `better-sqlite3`
- `sqlite3`
- `sharp`
- `node-canvas`
- `serialport`
- Any module containing `.node` binary files

## Initial Attempts (All Failed)

### 1. Mark as external in Vite config

```typescript
// vite.main.config.ts
external: ['better-sqlite3'];
```

**Why it fails**: This only tells Vite not to bundle the module. The packaged `main.js` generates `require('better-sqlite3')`, but Forge doesn't copy `node_modules` to the output.

### 2. Configure asar.unpack

```typescript
asar: {
  unpack: '**/{*.node,better-sqlite3/**/*}',
}
```

**Why it fails**: `asar.unpack` only extracts files that are already in the asar. If the module wasn't copied in the first place, there's nothing to extract.

### 3. Use AutoUnpackNativesPlugin

```typescript
plugins: [new AutoUnpackNativesPlugin({})];
```

**Why it fails**: Same reason - it unpacks `.node` files, but the module must exist in the asar first.

### 4. Disable OnlyLoadAppFromAsar

```typescript
[FuseV1Options.OnlyLoadAppFromAsar]: false
```

**Why it fails**: Necessary but not sufficient. Allows loading from unpacked directory, but doesn't solve the missing module problem.

## Root Cause

Vite's `external` config and Electron Forge's packaging are **two independent processes**:

```
Vite external: "Don't bundle this module, use require() at runtime"
                    |
              generates require('better-sqlite3')
                    |
Forge package: "By default, don't copy node_modules, only bundle source"
                    |
              Module not found at runtime!
```

## Solution

Configure `forge.config.ts` to explicitly copy native modules:

```typescript
import path from 'path';
import { cp, mkdir } from 'fs/promises';
import type { ForgeConfig } from '@electron-forge/shared-types';

// List all native modules and their dependencies
const nativeModules = ['better-sqlite3', 'bindings', 'file-uri-to-path'];

const config: ForgeConfig = {
  packagerConfig: {
    asar: {
      unpack: '*.{node,dll}',
    },
  },
  rebuildConfig: {
    force: true,
    onlyModules: ['better-sqlite3'],
  },
  hooks: {
    // Explicitly copy native modules after packaging
    packageAfterCopy: async (_forgeConfig, buildPath) => {
      const sourceNodeModulesPath = path.resolve(__dirname, 'node_modules');
      const destNodeModulesPath = path.resolve(buildPath, 'node_modules');

      await Promise.all(
        nativeModules.map(async (packageName) => {
          const sourcePath = path.join(sourceNodeModulesPath, packageName);
          const destPath = path.join(destNodeModulesPath, packageName);
          await mkdir(path.dirname(destPath), { recursive: true });
          await cp(sourcePath, destPath, {
            recursive: true,
            preserveTimestamps: true,
          });
        })
      );
    },
  },
};

export default config;
```

## Why This Works

1. **Leave the Vite plugin default `ignore` intact**: Electron Forge's Vite plugin normally packages only `.vite` output. Do not set `packagerConfig.ignore` just to whitelist native modules, because that overrides the plugin default and can accidentally package `src/`, `test/`, `.trellis/`, and other project files.

2. **`packageAfterCopy` hook**: Explicitly copies modules to `buildPath/node_modules/` after Forge copies the Vite output. This gives runtime `require('better-sqlite3')` a real package to resolve without changing the Vite plugin ignore behavior.

3. **`asar.unpack: '*.{node,dll}'`**: Extracts native binary files from asar. `.node` files cannot be loaded from inside an asar archive.

4. **`rebuildConfig.force: true` plus `onlyModules` when needed**: Ensures required native modules are rebuilt for the current Electron version. Use `onlyModules` when optional native modules are copied but should not be rebuilt on platforms missing their system development packages.

## Key Insight

**Two separate concerns**:

| Concern   | Tool  | What it does                            |
| --------- | ----- | --------------------------------------- |
| Bundling  | Vite  | Decides what to bundle vs require()     |
| Packaging | Forge | Decides what files to include in output |

You must configure BOTH:

1. Tell Vite: "Don't bundle this, use require()"
2. Tell Forge: "Include this module in the package"

## Dependency Chain

Native modules often have their own dependencies. For `better-sqlite3`:

```
better-sqlite3
├── bindings (loads .node files)
└── file-uri-to-path (dependency of bindings)
```

**Always check `node_modules/{package}/package.json` for dependencies and include them all.** Optional native modules such as `keytar` may require platform system libraries at rebuild time; copy them if the runtime feature should work when available, but lazy-load them and surface an `unavailable` status if they cannot be loaded.

## Scenario: Forge Vite Native Runtime Modules

### 1. Scope / Trigger

- Trigger: A main-process Vite bundle externalizes a native runtime module such as `better-sqlite3`, `keytar`, `sqlite3`, `sharp`, or another package that loads `.node` binaries.
- This applies to packaged Electron apps, not only development runs.

### 2. Signatures

- Vite main config: `rollupOptions.external` includes required runtime native package names.
- Forge packager config: `asar.unpack = '*.{node,dll}'` and `extraResource` still includes non-code runtime resources such as `drizzle`.
- Forge hook: `packageAfterCopy(_forgeConfig, buildPath): Promise<void>` copies native packages into `path.join(buildPath, 'node_modules')`.
- Rebuild config: `rebuildConfig.onlyModules?: string[]` restricts rebuilds when optional native modules are copied but should not be compiled on the current platform.

### 3. Contracts

- Do not set `packagerConfig.ignore` when using `@electron-forge/plugin-vite` unless you fully reproduce its default `.vite`-only behavior.
- Required external native modules must have their JavaScript package files inside `app.asar/node_modules/<package>` and `.node` binaries under `app.asar.unpacked/node_modules/<package>` after packaging.
- Optional native modules must be lazy-loaded from main-process service code, and load failure must produce a typed unavailable/configuration status instead of crashing Electron startup.
- Native module dependency packages such as `bindings` and `file-uri-to-path` must be copied with the package that requires them.

### 4. Validation & Error Matrix

| Condition | Behavior |
| --- | --- |
| `require('better-sqlite3')` is externalized but package not copied | Packaged app fails on startup with `Cannot find module 'better-sqlite3'`; fix Forge copy hook. |
| `.node` binary remains inside ASAR only | Runtime native loader fails; keep `asar.unpack` for `.node`/`.dll`. |
| `packagerConfig.ignore` overrides Vite plugin default | Source, tests, `.trellis`, or other project files may be packaged; remove custom ignore and use `packageAfterCopy`. |
| Optional `keytar` rebuild needs missing Linux `libsecret-1.pc` | Restrict `rebuildConfig.onlyModules` to required rebuilt modules and lazy-load `keytar`. |
| Optional native module load fails at runtime | Return an existing typed unavailable status; do not throw during module import or app startup. |

### 5. Good/Base/Bad Cases

- Good: `better-sqlite3`, `bindings`, `file-uri-to-path`, and optional `keytar` are copied by hook; only `better-sqlite3` is rebuilt; ASAR contains no `src/`, `test/`, or `.trellis/` files.
- Base: Required native database module is copied and rebuilt; optional keychain support reports unavailable on platforms without native support.
- Bad: Adding a negative-lookahead `packagerConfig.ignore` whitelist causes Forge to package the whole repo or skips copied native dependency files.

### 6. Tests Required

- Build smoke: run `pnpm package` and assert packaging completes.
- Artifact check: assert `app.asar` contains required native package JS entries and `app.asar.unpacked` contains required `.node` binaries.
- Artifact privacy/size check: assert `app.asar` does not contain `src/`, `test/`, or `.trellis/` paths.
- Optional native module test: mock native module load failure and assert service returns an unavailable status without throwing.

### 7. Wrong vs Correct

#### Wrong

```typescript
packagerConfig: {
  ignore: [/node_modules\/(?!(better-sqlite3|bindings|file-uri-to-path)\/).*/],
}
```

This overrides the Vite plugin's default ignore and can package source/test/spec files.

#### Correct

```typescript
packagerConfig: {
  asar: { unpack: '*.{node,dll}' },
  extraResource: ['drizzle'],
},
hooks: {
  packageAfterCopy: async (_forgeConfig, buildPath) => {
    await cp(path.join(projectRoot, 'node_modules/better-sqlite3'), path.join(buildPath, 'node_modules/better-sqlite3'), {
      recursive: true,
      preserveTimestamps: true,
    });
  },
}
```

Keep Forge Vite's default `.vite`-only packaging behavior and add native packages explicitly after copy.

## Verification

After packaging, check the output:

```bash
# macOS
ls -la "out/YourApp-darwin-x64/YourApp.app/Contents/Resources/app.asar.unpacked/"

# Windows
dir "out\YourApp-win32-x64\resources\app.asar.unpacked\"

# Should see your .node files extracted
```

## References

- [Electron Forge: Auto Unpack Natives Plugin](https://www.electronforge.io/config/plugins/auto-unpack-natives)
- [Stack Overflow: Cannot find module 'better-sqlite3' after building](https://stackoverflow.com/questions/79544832/cannot-find-module-better-sqlite3-after-building-electron-forge-vite-app-on-l)
