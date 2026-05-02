# pnpm + Electron 项目配置指南

> **Purpose**: 使用 pnpm 管理 Electron 项目的完整配置指南，包括 monorepo 设置、native modules 处理和打包配置。

---

## 为什么 Electron 项目使用 pnpm 需要特殊配置？

pnpm 默认使用 **符号链接 + 内容寻址存储**，创建非扁平的 `node_modules` 结构：

```
node_modules/
├── .pnpm/                    # 实际包存储
│   ├── better-sqlite3@9.0.0/
│   │   └── node_modules/
│   │       └── better-sqlite3/
│   └── bindings@1.5.0/
└── your-package -> .pnpm/... # 符号链接
```

**问题**：

1. **Native modules 路径解析失败** - Electron 打包时无法正确处理符号链接
2. **electron-rebuild 找不到模块** - 需要扁平结构才能正确重建
3. **asar 打包问题** - 符号链接不能被打包进 asar

**解决方案**：使用 `shamefully-hoist` 创建类似 npm 的扁平结构。

---

## 基础配置

### 1. .npmrc 配置（必需）

```ini
# .npmrc

# 使用 hoisted 的 node_modules 结构（类似 npm）
node-linker=hoisted

# 将所有依赖提升到根 node_modules（Electron 必需）
shamefully-hoist=true

# 可选：如果遇到 peer dependency 警告
strict-peer-dependencies=false

# 可选：加速安装
prefer-offline=true
```

**配置说明**：

| 配置                             | 作用                      | 为什么需要                |
| -------------------------------- | ------------------------- | ------------------------- |
| `node-linker=hoisted`            | 使用扁平化的 node_modules | Electron 打包需要         |
| `shamefully-hoist=true`          | 提升所有依赖到根目录      | Native modules 路径解析   |
| `strict-peer-dependencies=false` | 忽略 peer 依赖警告        | Electron 生态包版本常冲突 |

### 2. pnpm-workspace.yaml（Monorepo）

```yaml
# pnpm-workspace.yaml

packages:
  - 'apps/*' # Electron 应用
  - 'packages/*' # 共享包
  - '!**/dist' # 排除构建产物
  - '!**/out' # 排除 Electron 打包产物
```

**典型 Monorepo 结构**：

```
my-electron-project/
├── .npmrc
├── pnpm-workspace.yaml
├── package.json              # 根 package.json
├── apps/
│   └── desktop/              # Electron 应用
│       ├── package.json
│       ├── forge.config.ts
│       ├── src/
│       │   ├── main/         # Main process
│       │   ├── renderer/     # Renderer process
│       │   └── preload/      # Preload scripts
│       └── ...
└── packages/
    ├── shared/               # 共享代码
    │   └── package.json
    └── ui/                   # 共享 UI 组件
        └── package.json
```

### 3. 根 package.json

```json
{
  "name": "my-electron-monorepo",
  "private": true,
  "scripts": {
    "dev": "pnpm --filter @my-app/desktop dev",
    "build": "pnpm --filter @my-app/desktop build",
    "package": "pnpm --filter @my-app/desktop package",
    "make": "pnpm --filter @my-app/desktop make",
    "lint": "pnpm -r lint",
    "typecheck": "pnpm -r typecheck",
    "postinstall": "electron-builder install-app-deps"
  },
  "devDependencies": {
    "electron": "^28.0.0"
  },
  "engines": {
    "node": ">=18.0.0",
    "pnpm": ">=8.0.0"
  },
  "packageManager": "pnpm@8.15.0"
}
```

---

## Native Modules 配置

### 问题：Native Modules 需要为 Electron 重新编译

Native modules（如 `better-sqlite3`）包含 C++ 代码，必须针对 Electron 的 Node.js 版本编译。

### 解决方案 1：electron-rebuild（推荐）

```json
// apps/desktop/package.json
{
  "scripts": {
    "postinstall": "electron-rebuild",
    "rebuild": "electron-rebuild -f"
  },
  "devDependencies": {
    "@electron/rebuild": "^3.6.0"
  }
}
```

### 解决方案 2：electron-builder install-app-deps

```json
// 根 package.json
{
  "scripts": {
    "postinstall": "electron-builder install-app-deps"
  },
  "devDependencies": {
    "electron-builder": "^24.0.0"
  }
}
```

### 解决方案 3：Electron Forge 自动处理

如果使用 Electron Forge，配置 `rebuildConfig`：

```typescript
// forge.config.ts
import type { ForgeConfig } from '@electron-forge/shared-types';

const config: ForgeConfig = {
  rebuildConfig: {
    force: true, // 强制重建所有 native modules
  },
  // ...
};

export default config;
```

