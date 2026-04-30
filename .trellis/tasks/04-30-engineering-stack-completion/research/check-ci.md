# Research: Local Quality Gates and CI for pnpm TypeScript React Electron Forge Vitest

- **Query**: Research engineering best practices for local quality gates and CI in a pnpm + TypeScript + React + Electron Forge + Vitest project. Compare 2-4 common patterns (single check script, separate CI jobs, build/package smoke, dependency cache). Map recommendations to this repo: Electron desktop app, package scripts already include lint/typecheck/test/review:harness/build.
- **Scope**: mixed
- **Date**: 2026-04-30

## Findings

### Files Found

| File Path | Description |
|---|---|
| `package.json` | Defines package manager, Node/pnpm engines, and current quality/build scripts. |
| `.npmrc` | Configures pnpm for Electron/native-module compatibility with hoisted node_modules. |
| `eslint.config.js` | ESLint flat config with TypeScript, React Hooks rules, and strict local code-quality rules. |
| `tsconfig.json` | Strict TypeScript configuration used by `pnpm typecheck`. |
| `forge.config.ts` | Electron Forge Vite packaging configuration and native module rebuild behavior. |
| `vite.main.config.ts` | Main-process Vite build config, CJS output, and native module externals. |
| `vite.preload.config.ts` | Preload Vite build config with `.cjs` output. |
| `vite.renderer.config.ts` | Renderer Vite config with React, Tailwind, and aliases. |
| `.trellis/spec/product/validation-and-testing.md` | Project testing contract for lint/typecheck/test/review harness/dev smoke expectations. |
| `.trellis/spec/shared/code-quality.md` | Shared rule requiring lint and typecheck before commit. |
| `.trellis/spec/shared/pnpm-electron-setup.md` | Electron + pnpm native module and package smoke guidance. |

### Current Repo Baseline

- Package manager and engine constraints are explicit: `packageManager` is `pnpm@10.23.0`, Node is `>=22.0.0`, and pnpm is `>=9.0.0` (`package.json:59-63`).
- Existing scripts already expose the core local/CI gates (`package.json:8-18`):
  - `lint`: `eslint .`
  - `typecheck`: `tsc --noEmit`
  - `test`: `vitest run`
  - `review:harness`: `tsx scripts/review-contract-harness.ts`
  - `build`/`package`: `electron-forge package`
  - `make`: `electron-forge make`
- No `.github/` directory was found, so this repo currently has no GitHub Actions workflow checked in.
- The repo uses pnpm settings that are important for Electron/native modules: `node-linker=hoisted`, `shamefully-hoist=true`, `strict-peer-dependencies=false`, and `prefer-offline=true` (`.npmrc:1-4`).
- Electron Forge package config rebuilds native modules with `rebuildConfig.force = true` and unpacks native binaries (`forge.config.ts:9-17`).
- Native modules are externalized from the main process bundle: `electron`, `better-sqlite3`, and `keytar` (`vite.main.config.ts:10-12`).

### Code Patterns

#### Pattern 1: Single local `check` script

Common shape:

```json
{
  "scripts": {
    "check": "pnpm lint && pnpm typecheck && pnpm test && pnpm review:harness"
  }
}
```

How it maps here:

- The current scripts already provide all components needed for a local aggregate check (`package.json:8-18`).
- Project specs require lint, typecheck, tests, and review harness for relevant changes (`.trellis/spec/product/validation-and-testing.md:131-137`, `.trellis/spec/product/validation-and-testing.md:139-148`).
- Shared quality guidance states lint and typecheck must pass before every commit (`.trellis/spec/shared/code-quality.md:54-63`).

Tradeoffs:

- Simple for developers and pre-commit/manual use.
- Sequential execution makes the first failure obvious.
- Slower than parallel CI because all checks run in one process chain.
- Best as the local command developers run before handoff; CI can still split jobs for faster diagnosis.

#### Pattern 2: Separate CI jobs or separate CI steps for lint/typecheck/test/domain harness

Common shape:

```yaml
jobs:
  quality:
    steps:
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm review:harness
```

or, for larger repositories:

```yaml
jobs:
  lint: { ... pnpm lint ... }
  typecheck: { ... pnpm typecheck ... }
  test: { ... pnpm test ... }
  review-harness: { ... pnpm review:harness ... }
```

How it maps here:

- `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm review:harness` are already first-class scripts (`package.json:10-14`).
- The product validation contract names those commands directly (`.trellis/spec/product/validation-and-testing.md:109-117`).
- `review:harness` is a domain-specific executable contract, not just an ordinary unit test (`.trellis/spec/product/validation-and-testing.md:27-65`).

Tradeoffs:

