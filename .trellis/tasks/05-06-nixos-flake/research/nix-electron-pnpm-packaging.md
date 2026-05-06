# Research: Nix Electron pnpm packaging

- **Query**: Research Nix flake packaging patterns for a pnpm 10 Electron Forge + Vite desktop app on NixOS, with native Node modules better-sqlite3 and keytar. Context: repo task dir is /home/chumeng/Documents/Frontend/Inkline/.trellis/tasks/05-06-nixos-flake; existing flake.nix currently only exposes an x86_64-linux FHS devShell with nodejs_24, pnpm, corepack, native build tools, and Electron runtime libraries. package.json uses pnpm@10.23.0, scripts `pnpm dev`, `pnpm package` (electron-forge package), `pnpm make`, and postinstall `electron-rebuild -o better-sqlite3,keytar`; .npmrc uses hoisted layout/shamefully-hoist. Identify 2-4 comparable Nix patterns (devShell-only FHS, `buildNpmPackage`/`importNpmLock`, `mkYarnPackage` equivalents if relevant, electron wrapper/FHS app, AppImage/deb via Forge under Nix), summarize conventions and trade-offs, map to this repo's constraints.
- **Scope**: mixed
- **Date**: 2026-05-06

## Findings

### Files Found

| File Path | Description |
|---|---|
| `flake.nix` | Current flake: hard-coded `x86_64-linux`; exposes only `devShells.${system}.default`; uses `buildFHSEnv`/`buildFHSUserEnv` with Node, pnpm/corepack, native build tools, and Electron runtime libraries. |
| `flake.lock` | Pins `nixpkgs` input to `nixos-unstable` revision `1c3fe55ad329cbcb28471bb30f05c9827f724c76`. |
| `package.json` | Electron Forge + Vite app scripts and dependency contract; `packageManager` is `pnpm@10.23.0`, Node engine is `>=22.0.0`, native modules include `better-sqlite3` and `keytar`. |
| `.npmrc` | pnpm hoisted install layout: `node-linker=hoisted`, `shamefully-hoist=true`, `strict-peer-dependencies=false`, `prefer-offline=true`. |
| `forge.config.ts` | Forge Vite config, native module copy hook, ASAR unpack settings, and DEB/AppImage maker definitions. |
| `.trellis/tasks/05-06-nixos-flake/prd.md` | Active task requirements and acceptance criteria for Nix flake packaging. |
| `.trellis/spec/shared/pnpm-electron-setup.md` | Existing project contracts for pnpm Electron native module install/rebuild and Linux Forge makers. |
| `.trellis/spec/big-question/native-module-packaging.md` | Existing project contracts for Forge/Vite native runtime module packaging. |
| Nixpkgs manual `doc/languages-frameworks/javascript.section.md` | Local nixpkgs documentation for `buildNpmPackage`, `importNpmLock`, pnpm hooks, Yarn hooks, and deprecated `mkYarnPackage`. |
| Nixpkgs examples `pkgs/by-name/an/anytype/package.nix`, `pkgs/by-name/af/affine/package.nix`, `pkgs/by-name/ap/appium-inspector/package.nix` | Comparable Electron packaging examples using Electron headers, Electron dist substitution, and wrappers around nixpkgs Electron. |

### Code Patterns

#### Repo constraints

- Current flake is a development shell only: it imports `nixpkgs` from `nixos-unstable` and fixes `system = "x86_64-linux"` (`flake.nix:4-11`), builds an FHS environment with `nodejs_24`, `pnpm`, `corepack`, `xvfb-run`, `python3`, `pkg-config`, `gcc`, `gnumake`, `libsecret`, and Electron runtime libraries (`flake.nix:13-68`), and exposes only `devShells.${system}.default = electronDevEnv.env` (`flake.nix:70-73`). A quick local eval resolves the current dev shell name to `electron-dev-env-shell-env`.
- The package manager contract is pnpm, not npm/yarn: `packageManager` is `pnpm@10.23.0` (`package.json:78`), Node engine is `>=22.0.0` (`package.json:74-76`), and scripts call Electron Forge directly: `dev`, `package`, `build`, `make`, and postinstall `electron-rebuild -o better-sqlite3,keytar` (`package.json:11-27`).
- Native modules are first-class packaging inputs: runtime dependencies include `better-sqlite3` and `keytar` (`package.json:45-48`); Forge copies `better-sqlite3`, `bindings`, `file-uri-to-path`, and `keytar` from root `node_modules` into the packaged app (`forge.config.ts:15-17`, `forge.config.ts:117-130`); `.node`/`.dll` files are unpacked from ASAR (`forge.config.ts:102-108`).
- Linux maker output is already DEB + AppImage: `MakerDeb` and `MakerAppImage` are configured with icon/bin/category options (`forge.config.ts:137-148`). The project spec states AppImage maker needs `mksquashfs`, DEB maker needs `fakeroot`/`dpkg`, and `keytar` rebuild needs `libsecret-1-dev`/`libsecret` development files (`.trellis/spec/shared/pnpm-electron-setup.md:742-756`).
- Existing project native module spec separates Vite bundling from Forge packaging: it requires native package JS in `app.asar/node_modules/<package>`, native `.node` files in `app.asar.unpacked`, copying dependency packages like `bindings` and `file-uri-to-path`, and handling optional `keytar` load failures without startup crashes (`.trellis/spec/big-question/native-module-packaging.md:123-158`, `.trellis/spec/big-question/native-module-packaging.md:166-188`).

