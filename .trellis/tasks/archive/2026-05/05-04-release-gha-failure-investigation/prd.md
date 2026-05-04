# Investigate latest release GitHub Actions failures

## Goal
Fix Linux release build failure and macOS artifact cannot-open issue for release workflow.

## Requirements
- Linux AppImage maker must use executable name `Inkline` (方案 B).
- macOS release artifacts should be signed/notarized when credentials are provided, to prevent "is damaged and can't be opened" on end-user machines.
- Keep local/dev build working without requiring signing secrets.

## Acceptance Criteria
- [ ] Linux `pnpm make` no longer fails with missing executable `inkline` in AppImage maker.
- [ ] Forge config supports macOS signing/notarization through env vars.
- [ ] Workflow passes Apple credentials/secrets to make step on macOS release CI.