---

## Electron Forge + pnpm 配置

### forge.config.ts 完整配置

```typescript
// apps/desktop/forge.config.ts
import type { ForgeConfig } from '@electron-forge/shared-types';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import path from 'path';
import { cp, mkdir } from 'fs/promises';

// Native modules 及其依赖
const nativeModules = ['better-sqlite3', 'bindings', 'file-uri-to-path'];

const config: ForgeConfig = {
  packagerConfig: {
    asar: {
      // 从 asar 中提取 native 二进制文件
      unpack: '*.{node,dll}',
    },
    // 只包含必要的 node_modules
    ignore: [
      // 排除所有 node_modules，除了 native modules
      new RegExp(`node_modules/(?!(${nativeModules.join('|')})/)`),
      // 排除开发文件
      /\.git/,
      /\.vscode/,
      /\.idea/,
      /src\//,
      /\.ts$/,
      /\.map$/,
    ],
  },

  rebuildConfig: {
    force: true,
  },

  hooks: {
    // 打包后复制 native modules
    packageAfterCopy: async (_forgeConfig, buildPath) => {
      const sourceNodeModules = path.resolve(__dirname, 'node_modules');
      const destNodeModules = path.resolve(buildPath, 'node_modules');

      for (const packageName of nativeModules) {
        const sourcePath = path.join(sourceNodeModules, packageName);
        const destPath = path.join(destNodeModules, packageName);

        try {
          await mkdir(path.dirname(destPath), { recursive: true });
          await cp(sourcePath, destPath, {
            recursive: true,
            preserveTimestamps: true,
          });
        } catch (error) {
          console.warn(`Failed to copy ${packageName}:`, error);
        }
      }
    },
  },

  plugins: [
    new VitePlugin({
      build: [
        { entry: 'src/main/index.ts', config: 'vite.main.config.ts' },
        { entry: { preload: 'src/preload/index.ts' }, config: 'vite.preload.config.ts', target: 'preload' },
      ],
      renderer: [{ name: 'main_window', config: 'vite.renderer.config.ts' }],
    }),

    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: false, // 允许加载 unpacked 文件
    }),
  ],
};

export default config;
```

## Scenario: pnpm 10.23 Build Script Approvals for Electron CI

### 1. Scope / Trigger

- Trigger: Any Electron CI workflow or package setup that runs `pnpm install` with this repo's pinned `pnpm@10.23.0` and dependencies that need install/build scripts for native modules or packaged tool binaries.
- This applies to CI quality jobs and Electron Forge package/make jobs because ignored dependency scripts can leave native modules or maker helper binaries unusable.

### 2. Signatures

`pnpm-workspace.yaml`:

```yaml
onlyBuiltDependencies:
  - better-sqlite3
  - electron
  - electron-winstaller
  - esbuild
  - keytar
```

GitHub Actions install shape:

```yaml
- name: Install dependencies
  run: pnpm install --frozen-lockfile
```

### 3. Contracts

| Field | Type | Constraint |
| --- | --- | --- |
| `onlyBuiltDependencies` | string array | For pnpm 10.23, must include every dependency whose install/build script is required for local or CI packaging. |
| `better-sqlite3` | native module | Must be allowed so the SQLite native binding can be built or rebuilt for Electron. |
| `keytar` | native module | Must be allowed when installed; Linux CI also needs `libsecret-1-dev` before `pnpm install`. |
| `esbuild` | tool binary package | Must be allowed so the platform binary can be validated during install. |
| `electron-winstaller` | maker helper package | Must be allowed for Windows Squirrel maker support because its install script selects bundled 7-Zip files. |
| CI install command | shell command | Use the committed lockfile with `pnpm install --frozen-lockfile`; do not rely on interactive `pnpm approve-builds` in CI. |

### 4. Validation & Error Matrix

| Condition | Behavior |
| --- | --- |
| Required package is missing from `onlyBuiltDependencies` | pnpm reports ignored build scripts; later `electron-rebuild`, Vite, or Forge makers can fail. |
| `keytar` is allowed on Linux but `libsecret-1-dev` is missing before install | Native rebuild can fail because `libsecret-1.pc` is unavailable. |
| `electron-winstaller` install script is ignored | Windows Squirrel maker may be missing the selected `vendor/7z.exe` and `vendor/7z.dll` files. |
| CI tries to run `pnpm approve-builds` | Workflow blocks or fails because approval is interactive state, not a reproducible CI contract. |
| `pnpm install --frozen-lockfile` completes and postinstall rebuild passes | Dependencies are in the expected state for quality checks and Forge makers. |