#### Pattern 1: devShell-only FHS environment

**Convention**

- Keep the flake as an environment provider and run the existing JS toolchain inside it: `nix develop`, then `pnpm install`, `pnpm dev`, `pnpm package`, or `pnpm make`.
- Use `buildFHSEnv`/`buildFHSUserEnv` when upstream Electron tooling or downloaded binaries expect FHS library paths rather than Nix store paths.
- Include Node/pnpm/corepack, native build tools (`python3`, compiler, `pkg-config`, `make`), native dependency development libraries (`libsecret` for keytar), Electron runtime libraries (GTK, NSS, DBus, X11/Wayland-related libraries), and maker tools when running `pnpm make` (`squashfsTools`, `fakeroot`, `dpkg`, etc.).

**Trade-offs**

- Lowest friction with Electron Forge and `electron-rebuild`; preserves the project’s hoisted pnpm layout and root postinstall exactly.
- Best fit for local NixOS development and packaging smoke tests because Forge still controls its own output directory and native module copy hook.
- Least reproducible as a Nix package: dependency fetching/building happens in `node_modules` via pnpm, and `nix build` does not produce the app unless a derivation is added.
- FHS shell can mask missing Nix-level runtime wrapping because the environment supplies broad library compatibility.

**Mapping to Inkline**

- This is exactly the current flake shape, except current `targetPkgs` does not visibly include Linux maker command-line tools called out by the spec (`squashfs-tools`, `fakeroot`, `dpkg`) even though it includes `libsecret` and core Electron runtime libraries (`flake.nix:16-66`; `.trellis/spec/shared/pnpm-electron-setup.md:742-756`).
- Good baseline if MVP is `nix develop` plus documented Forge commands. It does not satisfy the PRD acceptance criterion for `nix build` producing a runnable package unless packaging is declared out of MVP (`.trellis/tasks/05-06-nixos-flake/prd.md:40-44`).

#### Pattern 2: Nixpkgs pnpm derivation with `fetchPnpmDeps` + `pnpmConfigHook`

**Convention**

- Use `stdenv.mkDerivation` (or an Electron-specific derivation) with `nativeBuildInputs = [ nodejs pnpmConfigHook pnpm_10 ... ]` and `pnpmDeps = fetchPnpmDeps { inherit pname version src; fetcherVersion = 3; hash = "..."; pnpm = pnpm_10; }`.
- Nixpkgs manual states that for projects with `pnpm-lock.yaml`, `fetchPnpmDeps` creates a fixed-output pnpm store derivation and `pnpmConfigHook` prepares the build environment to install from that store (`javascript.section.md:309-344`). It recommends pinned pnpm versions such as `pnpm_10` for reproducibility and lockfile compatibility (`javascript.section.md:346-386`).
- `pnpmInstallFlags` can encode repo-specific install layout flags such as `--shamefully-hoist` (`javascript.section.md:390-401`), and `prePnpmInstall` can set additional pnpm config (`javascript.section.md:468-485`).

**Trade-offs**

- Directly matches Inkline’s committed `pnpm-lock.yaml` and package-manager choice better than npm/yarn builders.
- More reproducible than a dev shell because dependencies are fetched through a fixed-output derivation.
- More work than devShell-only for Electron: Electron package downloads, Electron Forge cache assumptions, native module rebuilds against Electron ABI, and postinstall scripts must be controlled inside the Nix build environment.
- Native module builds need Nix inputs available during install/rebuild: `pkg-config`, compiler, `python3`, `libsecret.dev`/`libsecret`, and Electron headers/dist as appropriate. Local nixpkgs exposes `pnpm` top-level and `nodejs_24.version = 24.14.0`; `libsecret.dev.name = libsecret-0.21.7`.

**Mapping to Inkline**

