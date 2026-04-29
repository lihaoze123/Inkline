# Changelog

All notable changes to English Coach are documented here.

This project uses a simple Keep a Changelog style. Versions follow the app version in `package.json`.

## [0.1.0] - 2026-04-29

### Added

- Added the local-first Electron desktop app foundation with Vite, React, TypeScript, SQLite, Drizzle migrations, and type-safe IPC.
- Added the Today journal flow with local database initialization, daily journal loading, journal revisions, and autosave.
- Added review agent boundary and review contract validation for structured review output.
- Added review preview and save flow with provider disclosure, one focus pattern, hint-first self-repair, positive feedback, anchored corrections, reference rewrite, and explicit learning-history persistence.
- Added stale review handling when the current journal changes after a review.
- Added D+1 rewrite practice on Today with pending, submit, and skip behavior.
- Added local settings and credential boundaries, including raw model response storage defaulting off and provider key status through the OS keychain.
- Added review contract harness and Vitest coverage for database, journal revision, review validation, review persistence, rewrite practice, settings, and integration behavior.

### Changed

- Loaded Electron Forge main and preload Vite bundles as CommonJS `.cjs` outputs so packaged and development builds work correctly in an ESM package.