### 5. Good/Base/Bad Cases

- Good: The explicit allowlist contains Electron, native runtime modules, Vite's binary helper, and maker install helpers; CI installs OS packages first, then runs `pnpm install --frozen-lockfile`.
- Base: A workflow that only runs lint/typecheck still uses the same install contract because root `postinstall` runs `electron-rebuild`.
- Bad: Adding a CI-only `--ignore-scripts` workaround; this can make lint run while leaving package/make jobs broken.
- Bad: Relying on a developer's local approved-builds state instead of committing the package allowlist.

### 6. Tests Required

- Install smoke:
  - Run `pnpm install --frozen-lockfile`.
  - Assert root `postinstall` completes `electron-rebuild` without ignored required build scripts causing failure.
  - Run `pnpm ignored-builds` after approving new build-script packages; expected output is `None`.
- Quality gate:
  - Run `pnpm lint`.
  - Run `pnpm typecheck`.
  - Run project tests/harness commands required by the active workflow.
- Packaging smoke when packaging is in scope:
  - Run `pnpm package` or `pnpm make` on the target platform after install.
  - Assert expected Forge output exists under `out/`.

### 7. Wrong vs Correct

#### Wrong

```yaml
onlyBuiltDependencies:
  - electron
```

This can ignore install scripts for native modules and maker helpers needed by Electron Forge builds.

#### Correct

```yaml
onlyBuiltDependencies:
  - better-sqlite3
  - electron
  - electron-winstaller
  - esbuild
  - keytar
```

Keep the allowlist explicit and commit it with the workflow that depends on reproducible installs.

### Vite 配置：外部化 Native Modules

```typescript
// vite.main.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/main/index.ts',
      formats: ['cjs'],
      fileName: () => '[name].cjs',
    },
    rollupOptions: {
      external: [
        'electron',
        'better-sqlite3',
        // 其他 native modules
      ],
    },
  },
  resolve: {
    // 确保 Node.js 内置模块正确解析
    conditions: ['node'],
    mainFields: ['module', 'jsnext:main', 'jsnext'],
  },
});
```

```typescript
// vite.preload.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      external: ['electron'],
      output: {
        entryFileNames: '[name].cjs',
        chunkFileNames: '[name].cjs',
      },
    },
  },
  resolve: {
    conditions: ['node'],
    mainFields: ['module', 'jsnext:main', 'jsnext'],
  },
});
```

## Scenario: Electron Forge Vite CJS output in ESM packages

### 1. Scope / Trigger

- Trigger: Any Electron Forge + Vite app whose root `package.json` contains `"type": "module"` and whose main or preload bundles are loaded from `.vite/build`.
- The Forge Vite plugin builds main/preload targets as CommonJS. If the output file extension is `.js` under a `type: module` package, Electron loads it as ESM and `require` fails at startup.

### 2. Signatures

`package.json`:

```json
{
  "type": "module",
  "main": ".vite/build/index.cjs"
}
```

Main process preload path:

```typescript
preload: path.join(__dirname, 'preload.cjs')
```

Forge Vite build entries:

```typescript
new VitePlugin({
  build: [
    { entry: 'src/main/index.ts', config: 'vite.main.config.ts' },
    { entry: { preload: 'src/preload/index.ts' }, config: 'vite.preload.config.ts', target: 'preload' },
  ],
  renderer: [{ name: 'main_window', config: 'vite.renderer.config.ts' }],
});
```

### 3. Contracts

| Field | Type | Constraint |
| --- | --- | --- |
| `package.json.main` | string | Must point to `.vite/build/index.cjs` when main output is CommonJS. |
| Main output file | file path | Must be `.vite/build/index.cjs`; not `.js` under `type: module`. |
| Preload output file | file path | Must be `.vite/build/preload.cjs` and match the `BrowserWindow` preload path. |
| Preload Forge target | `'preload'` | Must be set so Forge uses preload config and reload behavior. |
| Preload Rollup input name | object key | Must be named `preload` to avoid colliding with main `index.cjs`. |

### 4. Validation & Error Matrix

| Condition | Behavior |
| --- | --- |
| `type: module` + main points to `.vite/build/index.js` containing `require(...)` | Electron startup fails with `ReferenceError: require is not defined in ES module scope`. |
| Main output uses `.cjs` but `package.json.main` still points to `.js` | Electron cannot load the generated app entry. |
| Preload output uses `.cjs` but `BrowserWindow` points to `preload.js` | Renderer starts without the expected preload API. |
| Main and preload entries are both named `index` with `[name].cjs` output | One output can overwrite or collide with the other; `.vite/build/preload.cjs` may be missing. |
| Preload build omits `target: 'preload'` | Forge treats it as a main build target instead of a preload target. |

