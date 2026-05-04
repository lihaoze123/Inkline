# PRD: Normalize Linux executable name to lowercase

## Goal
Ensure Linux packaging uses lowercase executable binary name `inkline` while preserving product display name `Inkline` where appropriate.

## Requirements
1. Open `forge.config.ts`.
2. In `packagerConfig`, change `executableName` from `Inkline` to `inkline`.
3. In `new MakerAppImage({ options: { ... } })`, change `bin` from `Inkline` to `inkline`.
4. Search globally for executable-related settings (`executableName`, `bin`, `desktop`, `Exec=`) and confirm there are no inconsistent residual uppercase executable names.
5. Re-run Linux packaging command (`pnpm exec electron-forge make --platform=linux`) and verify AppImage generation succeeds.
6. Keep display name fields (e.g., product/app name) as `Inkline`; only executable file name should be lowercase.

## Acceptance Criteria
- `forge.config.ts` has lowercase executable identifiers for Linux binary locations (`executableName`, AppImage `bin`).
- No other executable-related config remains inconsistent with lowercase binary naming.
- Linux make command completes successfully and produces AppImage artifacts.
- Display-name fields remain unchanged as `Inkline`.
