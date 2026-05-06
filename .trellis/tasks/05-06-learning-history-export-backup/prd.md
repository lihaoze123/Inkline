# Learning History Export and Backup Foundation

## Goal

Give users a safe local-first way to carry and protect their Inkline learning history. This first version adds a structured JSON export, one-click local backup, and import preview/validation foundation without implementing destructive restore into the active SQLite database.

## What I Already Know

- This is the next remaining Horizon 2 roadmap item: "Import/export and local backup for user-owned learning history."
- Inkline is local-first. User writing attempts, revisions, reviews, corrections, rewrite tasks/checks, notebook entries, patterns, and learning events live in local SQLite.
- The renderer must not import `node:fs`, Electron dialog APIs, database modules, or schema modules. File dialogs and filesystem writes belong in the main process behind narrow preload IPC.
- Production raw model response storage is off by default. Any export/debug path must exclude `review_runs.raw_output_json` unless the user explicitly opts in.
- Provider API keys and other credentials live outside SQLite in OS keychain and must never be included in learning history exports.
- The existing Settings page already shows database location and privacy controls, making it the right first UI home for export/backup actions.

## Confirmed Scope

- Add a shared, schema-validated learning-history export format.
- Add main-process service logic to snapshot the user-owned learning-history tables.
- Add save-dialog based export to a user-chosen JSON file.
- Add local backup creation to an app-owned backup directory under Electron `userData`.
- Add open-dialog based import preview/validation that reads an export JSON file and returns manifest/count/version information only.
- Add Settings UI controls for export, backup, and import preview.
- Add focused tests for schema, raw-output redaction, no-secret boundaries, backup path behavior, import validation, and renderer/main boundary expectations.

## Explicitly Out of Scope

- Restoring/importing rows into the active SQLite database.
- Merging imported data with existing rows.
- Cloud sync, Anki/Obsidian export, Markdown export, or legacy app import.
- New database tables or migrations.
- Exporting provider API keys, settings snapshots, keychain data, provider request headers, or credentials.
- Auto-enabling raw response export based on the existing raw-response storage setting. Export raw output must require a separate explicit action/input.

## Requirements

- Export format:
  - Include `format`, `formatVersion`, `appName`, `appVersion`, `exportedAt`, `tables`, and `manifest`.
  - Use Unix millisecond timestamps in JSON payloads.
  - Include table arrays for:
    - `writingAttempts`
    - `writingRevisions`
    - `reviewRuns`
    - `errorPatterns`
    - `corrections`
    - `notebookEntries`
    - `selfRepairAttempts`
    - `referenceRewrites`
    - `rewriteTasks`
    - `rewriteChecks`
    - `learningEvents`
  - Preserve user-authored writing/rewrite/notebook text because this is a user-owned export.
  - Exclude `reviewRuns.rawOutputJson` by default by writing it as `null` or omitting it from exported review run rows.
  - Include `rawOutputJson` only when the caller explicitly passes `includeRawProviderOutput: true`.
  - Include manifest counts per exported table and a checksum/hash of the exported `tables` payload.

- Export action:
  - Exposed through `window.api.learningAssets.exportLearningHistory(input)`.
  - Main process opens a save dialog and writes pretty JSON.
  - Canceling the dialog returns a non-error canceled result.
  - Success returns the file path, manifest, whether raw output was included, and byte size.

- Backup action:
  - Exposed through `window.api.learningAssets.createLearningHistoryBackup(input)`.
  - Main process writes the same export format into `path.join(app.getPath('userData'), 'backups')`.
  - Backup filenames are timestamped and stable enough to sort lexically.
  - Success returns the file path, manifest, whether raw output was included, and byte size.

- Import preview action:
  - Exposed through `window.api.learningAssets.previewLearningHistoryImport()`.
  - Main process opens an open dialog, parses the selected JSON, validates the export format/version, and returns path, manifest, and table counts.
  - Invalid JSON, wrong format, unsupported version, or invalid table shape returns `{ success: false, error }`.
  - No database rows are inserted, updated, deleted, or merged.

- Settings UI:
  - Add a Learning history section with export, backup, and import-preview controls.
  - Show concise success/error feedback through the existing Settings message/error area.
  - Surface that raw provider output is excluded by default.
  - Do not use `alert`, `confirm`, `prompt`, browser file input paths, or renderer filesystem access.

## Acceptance Criteria

- [ ] Shared Zod schemas parse the export document, export/backup results, and import preview result.
- [ ] Export and backup include every required learning-history table and manifest count.
- [ ] Export and backup redact `reviewRuns.rawOutputJson` unless `includeRawProviderOutput: true` is explicitly passed.
- [ ] Export output never includes provider API keys, keychain data, or settings credential material.
- [ ] Save/open dialogs and filesystem work are contained in main-process code; renderer uses only preload IPC.
- [ ] Import preview validates a selected export file and returns counts/version without mutating SQLite.
- [ ] Settings renders the new controls and routes actions to typed handlers.
- [ ] Unit tests cover default redaction, explicit raw-output inclusion, backup path writing, canceled dialogs, invalid import preview, and renderer boundary.
- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm review:harness` pass or any blocker is recorded.

## Definition of Done

- Task status is moved to `in_progress` before implementation.
- `trellis-implement` implements the PRD and runs at least lint/typecheck.
- `trellis-check` reviews/fixes the implementation against the PRD and specs.
- Final main-session verification runs the relevant quality commands.
- Any durable new API/privacy contract is reflected in `.trellis/spec/`.
- Work commits are created before finish-work archival/journal commits.

## Technical Notes

- Existing code paths inspected:
  - `src/main/db/schema.ts` contains all learning-history tables and `review_runs.raw_output_json`.
  - `src/main/ipc/handlers.ts`, `src/preload/index.ts`, and `src/shared/constants/channels.ts` provide the narrow IPC pattern.
  - `src/main/services/learning-assets/service.ts` is the existing learning assets service and already owns pattern/notebook/event APIs.
  - `src/renderer/components/SettingsPage.tsx` is the first UI home for database/privacy controls.
  - `src/renderer/query/learning-assets.ts` holds learning-assets React Query hooks and mutations.
- Specs consulted:
  - `.trellis/spec/product/roadmap.md`
  - `.trellis/spec/product/privacy-security.md`
  - `.trellis/spec/product/data-model-contract.md`
  - `.trellis/spec/product/validation-and-testing.md`
  - `.trellis/spec/backend/api-module.md`
  - `.trellis/spec/backend/database.md`
  - `.trellis/spec/frontend/ipc-electron.md`
  - `.trellis/spec/frontend/electron-browser-api-restrictions.md`
  - `.trellis/spec/shared/typescript.md`
- Grill pass result:
  - The risky branch is full restore/import. The recommended and selected first-version answer is preview/validation only, because destructive imports are expensive to unwind and need a separate merge/restore PRD.
  - The privacy branch is raw provider output. The recommended and selected answer is a separate explicit export input, not the existing raw-response-storage setting alone.
  - The UI branch is Settings. The recommended and selected answer is Settings because it already contains database location and raw-response controls.