### 5. Good/Base/Bad Cases

- Good: `pnpm run package` generates both `.vite/build/index.cjs` and `.vite/build/preload.cjs`, and Electron launches without ESM/CJS startup errors.
- Base: A package without `"type": "module"` may run `.js` CommonJS output, but `.cjs` remains explicit and safe.
- Bad: Changing the whole package back to CommonJS just to fix Electron startup; this can break ESM config files and ESM-only dependencies.
- Bad: Renaming only `package.json.main` without changing Vite output and preload references.

### 6. Tests Required

- Build smoke test:
  - Run `pnpm run package`.
  - Assert `.vite/build/index.cjs` exists.
  - Assert `.vite/build/preload.cjs` exists.
- Dev smoke test:
  - Run `pnpm run dev` long enough to reach `Launched Electron app`.
  - Assert there is no `ReferenceError: require is not defined in ES module scope`.
- Static config check:
  - Assert `package.json.main` ends in `.cjs`.
  - Assert `BrowserWindow` preload path ends in `preload.cjs`.

### 7. Wrong vs Correct

#### Wrong

```json
{
  "type": "module",
  "main": ".vite/build/index.js"
}
```

```typescript
new VitePlugin({
  build: [
    { entry: 'src/main/index.ts', config: 'vite.main.config.ts' },
    { entry: 'src/preload/index.ts', config: 'vite.preload.config.ts' },
  ],
});
```

#### Correct

```json
{
  "type": "module",
  "main": ".vite/build/index.cjs"
}
```

```typescript
new VitePlugin({
  build: [
    { entry: 'src/main/index.ts', config: 'vite.main.config.ts' },
    { entry: { preload: 'src/preload/index.ts' }, config: 'vite.preload.config.ts', target: 'preload' },
  ],
});
```

---

## Scenario: Electron Forge Vite Renderer Output with Custom Root

### 1. Scope / Trigger

- Trigger: Any Electron Forge + Vite renderer config that sets `root` to a subdirectory such as `src/renderer`.
- This applies to packaged apps because the main process loads renderer files from the packaged app root, not from the renderer source root.

### 2. Signatures

Main process packaged renderer load path:

```typescript
void mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
```

Renderer Forge target:

```typescript
new VitePlugin({
  renderer: [{ name: 'main_window', config: 'vite.renderer.config.ts' }],
});
```

Renderer Vite output when using a custom root:

```typescript
export default defineConfig({
  root: path.resolve(__dirname, 'src/renderer'),
  build: {
    outDir: path.resolve(__dirname, '.vite/renderer/main_window'),
    emptyOutDir: true,
  },
});
```

### 3. Contracts

| Field | Type | Constraint |
| --- | --- | --- |
| `renderer[].name` | string | Must match the folder segment used by `MAIN_WINDOW_VITE_NAME`; e.g. `main_window`. |
| `vite.renderer.config.ts.root` | absolute path | May point to `src/renderer`, but then `build.outDir` must be absolute. |
| `build.outDir` | absolute path | Must resolve to project-root `.vite/renderer/<window-name>`, not `<root>/.vite/renderer/<window-name>`. |
| Packaged ASAR entry | file path | Must include `/.vite/renderer/<window-name>/index.html`. |

### 4. Validation & Error Matrix

| Condition | Behavior |
| --- | --- |
| `root` is `src/renderer` and `build.outDir` is omitted | Vite writes `src/renderer/.vite/renderer/<window-name>/index.html`; packaged app misses root `.vite/renderer/...`. |
| Packaged ASAR lacks `/.vite/renderer/<window-name>/index.html` | Electron logs `Failed to load URL ... ERR_FILE_NOT_FOUND` when creating the window. |
| `build.outDir` uses project-root absolute `.vite/renderer/<window-name>` | Forge packages the renderer entry at the path the main process loads. |
| `renderer[].name` changes without updating `build.outDir` | Build can succeed but the packaged main process loads the wrong directory. |

### 5. Good/Base/Bad Cases

- Good: `vite.renderer.config.ts` sets `root: path.resolve(__dirname, 'src/renderer')` and absolute `build.outDir: path.resolve(__dirname, '.vite/renderer/main_window')`; `app.asar` contains `/.vite/renderer/main_window/index.html`.
- Base: A renderer config that does not override `root` can rely on Forge Vite's default relative `.vite/renderer/<window-name>` output.
- Bad: `root` points to `src/renderer` while `outDir` is omitted or relative; renderer files are generated under `src/renderer/.vite`, outside the packaged app root expected by Electron.

