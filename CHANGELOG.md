# Changelog

All notable changes to Writing Practice are documented here.

This project uses a simple Keep a Changelog style. Versions follow the app version in `package.json`.

## [0.1.0] - 2026-04-29

### Added

- Added the local-first Electron desktop app foundation with Vite, React, TypeScript, SQLite, Drizzle migrations, and type-safe IPC.
- Added the Practice flow with local database initialization, template selection, writing attempts, writing revisions, and autosave.
- Added Journal, CET-4 Writing, CET-6 Writing, and Free Writing as same-level practice templates.
- Added optional AI starter prompt/topic generation with one-time provider disclosure, regenerate, retry, and skip behavior.
- Added review agent boundary and review contract validation for structured review output.
- Added template-aware review preview and save flow with provider disclosure, one focus pattern, hint-first self-repair, positive feedback, anchored corrections, reference rewrite, and explicit learning-history persistence.
- Added stale review handling when the current writing changes after a review.
- Added D+1 rewrite practice in Practice with pending, submit, and skip behavior.
- Added local settings and credential boundaries, including raw model response storage defaulting off and provider key status through the OS keychain.
- Added review contract harness and Vitest coverage for database, writing revision, review validation, review persistence, rewrite practice, settings, and integration behavior.

### Changed

- Generalized journal-oriented product, IPC/API, service, review-input, and schema naming to writing-oriented terminology. This is a development-stage schema rebuild/reset, not a production-safe migration for existing local journal data.
- Loaded Electron Forge main and preload Vite bundles as CommonJS `.cjs` outputs so packaged and development builds work correctly in an ESM package.
