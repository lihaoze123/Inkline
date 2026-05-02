# Research: Electron Forge GitHub Actions Build Workflow

- Query: GitHub Actions workflow patterns for Electron Forge + pnpm desktop apps producing Windows, macOS, and Linux distributable artifacts from `out/make`.
- Scope: mixed
- Date: 2026-05-02

## Findings

### Files Found

- `package.json` - Defines the desktop app package metadata, pnpm version, Node engine, Forge scripts, Electron Forge makers, and native module dependencies.
- `forge.config.ts` - Configures Electron Forge packaging, native module copy hook, rebuild behavior, and Squirrel/ZIP/RPM/DEB makers.
- `.github/workflows/ci.yml` - Existing Ubuntu-only quality workflow that establishes the current action style and Linux `libsecret` install precedent.
- `.npmrc` - Configures pnpm hoisted `node_modules`, which is important for Electron Forge dependency discovery.
- `vite.main.config.ts` - Externalizes native/runtime modules from the main-process Vite bundle.
- `src/main/services/credentials/service.ts` - Lazy-loads `keytar` and converts missing keychain support to unavailable status instead of startup failure.
- `.trellis/spec/shared/pnpm-electron-setup.md` - Project guidance for pnpm + Electron packaging and native module handling.
- `.trellis/spec/big-question/native-module-packaging.md` - Project contract for Forge + Vite native runtime modules.

### Repo Constraints

- The package manager is pinned to `pnpm@10.23.0`, and package engines require Node `>=22.0.0` (`package.json:63`, `package.json:67`).
- The existing `make` script is `electron-forge make`; build artifacts should come from Forge's Make step rather than a custom archive path (`package.json:17`, `package.json:19`).
- The installed Forge stack is `@electron-forge/*` `^7.10.2`, with makers for DEB, RPM, Squirrel.Windows, and ZIP (`package.json:25`-`package.json:31`).
- Runtime native modules include `better-sqlite3` and `keytar` (`package.json:35`, `package.json:38`).
- The project already uses hoisted pnpm layout (`.npmrc:1`-`.npmrc:4`), matching local Trellis guidance that Electron packaging needs a flat/hoisted `node_modules` shape for native module resolution (`.trellis/spec/shared/pnpm-electron-setup.md:21`-`.trellis/spec/shared/pnpm-electron-setup.md:27`).
- `vite.main.config.ts` externalizes `better-sqlite3` and `keytar`; Forge must therefore copy those runtime packages into packaged output (`vite.main.config.ts:10`-`vite.main.config.ts:12`).
- `forge.config.ts` already copies `better-sqlite3`, `bindings`, `file-uri-to-path`, and `keytar` into the packaged app (`forge.config.ts:11`-`forge.config.ts:12`, `forge.config.ts:29`-`forge.config.ts:42`).
- `forge.config.ts` unpacks native binaries from ASAR and rebuilds only `better-sqlite3`, leaving optional `keytar` copied but not rebuilt (`forge.config.ts:18`-`forge.config.ts:27`).
- Linux CI already installs `libsecret-1-dev` before `pnpm install`, which is required for keytar builds on Debian/Ubuntu (`.github/workflows/ci.yml:28`-`.github/workflows/ci.yml:29`).
- `keytar` is lazy-loaded and returns unavailable state when it cannot load, so CI build workflows should not force `keytar` rebuilds on unsupported/misconfigured runners (`src/main/services/credentials/service.ts:35`-`src/main/services/credentials/service.ts:40`, `src/main/services/credentials/service.ts:61`-`src/main/services/credentials/service.ts:76`).

### External References

- Electron Forge's build lifecycle says `electron-forge make` first packages, then creates distributables, and places Make outputs under `/out/make/`. It also states that Forge runs makers only for the current platform/architecture by default and recommends CI with Windows, macOS, and Linux machines for cross-platform builds. Reference: https://www.electronforge.io/core-concepts/build-lifecycle
- Forge Makers generate platform-specific distributable formats and can be constrained with a `platforms` field. Reference: https://www.electronforge.io/config/makers
- Squirrel.Windows generates `{appName} Setup.exe`, `{appName}-full.nupkg`, and `RELEASES`, and can only be built on Windows or Linux with Mono/Wine. For this repo, prefer `windows-latest` to avoid Wine/Mono complexity and to compile native modules on the target OS. Reference: https://www.electronforge.io/config/makers/squirrel.windows
- ZIP maker has no platform-specific dependencies, but this repo configures it only for `darwin`, so it should be expected from the macOS matrix job. Reference: https://www.electronforge.io/config/makers/zip
- RPM maker requires Linux with `rpm` or `rpm-build`; on Debian/Ubuntu runners, install `rpm`. Reference: https://www.electronforge.io/config/makers/rpm
- DEB maker requires Linux or macOS with `fakeroot` and `dpkg`; on Ubuntu runners, install `fakeroot` and rely on `dpkg` availability or install it explicitly. Reference: https://www.electronforge.io/config/makers/deb
- Electron native modules need recompilation against Electron's ABI; Electron Forge uses `@electron/rebuild` automatically in development and making distributables. Reference: https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules
- Electron Forge supports pnpm as of Forge `v7.7.0`, but notes packaging requires `node_modules` to be on disk and that its module resolution does not account for symlinked dependencies/PnP. This supports keeping the repo's hoisted pnpm setup. Reference: https://www.electronforge.io/
- `keytar` uses `libsecret` on Linux and documents `sudo apt-get install libsecret-1-dev` for Debian/Ubuntu. Reference: https://atom.github.io/node-keytar/
- `pnpm/action-setup` can install an exact pnpm version; the current upstream docs say the version is optional when `packageManager` is present, but this repo should still pass `10.23.0` explicitly for readability and parity with existing CI. Reference: https://github.com/pnpm/action-setup
- `actions/setup-node` supports `cache: pnpm`, does not cache `node_modules`, and should be paired with committed lockfiles and `pnpm install --frozen-lockfile`. Reference: https://github.com/actions/setup-node
- GitHub Actions matrix jobs can run the same build across `windows-latest`, `macos-latest`, and `ubuntu-latest`. Reference: https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax
- `actions/upload-artifact` accepts directory/wildcard paths, can fail on empty artifact matches via `if-no-files-found: error`, and matrix jobs need unique artifact names because artifact uploads are immutable and cannot be mutated by multiple jobs. Current upstream docs show newer major examples, while the current repo uses v4-era actions. Reference: https://github.com/actions/upload-artifact