### 6. Tests Required

- Renderer build smoke:
  - Run `pnpm exec vite build --config vite.renderer.config.ts`.
  - Assert `.vite/renderer/<window-name>/index.html` exists at the project root.
- Package smoke:
  - Run `pnpm package`.
  - Assert `pnpm exec asar list out/<app>-linux-x64/resources/app.asar` includes `/.vite/renderer/<window-name>/index.html`.
- Runtime smoke:
  - Launch the packaged binary long enough to create the main window.
  - Assert there is no `ERR_FILE_NOT_FOUND` or `Failed to load URL` for `.vite/renderer/<window-name>/index.html`.

### 7. Wrong vs Correct

#### Wrong

```typescript
export default defineConfig({
  root: path.resolve(__dirname, 'src/renderer'),
  plugins: [react()],
});
```

This writes the production renderer output under `src/renderer/.vite/renderer/main_window`, while the packaged main process resolves `../renderer/main_window/index.html` from app-root `.vite/build`.

#### Correct

```typescript
export default defineConfig({
  root: path.resolve(__dirname, 'src/renderer'),
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, '.vite/renderer/main_window'),
    emptyOutDir: true,
  },
});
```

Keep the renderer source root for Vite's HTML entry resolution, but make the output directory absolute so Forge packages the renderer beside `.vite/build` at the app root.

---

## Scenario: Electron Forge Maker-Required Package Metadata

### 1. Scope / Trigger

- Trigger: Any task that adds or changes Electron Forge makers, creates a CI packaging workflow, or debugs `electron-forge make` failures.
- This applies to platform-specific makers that translate `package.json` metadata into native package formats, especially Windows Squirrel/NuGet and Linux package makers.

### 2. Signatures

Root `package.json`:

```json
{
  "name": "english-coach",
  "author": "lihaoze123",
  "license": "UNLICENSED",
  "private": true
}
```

Forge makers:

```typescript
makers: [new MakerSquirrel({}), new MakerDeb({}), new MakerAppImage({})];
```

### 3. Contracts

| Field | Type | Constraint |
| --- | --- | --- |
| `package.json.author` | string or npm author object | Required for Windows Squirrel because NuGet requires package authors metadata. |
| `package.json.license` | string | Required by native package metadata consumers. Use `UNLICENSED` for private packages unless the project has chosen an explicit distribution license. |

### 4. Validation & Error Matrix

| Condition | Behavior |
| --- | --- |
| Squirrel maker runs without package author metadata | Windows `pnpm make` can fail while building the `.nuspec` with `Authors is required.` |
| A Linux native package maker runs without package license metadata | Linux `pnpm make` can fail during native package metadata validation. |
| Private package uses `UNLICENSED` | npm-compatible metadata is present without implying an open-source distribution license. |

### 5. Good/Base/Bad Cases

- Good: A private Electron app sets `author` to the package owner or publishing entity and `license` to `UNLICENSED`; Squirrel and Linux package makers can derive native package metadata without per-maker overrides.
- Base: A public Electron app sets `author` plus its chosen SPDX license in root `package.json`; makers reuse that package metadata.
- Bad: Adding only maker-specific metadata while leaving root `package.json` incomplete; future makers or tooling can fail on the same missing fields.
- Bad: Setting a placeholder open-source license for a private app just to satisfy package metadata validation; this can imply a distribution policy the project has not chosen.

### 6. Tests Required

- Metadata check: verify root `package.json` includes `author` and `license` before adding or changing Forge makers.
- Packaging smoke when packaging is in scope: run `pnpm make` on the target platform, or `pnpm package` plus the closest available local maker validation when the current OS cannot build another platform's native installer.

### 7. Wrong vs Correct

#### Wrong

```json
{
  "name": "english-coach",
  "private": true
}
```

This leaves Squirrel/NuGet without package authors metadata and native package makers without license metadata.

#### Correct

```json
{
  "name": "english-coach",
  "author": "lihaoze123",
  "license": "UNLICENSED",
  "private": true
}
```

Keep maker-required metadata in root `package.json` so Electron Forge makers and native package formats can consume the same source of truth.

---

## Scenario: Electron Forge Linux DEB and AppImage Makers

### 1. Scope / Trigger

- Trigger: Any task that changes Linux Electron Forge maker output or CI packages for `pnpm make`.
- This app's Linux distributables are DEB and AppImage only. Do not add RPM unless product requirements change.

