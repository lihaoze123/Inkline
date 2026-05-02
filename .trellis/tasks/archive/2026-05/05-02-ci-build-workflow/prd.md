# Add GitHub Actions App Build Workflow

## Goal

Add a GitHub Actions workflow that automatically builds desktop application distributable formats for the three supported operating systems: Windows, macOS, and Linux.

## What I Already Know

* The user asked to add an Action workflow that automatically compiles the app formats for three platforms.
* The app is an Electron Forge + Vite desktop app using pnpm.
* `package.json` declares Node.js `>=22.0.0`, pnpm `>=9.0.0`, and package manager `pnpm@10.23.0`.
* Existing scripts include `pnpm check`, `pnpm package`, and `pnpm make`.
* `pnpm make` runs Electron Forge makers.
* `forge.config.ts` configures Squirrel for Windows, ZIP for macOS, and DEB/RPM for Linux.
* The repo already has `.github/workflows/ci.yml` for Ubuntu-only quality checks on `push` to `main` and `pull_request`.
* Existing CI uses `actions/checkout@v4`, `pnpm/action-setup@v4`, `actions/setup-node@v4`, Node 22, pnpm 10.23.0, and `pnpm install --frozen-lockfile`.
* Existing CI installs `libsecret-1-dev` on Ubuntu before dependency installation for native keytar support.

## Assumptions

* "Three platforms" means GitHub-hosted Windows, macOS, and Linux runners.
* "Application formats" means Electron Forge maker outputs from `pnpm make`, not merely unpacked app directories from `pnpm package`.
* The workflow should upload build outputs as GitHub Actions artifacts.
* The workflow should automatically trigger for tag/release flows and support manual dispatch from `main`.
* Code signing, notarization, package publishing, and auto-update release publishing are out of scope unless explicitly requested.

## Open Questions

* None.

## Requirements

* Add a GitHub Actions workflow under `.github/workflows/`.
* Trigger the workflow automatically for version tags and GitHub release events.
* Support manual `workflow_dispatch` runs so `main` builds can be started on demand.
* Run the build as a matrix across Windows, macOS, and Linux runners.
* Install pnpm and Node.js according to the repository's package manager and engine expectations.
* Install dependencies with the committed lockfile.
* Reuse the existing CI setup style where practical.
* Run or depend on repository quality checks before producing release-style artifacts.
* Run Electron Forge makers to produce distributable platform artifacts.
* Upload the generated output for each platform as Actions artifacts.

## Acceptance Criteria

* [ ] The workflow file is valid YAML and lives under `.github/workflows/`.
* [ ] The workflow triggers automatically for tag/release flows.
* [ ] The workflow can be run manually from the Actions UI.
* [ ] The workflow has Windows, macOS, and Linux jobs or matrix entries.
* [ ] Each platform installs dependencies with pnpm and uses the lockfile.
* [ ] Build artifacts are produced only after the repository quality gate has passed, either in the same workflow or through job dependencies.
* [ ] Each platform runs `pnpm make`.
* [ ] Each platform uploads generated files from `out/make/**`.
* [ ] The repository still passes local lint/typecheck for changed files where applicable.

## Definition of Done

* Tests added/updated where appropriate.
* Lint / typecheck / CI configuration validation completed as far as local tooling allows.
* Docs/notes updated if behavior changes.
* Rollout/rollback considered if risky.

## Out of Scope

* Publishing GitHub Releases.
* Auto-update feeds or Electron Forge publishers.
* macOS notarization and code signing.
* Windows certificate signing.
* Changing Electron Forge maker configuration unless the current makers cannot run in CI.

## Decision (ADR-lite)

**Context**: The app needs reproducible distributable artifacts for Windows, macOS, and Linux, but building all three platforms on every pull request would spend more CI minutes than the current request requires.

**Decision**: Add a dedicated app build workflow that runs automatically for version tags and published releases, and supports manual `workflow_dispatch` runs so builds from `main` can be started on demand.

**Consequences**: Pull requests still rely on the existing CI quality workflow by default; cross-platform packaging failures surface when a tag/release build runs or when a developer manually dispatches the app build workflow.

## Technical Notes

* `package.json` scripts:
  * `check`: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm review:harness`
  * `make`: `electron-forge make`
* `forge.config.ts` makers:
  * Windows: `MakerSquirrel`
  * macOS: `MakerZIP({}, ['darwin'])`
  * Linux: `MakerRpm`, `MakerDeb`
* Build outputs are expected under Electron Forge's default `out/` directory.
* Linux build runners need `libsecret-1-dev` before `pnpm install`, and `fakeroot` plus `rpm` before `pnpm make`.
* GitHub Actions artifact names must be unique per matrix entry.
* Missing `out/make/**` files should fail the workflow, not upload an empty artifact.
* Unsigned Windows/macOS artifacts are acceptable for CI artifact output, but public distribution would need separate signing/notarization work.

## Research References

* [`research/electron-forge-actions-build.md`](research/electron-forge-actions-build.md) — Three-OS Electron Forge + pnpm Actions workflow pattern, native module constraints, maker dependencies, and artifact upload caveats.