### Recommended Workflow Pattern

Use a separate `build` job with a three-OS matrix:

```yaml
jobs:
  build:
    name: Build ${{ matrix.name }}
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        include:
          - name: windows
            os: windows-latest
          - name: macos
            os: macos-latest
          - name: linux
            os: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10.23.0

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install Linux native and maker dependencies
        if: runner.os == 'Linux'
        run: sudo apt-get update && sudo apt-get install -y libsecret-1-dev fakeroot rpm

      - run: pnpm install --frozen-lockfile

      - run: pnpm make

      - uses: actions/upload-artifact@v4
        with:
          name: electron-forge-${{ matrix.name }}-${{ github.sha }}
          path: out/make/**
          if-no-files-found: error
          retention-days: 14
```

Keep the build matrix separate from the existing `quality` job unless the implementation intentionally wants a single workflow gate. For release workflows, use `needs: quality` so distributables are only built after lint/typecheck/tests pass; for pull requests, running build without `needs` is faster but spends more CI minutes.

### Artifact Expectations

- Windows job should upload Squirrel.Windows outputs from `out/make`, including setup executable, NuGet package, and `RELEASES`.
- macOS job should upload ZIP output from `out/make` because `MakerZIP` is configured for `darwin`.
- Linux job should upload both `.rpm` and `.deb` outputs from `out/make` after installing `rpm` and `fakeroot`.
- Use unique artifact names per matrix row. Do not upload all matrix results into one shared artifact name.
- Use `if-no-files-found: error`; missing outputs should fail the build workflow rather than producing a green CI run with no desktop artifact.

### Code Patterns

- Existing CI already follows the action order needed by build jobs: checkout, pnpm setup, Node setup with pnpm cache, OS packages, `pnpm install --frozen-lockfile` (`.github/workflows/ci.yml:14`-`.github/workflows/ci.yml:32`).
- Keep Linux `libsecret-1-dev` before `pnpm install` so `keytar` dependency install has the required headers (`.github/workflows/ci.yml:28`-`.github/workflows/ci.yml:32`).
- Add Linux maker packages before `pnpm make`: `fakeroot` for DEB and `rpm` for RPM.
- Reuse the existing package script `pnpm make` instead of invoking `electron-forge make` directly (`package.json:19`).
- Do not alter `forge.config.ts` native module packaging as part of CI workflow setup unless a build failure proves a packaging defect; the current hook matches the Trellis native-module contract (`forge.config.ts:18`-`forge.config.ts:42`, `.trellis/spec/big-question/native-module-packaging.md:173`-`.trellis/spec/big-question/native-module-packaging.md:188`).

### Related Specs

- `.trellis/spec/shared/pnpm-electron-setup.md` - Requires hoisted pnpm configuration for Electron native module packaging and describes rebuild needs.
- `.trellis/spec/big-question/native-module-packaging.md` - Requires copied native packages, ASAR unpacking for `.node`/`.dll`, and lazy handling for optional `keytar`.

## Caveats / Not Found

- No active Trellis task was set (`task.py current --source` returned none), but the user supplied the exact research path under `.trellis/tasks/05-02-ci-build-workflow/research/`.
- I did not find an existing build-artifact workflow; the repo currently has only the Ubuntu quality workflow at `.github/workflows/ci.yml`.
- Unsigned Windows Squirrel and unsigned/not-notarized macOS ZIP artifacts are suitable as CI artifacts but may trigger OS warnings when distributed to users. Release distribution likely needs separate signing/notarization work.
- `macos-latest` currently resolves to Apple Silicon in GitHub's hosted-runner docs, while `macos-15-intel` is the Intel label. If the intended deliverable is Intel macOS ZIP, use an Intel macOS runner or configure explicit arch strategy.
- Current upstream action docs show newer majors for some actions (`checkout`, `setup-node`, `pnpm/action-setup`, `upload-artifact`) than this repo currently uses. The recommended snippet keeps v4 actions for consistency with the existing workflow; upgrading action majors should be a separate compatibility decision.
- Linux native packaging on Ubuntu should install `libsecret-1-dev`, `fakeroot`, and `rpm`; if Forge or transitive native builds require additional compiler/toolchain packages, inspect the failing CI logs rather than pre-installing broad packages.