### 2. Signatures

Dependencies:

```json
{
  "dependencies": {
    "@electron-forge/maker-deb": "^7.10.2",
    "@reforged/maker-appimage": "^5.2.0"
  }
}
```

Forge makers:

```typescript
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerAppImage } from '@reforged/maker-appimage';

makers: [
  new MakerDeb({ options: { icon: pngIconPath } }),
  new MakerAppImage({
    options: {
      categories: ['Education'],
      icon: pngIconPath,
    },
  }),
];
```

GitHub Actions Linux package setup:

```yaml
run: sudo apt-get update && sudo apt-get install -y libsecret-1-dev fakeroot dpkg squashfs-tools
```

### 3. Contracts

| Item | Constraint |
| --- | --- |
| Linux maker set | Configure DEB plus AppImage only for current app requirements. |
| `@reforged/maker-appimage` | Use this third-party Forge-compatible maker for AppImage output. |
| `squashfs-tools` | Required on Linux CI because the AppImage maker requires the external `mksquashfs` binary. |
| `fakeroot` and `dpkg` | Required for DEB maker support on Ubuntu runners. |
| `libsecret-1-dev` | Required for rebuilding `keytar` on Linux. |

### 4. Validation & Error Matrix

| Condition | Behavior |
| --- | --- |
| RPM maker remains configured | Linux output includes an unsupported package format for current requirements. |
| AppImage maker runs without `mksquashfs` | `electron-forge make` fails before producing the AppImage. |
| DEB maker runs without `fakeroot`/`dpkg` | `electron-forge make` can fail while creating the `.deb`. |

### 5. Good/Base/Bad Cases

- Good: Linux CI installs `libsecret-1-dev fakeroot dpkg squashfs-tools`; Forge config emits `.deb` and `.AppImage` artifacts.
- Base: Local Linux packaging validates `pnpm package` when maker system tools are unavailable, and CI covers full distributable creation.
- Bad: Keeping `@electron-forge/maker-rpm`, `MakerRpm`, or the `rpm` apt package when Linux requirements are DEB plus AppImage only.

### 6. Tests Required

- Static config check: search for `MakerRpm`, `maker-rpm`, and Linux `rpm` package installation before finishing a DEB/AppImage-only task.
- Quality checks: run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, and project tests.
- Packaging smoke: run `pnpm package`, or `pnpm make` on Linux when `fakeroot`, `dpkg`, `squashfs-tools`, and any required network/runtime inputs are available.

### 7. Wrong vs Correct

#### Wrong

```typescript
import { MakerRpm } from '@electron-forge/maker-rpm';

makers: [
  new MakerRpm({ options: { icon: pngIconPath } }),
  new MakerDeb({ options: { icon: pngIconPath } }),
];
```

```yaml
run: sudo apt-get update && sudo apt-get install -y libsecret-1-dev fakeroot rpm
```

This keeps RPM as a Linux output and omits the AppImage `mksquashfs` dependency.

#### Correct

```typescript
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerAppImage } from '@reforged/maker-appimage';

makers: [
  new MakerDeb({ options: { icon: pngIconPath } }),
  new MakerAppImage({
    options: {
      categories: ['Education'],
      icon: pngIconPath,
    },
  }),
];
```

```yaml
run: sudo apt-get update && sudo apt-get install -y libsecret-1-dev fakeroot dpkg squashfs-tools
```

Keep Linux maker outputs aligned with the product requirement: DEB plus AppImage only.

---

## Scenario: Electron Forge App Icon Resources

### 1. Scope / Trigger

- Trigger: Any task that replaces the Electron placeholder app icon, adds app branding assets, or changes packaged runtime resources used by `BrowserWindow`.
- This is an infra integration because Electron icon behavior crosses Forge packager config, maker config, packaged resource copying, and main-process runtime paths.

### 2. Signatures

Repository icon assets:

```text
resources/icon.png
resources/icon.ico
resources/icon.icns  # macOS only, when local tooling can generate it
```

Forge config:

```typescript
const iconBasePath = path.resolve(projectRoot, 'resources', 'icon');
const pngIconPath = `${iconBasePath}.png`;
const icoIconPath = `${iconBasePath}.ico`;

const config: ForgeConfig = {
  packagerConfig: {
    icon: iconBasePath,
    extraResource: ['drizzle', 'resources'],
  },
  makers: [
    new MakerSquirrel({ setupIcon: icoIconPath }),
    new MakerDeb({ options: { icon: pngIconPath } }),
    new MakerAppImage({ options: { categories: ['Education'], icon: pngIconPath } }),
  ],
};
```