- Strongest Nix-native match for pnpm 10.23.0 and `.npmrc` hoisting. It can encode `node-linker=hoisted`/`shamefully-hoist=true` either by respecting `.npmrc` or passing `pnpmInstallFlags`.
- Must account for `postinstall` running `electron-rebuild -o better-sqlite3,keytar` (`package.json:26`) and for `keytar`’s Linux `libsecret`/`pkg-config` requirements (`.trellis/spec/shared/pnpm-electron-setup.md:293-310`).
- If the derivation runs `pnpm package` rather than `pnpm make`, it can produce Forge’s unpacked Linux app output while avoiding DEB/AppImage maker tools. If it runs `pnpm make`, it must include maker system tools from the project spec.

#### Pattern 3: `buildNpmPackage`/`importNpmLock` and Yarn/`mkYarnPackage` equivalents

**Convention**

- `buildNpmPackage` packages npm-based projects by creating a reproducible npm cache from `package-lock.json` and running npm lifecycle/build/install phases (`javascript.section.md:100-160`).
- `importNpmLock` patches `package.json`/`package-lock.json` dependency references to Nix store paths and can be used as `npmDeps` with `importNpmLock.npmConfigHook` (`javascript.section.md:183-222`). It relies on `package-lock.json` integrity hashes, not a pnpm lock (`javascript.section.md:185-201`).
- Nixpkgs Yarn v1 convention is `fetchYarnDeps` plus `yarnConfigHook`, `yarnBuildHook`, and `yarnInstallHook` (`javascript.section.md:524-581`). The older `mkYarnPackage`/`yarn2nix` functions are documented as deprecated in favor of hooks/Yarn Berry tooling (`javascript.section.md:601-624`).

**Trade-offs**

- Useful reference pattern for how Nixpkgs expects JS dependencies to be made reproducible, but not a natural fit when the repo’s committed lockfile is `pnpm-lock.yaml` and `packageManager` is pnpm.
- Using `buildNpmPackage`/`importNpmLock` would require creating/maintaining a `package-lock.json` or otherwise changing the package-manager contract, which is out of scope for this task and conflicts with the PRD’s “Keep pnpm as the package manager” requirement (`.trellis/tasks/05-06-nixos-flake/prd.md:31-36`).
- Yarn hooks/`mkYarnPackage` are still less relevant because the repo has no `yarn.lock`, and `mkYarnPackage` is deprecated in current nixpkgs docs.

**Mapping to Inkline**

- Treat as comparable but mostly non-applicable. The pnpm-specific Nixpkgs hook pattern is the closer equivalent for Inkline.
- `importNpmLock.buildNodeModules` is an npm-lock development workflow for `nix-shell`/`nix develop` (`javascript.section.md:259-288`), but Inkline has a pnpm lock and already uses an FHS dev shell.

#### Pattern 4: Electron wrapper / Forge-under-Nix derivation

**Convention**

- Let upstream JS tooling build/package the Electron app, then install only the app resources into `$out` and wrap nixpkgs Electron with `makeWrapper` to launch the app’s `resources/app.asar` or app directory.
- Nixpkgs Electron examples commonly pass app resources as flags to `${lib.getExe electron}` and add Wayland/Ozone flags conditionally:
  - Anytype builds native keytar against Electron ABI with `npmFlags = [ "--nodedir=${electron.headers}" ]`, includes `pkg-config` and `libsecret`, installs app files under `$out/lib/anytype`, and wraps nixpkgs Electron with `$out/lib/anytype/` as an app argument (`anytype/package.nix:45-55`, `anytype/package.nix:85-102`).
  - Affine prepares an Electron Forge zip cache using `ELECTRON_FORGE_ELECTRON_ZIP_DIR`, copies `electron.dist` into the expected zip filename, sets `ELECTRON_SKIP_BINARY_DOWNLOAD=1`, runs its Forge make command, then wraps nixpkgs Electron around `resources/app.asar` (`affine/package.nix:165-188`, `affine/package.nix:203-215`).
  - Appium Inspector runs electron-builder with `-c.electronDist=${electron.dist}` and `-c.electronVersion=${electron.version}`, then wraps nixpkgs Electron around the built `resources/app.asar` (`appium-inspector/package.nix:38-59`).
- Nixpkgs release notes state Electron packages expose extracted headers via `electron.headers` (`rl-2505.section.md:92-95`), which is relevant for native Node modules built against Electron ABI.

**Trade-offs**

