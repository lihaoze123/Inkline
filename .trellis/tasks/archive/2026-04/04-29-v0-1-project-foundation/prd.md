# v0.1 project foundation

## Goal

Create the baseline Electron/Vite/React/TypeScript application foundation for the local-first English journal coach, with the right process boundaries and privacy-safe defaults before feature work begins.

## Requirements

- Set up an Electron app with Vite, React, TypeScript strict mode, and type-safe preload/contextBridge IPC.
- Establish main-process ownership of database, filesystem, settings, provider calls, and keychain access.
- Establish renderer ownership of UI only; do not expose Node/Electron APIs directly to renderer code.
- Initialize local SQLite infrastructure and migration workflow for v0.1 tables.
- Add Settings shell for provider/model, pi-mono auth status, database location, raw response setting, and reserved AnkiConnect status.
- Store API keys outside ordinary SQLite, preferably OS keychain.
- Production default: raw model response storage off.
- Add scripts for lint, typecheck, test, and app dev run.

## Acceptance Criteria

- [ ] App boots in development with Electron + renderer.
- [ ] Type-safe IPC path exists through preload/contextBridge.
- [ ] SQLite opens in an environment-isolated local app data directory.
- [ ] Settings can display provider/model/raw-response defaults even if provider integration is not implemented yet.
- [ ] API key storage path avoids ordinary SQLite tables.
- [ ] `npm`/`pnpm` scripts exist for lint, typecheck, test, and dev.
- [ ] Typecheck and lint pass.

## Definition of Done

- Tests or smoke checks prove app startup and database initialization.
- No renderer direct access to Node/Electron APIs.
- Raw model response default is off for production configuration.

## Technical Approach

Use the existing Trellis Electron specs as the scaffold guide. Keep feature code minimal: this task should create the architecture rails that later tasks use.

## Out of Scope

- Full Today page UX.
- Live review agent calls.
- Review result validation harness.
- Complete schema for all v0.2 tables.
- Anki, CET, drill, dashboard, or apply-correction flows.

## Technical Notes

- Product references: `.trellis/spec/product/mvp-scope.md`, `.trellis/spec/product/privacy-security.md`.
- Electron references: `.trellis/spec/frontend/ipc-electron.md`, `.trellis/spec/backend/environment.md`, `.trellis/spec/backend/database.md`.