Main process runtime path:

```typescript
const iconPath = app.isPackaged
  ? path.join(process.resourcesPath, 'resources', 'icon.png')
  : path.join(app.getAppPath(), 'resources', 'icon.png');
```

### 3. Contracts

| Field | Type | Constraint |
| --- | --- | --- |
| `resources/icon.png` | PNG image | Canonical source used for Linux package metadata and non-macOS `BrowserWindow` icon. Must have an alpha channel with transparent outer background/corners unless the design intentionally uses a full-bleed square. |
| `resources/icon.ico` | ICO image | Required for Windows packager/Squirrel installer icon paths. Include common sizes such as 16, 32, 48, 64, 128, and 256 px. |
| `resources/icon.icns` | ICNS image | Required for macOS packaged app icons when local tooling can generate it. Do not fake this with a renamed PNG. |
| `packagerConfig.icon` | extensionless file path | Point to the icon base path so Electron Packager can select the platform-specific extension. |
| `packagerConfig.extraResource` | string array | Include `resources` whenever main-process runtime code reads from `process.resourcesPath/resources/...`. |
| Squirrel `setupIcon` | ICO file path | Point to the real `.ico` file, not the PNG source. |
| Deb/AppImage `options.icon` | PNG or SVG file path | Point to `resources/icon.png` unless a Linux-specific scalable icon exists. |
| `BrowserWindow.icon` | string or omitted | Set only on non-macOS platforms; use the packaged `process.resourcesPath` path after packaging and the repo path during dev. |

### 4. Validation & Error Matrix

| Condition | Behavior |
| --- | --- |
| `packagerConfig.icon` is omitted | Packaged apps can fall back to the default Electron placeholder icon. |
| `resources/icon.png` has no alpha channel and a near-white outer background | The app icon can render as an opaque white square instead of a shaped app icon. |
| `resources` is omitted from `extraResource` but `BrowserWindow` reads `process.resourcesPath/resources/icon.png` | Packaged non-macOS runtime icon path is missing. |
| Squirrel `setupIcon` points to PNG | Windows installer icon generation can fail or use the default installer icon. |
| Deb/AppImage maker `options.icon` is omitted | Linux desktop entries can use a default/generated icon instead of the app icon. |
| `BrowserWindow.icon` is set on macOS | It does not replace the dock/app bundle icon; use the packager `.icns` path for macOS. |
| `.icns` cannot be generated locally | Leave it absent and document the tooling gap; do not commit an invalid renamed file. |

### 5. Good/Base/Bad Cases

- Good: The repo has transparent-background `resources/icon.png` and synced `resources/icon.ico`, Forge points `packagerConfig.icon` at the extensionless base path, makers point to platform-specific icon files, and non-macOS `BrowserWindow` uses the PNG runtime path.
- Base: Linux/dev runtime icon works via `BrowserWindow.icon`, while macOS keeps using the default until a real `resources/icon.icns` can be generated.
- Bad: A generated icon remains only under a local agent directory such as `$CODEX_HOME/generated_images`; packaged builds cannot consume it.
- Bad: Copying `resources/icon.png` into the repo but not wiring Forge config, so packaged apps still use the placeholder.

### 6. Tests Required

- Static asset checks:
  - Run `file resources/icon.png resources/icon.ico`.
  - Run a pixel check such as `magick resources/icon.png -format '%[channels] %[pixel:p{0,0}]' info:` and assert the PNG uses alpha channels with transparent outer corners.
  - Run `identify resources/icon.ico` and assert expected sizes are present.
- Quality checks:
  - Run `pnpm lint`.
  - Run `pnpm typecheck`.
- Package smoke when packaging is in scope:
  - Run `pnpm package`.
  - Assert packaged resources include `resources/icon.png`.
  - Launch the packaged binary on Linux/Windows and verify the window/installer icon is not the Electron placeholder.
- macOS-specific check:
  - If `resources/icon.icns` exists, package on macOS and verify the `.app` bundle icon.

### 7. Wrong vs Correct

#### Wrong

```typescript
const config: ForgeConfig = {
  packagerConfig: {
    extraResource: ['drizzle'],
  },
  makers: [new MakerSquirrel({}), new MakerDeb({})],
};
```

This leaves packaged app and installer icons at their defaults.

#### Correct

```typescript
const iconBasePath = path.resolve(projectRoot, 'resources', 'icon');
const pngIconPath = `${iconBasePath}.png`;
const icoIconPath = `${iconBasePath}.ico`;

const config: ForgeConfig = {
  packagerConfig: {
    icon: iconBasePath,
    extraResource: ['drizzle', 'resources'],
  },
  makers: [
    new MakerSquirrel({ setupIcon: icoIconPath }),
    new MakerDeb({ options: { icon: pngIconPath } }),
    new MakerAppImage({ options: { categories: ['Education'], icon: pngIconPath } }),
  ],
};
```