- Produces a Nix-runnable application output and avoids shipping Electron’s downloaded binary when using nixpkgs Electron as the runtime.
- Better NixOS integration than Forge-generated unpacked app alone because the wrapper can add NixOS/Wayland flags and point to store resources.
- Requires careful Electron version alignment. Inkline depends on `electron ^39.2.7`; local nixpkgs top-level `electron` exists, but the exact version/major should be checked against the lockfile before packaging. Nixpkgs examples enforce or derive Electron version/distro paths to avoid mismatches.
- Native modules must be rebuilt for Electron ABI and not plain Node ABI. `keytar` specifically needs Electron headers plus `libsecret` development inputs, as shown by Anytype (`anytype/package.nix:45-55`).
- If Forge is used during the Nix build, it may attempt Electron downloads unless `ELECTRON_SKIP_BINARY_DOWNLOAD`, `ELECTRON_FORGE_ELECTRON_ZIP_DIR`, or Forge/electron-builder dist settings are provided.

**Mapping to Inkline**

- This is the comparable pattern if MVP includes `nix build` and `nix run`. The likely shape is: pnpm-fixed dependency install, run `pnpm package` or a Forge packaging command under Nix, install `out/Inkline-linux-*` resources, and expose an app wrapper that calls nixpkgs Electron with the packaged app path.
- Inkline’s Forge config already creates a packaged app with native modules copied and ASAR unpacked (`forge.config.ts:102-130`), so the wrapper pattern can consume Forge output rather than reimplementing file layout.
- Running `pnpm make` inside Nix is a sibling variant when the desired output is `.deb`/`.AppImage`; it needs `squashfs-tools` for AppImage and `fakeroot`/`dpkg` for DEB as the project spec states (`.trellis/spec/shared/pnpm-electron-setup.md:742-776`). Those artifacts are distribution formats, not necessarily the same as a clean Nix `packages.default` output.

### External References

- Nixpkgs manual, JavaScript section, `buildNpmPackage`: `https://nixos.org/manual/nixpkgs/stable/#javascript-buildNpmPackage` — npm lockfile/cache builder pattern; local copy read at `doc/languages-frameworks/javascript.section.md:100-160`.
- Nixpkgs manual, JavaScript section, `importNpmLock`: `https://nixos.org/manual/nixpkgs/stable/#javascript-buildNpmPackage-importNpmLock` — npm-lock dependency import pattern; local copy read at `doc/languages-frameworks/javascript.section.md:183-222`.
- Nixpkgs manual, JavaScript section, pnpm: `https://nixos.org/manual/nixpkgs/stable/#javascript-pnpm` — `fetchPnpmDeps`, `pnpmConfigHook`, pinned `pnpm_10`, `pnpmInstallFlags`, and workspace guidance; local copy read at `doc/languages-frameworks/javascript.section.md:309-485`.
- Nixpkgs manual, JavaScript section, Yarn: `https://nixos.org/manual/nixpkgs/stable/#javascript-yarn` and `https://nixos.org/manual/nixpkgs/stable/#javascript-yarn2nix-mkYarnPackage` — Yarn offline hook pattern and `mkYarnPackage` deprecation; local copy read at `doc/languages-frameworks/javascript.section.md:524-624`.
- Nixpkgs examples: Anytype, Affine, Appium Inspector packages in the pinned nixpkgs checkout — demonstrate Electron headers, Electron dist substitution, and wrapper conventions for Electron desktop apps.

### Related Specs

- `.trellis/spec/shared/pnpm-electron-setup.md` — pnpm/Electron install contract; native build script allowlist, Linux `libsecret` requirement, and DEB/AppImage maker tool requirements.
- `.trellis/spec/big-question/native-module-packaging.md` — native module packaging contract for Electron Forge + Vite, including copying native module packages and ASAR unpack behavior.
- `.trellis/spec/frontend/ipc-electron.md` — renderer must not import `better-sqlite3`, `keytar`, Electron, or Node APIs directly; native modules remain main-process concerns (`.trellis/spec/frontend/ipc-electron.md:203-231`).
- `.trellis/tasks/05-06-nixos-flake/prd.md` — active task acceptance criteria for `nix develop`, possible `nix build`/`nix run`, and non-hard-coded systems.

## Caveats / Not Found

- No external web-search MCP tool was available in this run, so external references were grounded in the pinned local nixpkgs manual/source checkout and known canonical Nixpkgs manual URLs rather than fresh web search results.
- I did not run `pnpm install`, `pnpm package`, `pnpm make`, `nix build`, or `nix flake check`; this is research only.
- I did not confirm the exact top-level nixpkgs `electron` version/major against Inkline’s locked `electron ^39.2.7`; only the existence of top-level `electron` was checked. Version alignment is load-bearing for the wrapper pattern.
- I did not find an existing Inkline package derivation; current repo flake exposes only the FHS dev shell.
