# Bump version to v0.1.6 and release

## Goal

Prepare Inkline v0.1.6 and run the existing release path as far as available credentials allow.

## What I Already Know

- The requested target version is `v0.1.6`.
- The repository package version currently lives in `package.json`.
- `CHANGELOG.md` says versions follow the app version in `package.json`.
- Existing release tags include `v0.1.0` through `v0.1.5`, plus v0.1.5 pre-release tags.
- `.github/workflows/app-build.yml` runs on `v*` tags and on published GitHub releases.
- A published GitHub Release triggers the workflow path that uploads generated app artifacts back to the release.
- Local `gh auth status` reports an invalid GitHub CLI token, so GitHub Release creation may require another authenticated path or user follow-up.

## Assumptions

- "Release" means use the repository's existing release mechanism: commit the version bump, create/push the `v0.1.6` tag, and create a GitHub Release when credentials allow.
- This task should not change product behavior, UI, provider settings, database schema, or application logic.
- Release notes should summarize user-visible and release-relevant changes since `v0.1.5`.

## Requirements

- Update the app version to `0.1.6`.
- Add a `0.1.6` entry to `CHANGELOG.md`.
- Preserve existing package manager and Electron Forge release conventions.
- Run the appropriate quality checks for a release-only change.
- Build or package artifacts through the existing scripts when feasible.
- Create the `v0.1.6` release tag only after version changes are committed.
- Publish a GitHub Release for `v0.1.6` if an authenticated tool is available; otherwise leave clear next steps.

## Acceptance Criteria

- [ ] `package.json` reports version `0.1.6`.
- [ ] `CHANGELOG.md` contains a top-level `0.1.6` entry.
- [ ] Formatting, lint, typecheck, tests, and release-relevant build checks pass or any blocker is documented.
- [ ] The work commit contains only the release preparation changes.
- [ ] `v0.1.6` tag points at the release commit if tagging succeeds.
- [ ] GitHub Release publication either succeeds or the credential blocker is documented.

## Definition of Done

- Version metadata and release notes are updated.
- Quality and packaging commands have been run or blockers are recorded.
- Commit/tag/release state is clear in the final handoff.

## Out of Scope

- New product features.
- Backfilling historical changelog entries for `0.1.1` through `0.1.5`.
- Changing GitHub Actions workflows unless the existing release path is broken.

## Technical Notes

- `package.json` scripts include `pnpm check`, `pnpm package`, and `pnpm make`.
- `pnpm make` is the distributable artifact command, but platform-native maker requirements may limit local artifact creation.
- The app-build workflow builds Windows, macOS, and Linux artifacts in GitHub Actions.