Pair packaged resource copying with a main-process runtime path when `BrowserWindow` needs an icon:

```typescript
function getWindowIconPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'resources', 'icon.png');
  }

  return path.join(app.getAppPath(), 'resources', 'icon.png');
}
```

---

## 常见问题排查

### 问题 1：`Cannot find module 'better-sqlite3'`

**原因**：Native module 未被正确打包。

**检查步骤**：

```bash
# 1. 确认 .npmrc 配置正确
cat .npmrc
# 应该包含：
# node-linker=hoisted
# shamefully-hoist=true

# 2. 重新安装依赖
rm -rf node_modules pnpm-lock.yaml
pnpm install

# 3. 检查 node_modules 结构
ls -la node_modules/better-sqlite3
# 应该是实际目录，不是符号链接

# 4. 重建 native modules
pnpm rebuild better-sqlite3
```

### 问题 2：`NODE_MODULE_VERSION mismatch`

**错误信息**：

```
Error: The module was compiled against a different Node.js version
```

**原因**：Native module 是为 Node.js 编译的，不是 Electron。

**解决**：

```bash
# 强制重建所有 native modules
npx electron-rebuild -f

# 或在 forge.config.ts 中设置
rebuildConfig: {
  force: true,
}
```

### 问题 3：Monorepo 中找不到共享包

**原因**：Workspace 协议配置问题。

**解决**：

```json
// apps/desktop/package.json
{
  "dependencies": {
    "@my-app/shared": "workspace:*"
  }
}
```

确保 `pnpm-workspace.yaml` 包含了共享包路径。

### 问题 4：打包后应用启动失败

**调试步骤**：

```bash
# 1. 查看打包产物
ls -la out/*/resources/

# 2. 检查 asar 内容
npx asar list out/*/resources/app.asar

# 3. 检查 unpacked 文件
ls -la out/*/resources/app.asar.unpacked/

# 4. 运行打包后的应用并查看日志
# macOS
./out/MyApp-darwin-x64/MyApp.app/Contents/MacOS/MyApp

# Windows
./out/MyApp-win32-x64/MyApp.exe
```

### 问题 5：pnpm install 后 electron-rebuild 失败

**原因**：可能是 Python 或 C++ 构建工具缺失。

**解决**：

```bash
# macOS
xcode-select --install

# Windows（管理员 PowerShell）
npm install --global windows-build-tools

# 或者安装 Visual Studio Build Tools
```

---

## 最佳实践

### 1. 锁定 Electron 版本

```json
// package.json
{
  "devDependencies": {
    "electron": "28.0.0" // 使用精确版本，不用 ^
  }
}
```

### 2. 使用 packageManager 字段

```json
// package.json
{
  "packageManager": "pnpm@8.15.0",
  "engines": {
    "node": ">=18.0.0",
    "pnpm": ">=8.0.0"
  }
}
```

### 3. CI/CD 配置

```yaml
# .github/workflows/build.yml
jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [macos-latest, windows-latest, ubuntu-latest]

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build
        run: pnpm build

      - name: Package
        run: pnpm package
```

### 4. 开发脚本

```json
// apps/desktop/package.json
{
  "scripts": {
    "dev": "electron-forge start",
    "build": "tsc && vite build",
    "package": "electron-forge package",
    "make": "electron-forge make",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit",
    "postinstall": "electron-rebuild"
  }
}
```

---

## 配置检查清单

新建 Electron + pnpm 项目时：

- [ ] 创建 `.npmrc`，包含 `shamefully-hoist=true` 和 `node-linker=hoisted`
- [ ] 创建 `pnpm-workspace.yaml`（如果是 monorepo）
- [ ] 添加 `postinstall` 脚本运行 `electron-rebuild`
- [ ] 在 `forge.config.ts` 中配置 `rebuildConfig.force = true`
- [ ] 在 Vite 配置中将 native modules 设为 external
- [ ] 在 `packagerConfig.ignore` 中正确处理 node_modules
- [ ] 测试打包：`pnpm package` 后运行打包产物

---

## 参考资源

- [pnpm Documentation](https://pnpm.io/)
- [Electron Forge](https://www.electronforge.io/)
- [electron-rebuild](https://github.com/electron/rebuild)
- [Native Module Packaging Guide](../big-question/native-module-packaging.md)