- Separate steps in one job reuse one install and are easy to read.
- Separate jobs improve parallelism and isolate failures, but duplicate checkout/install unless a dependency cache is effective.
- Keeping `review:harness` visible as its own CI step/job preserves the product contract rather than hiding it inside `test`.

#### Pattern 3: Build/package smoke for Electron Forge

Common shape:

```yaml
- run: pnpm build
```

For this repo, `build` is already `electron-forge package` (`package.json:14-15`), so it is a packaging smoke test rather than only a web/Vite build.

How it maps here:

- Electron Forge packages main, preload, and renderer through the Vite plugin (`forge.config.ts:19-38`).
- The project-specific pnpm/Electron spec explicitly requires a package smoke for the ESM/CJS output contract: run `pnpm run package` and assert `.vite/build/index.cjs` and `.vite/build/preload.cjs` exist (`.trellis/spec/shared/pnpm-electron-setup.md:377-388`).
- The same spec says a good package case is that `pnpm run package` generates both CJS outputs and Electron launches without ESM/CJS startup errors (`.trellis/spec/shared/pnpm-electron-setup.md:370-375`).

Tradeoffs:

- Catches Electron Forge/Vite/native-module packaging problems that lint, typecheck, and Vitest do not catch.
- Can be slower and more OS-sensitive than unit tests.
- For this app, packaging smoke is particularly relevant because it uses native modules (`better-sqlite3`, `keytar`) and Electron-specific pnpm hoisting.
- A full `make` matrix is heavier than a package smoke; `pnpm build`/`pnpm package` is the lighter CI gate already available.

#### Pattern 4: Dependency cache with frozen lockfile

Common shape:

```yaml
- uses: pnpm/action-setup@v4
  with:
    version: 10.23.0
- uses: actions/setup-node@v4
  with:
    node-version: 22
    cache: pnpm
- run: pnpm install --frozen-lockfile
```

How it maps here:

- The repo has a committed `pnpm-lock.yaml` and a `packageManager` field (`package.json:63`), so CI can install deterministically.
- The repo requires Node >=22 (`package.json:59-60`), so CI should use Node 22 or newer.
- pnpm's CI behavior commonly uses frozen lockfile semantics; explicit `--frozen-lockfile` makes that contract clear in workflow YAML.
- Caching the pnpm store is compatible with the repo's `prefer-offline=true` setting (`.npmrc:4`), while installation must still run because Electron native modules need postinstall/rebuild behavior.

Tradeoffs:

- Cache reduces CI install time while preserving lockfile reproducibility.
- Cache should not replace `pnpm install --frozen-lockfile`; install still validates lockfile and runs lifecycle steps such as `postinstall: electron-rebuild` (`package.json:17`).
- Native Electron dependencies can make caches OS-specific; using the standard setup-node pnpm cache keeps cache keys tied to lockfile and platform.

### External References

- [pnpm CI documentation](https://pnpm.io/continuous-integration) — documents CI setup patterns and package manager setup for pnpm projects.
- [pnpm `pnpm install` documentation](https://pnpm.io/cli/install) — documents lockfile/frozen-lockfile behavior used for deterministic CI installs.
- [GitHub Actions `actions/setup-node`](https://github.com/actions/setup-node) — documents `cache: 'pnpm'` support for dependency caching.
- [pnpm/action-setup](https://github.com/pnpm/action-setup) — official pnpm setup action for GitHub Actions.
- [Vitest CLI documentation](https://vitest.dev/guide/cli) — `vitest run` is the non-watch test mode suitable for CI.
- [Electron Forge packaging documentation](https://www.electronforge.io/cli#package) — `electron-forge package` packages the application and is the command behind this repo's `build` script.
- [Electron Forge Vite plugin documentation](https://www.electronforge.io/config/plugins/vite) — relevant because this repo packages main, preload, and renderer via Forge's Vite plugin.

### Related Specs

- `.trellis/spec/product/validation-and-testing.md` — names `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm review:harness`, and `pnpm dev` as validation commands for product work.
- `.trellis/spec/shared/code-quality.md` — requires lint and typecheck before commit.
- `.trellis/spec/shared/pnpm-electron-setup.md` — records pnpm hoisting requirements, Electron native-module rebuild needs, and package/dev smoke expectations.

## Caveats / Not Found

- No GitHub Actions workflow was found under `.github/`, so CI mapping here is based on current scripts/spec contracts rather than an existing workflow.
- No `check` script currently exists in `package.json`; the repo currently exposes separate scripts only.
- No dedicated `vitest.config.*` file was found; `pnpm test` uses Vitest defaults unless config is loaded through another mechanism not present in the root search.
- This research did not run the quality gates or packaging commands; it only mapped available scripts, configuration, specs, and common CI patterns.
