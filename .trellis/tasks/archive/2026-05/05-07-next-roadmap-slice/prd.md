# Private Beta Data Reset Foundation

## Goal

Add a conservative private-beta reset path so external testers can create a local backup and clear their local writing-learning data without developer intervention, while preserving provider configuration, API keys, onboarding state, and app settings.

## What I Already Know

- The user asked to continue after the beta-readiness diagnostics foundation was completed, archived, and journaled.
- The current worktree was clean and there was no active task when this planning task started.
- Roadmap Horizon 5 still lists "Test data reset/export paths for private beta users."
- Learning-history export, local backup, and import preview already exist in Settings.
- Export/backup intentionally do not serialize settings snapshots, credential statuses, provider API keys, keychain values, request headers, or provider settings.
- Import preview validates selected JSON and does not mutate SQLite.
- Settings already has a Learning history section with Export JSON, Create backup, and Preview import controls.
- The app stores user-owned writing-learning data in SQLite tables such as writing attempts/revisions, review runs, corrections, notebook entries, self-repair attempts, reference rewrites, rewrite tasks/checks, error patterns, and learning events.
- Settings/provider configuration and API keys live outside that learning-history table set and should not be cleared by this private-beta reset.
- `getWritingAttempt()` lazily creates a fresh current writing attempt, so after a reset the app can return to an empty current draft without deleting the database file.
- Product constraints forbid `prompt`, `alert`, or `confirm`; destructive confirmation must be in-app UI state.

## Recommended MVP

Add a Settings "Reset local learning data" foundation under Learning history:

- The reset action creates a local backup first using the existing learning-history export format.
- If backup creation fails, no rows are cleared.
- If backup succeeds, clear only local user-owned writing-learning rows from SQLite.
- Preserve provider settings, API keys, onboarding intro state, raw-response setting, review thinking setting, database/migration state, and app settings.
- Require an explicit in-app confirmation phrase such as `RESET` before enabling the reset button.
- Return a typed result with backup file path, exported manifest/counts, and reset counts.
- After success, invalidate/refetch writing, learning-assets, review/progress-related queries so the renderer shows a fresh empty state.

## Why This MVP

- It implements the remaining private-beta Horizon 5 reset/export path without building full restore/import.
- Backup-first behavior reduces the risk of accidental data loss.
- It reuses the existing export/backup privacy boundary and JSON envelope.
- It avoids deleting the SQLite database file, migrations, settings store, or keychain data.
- It gives testers a way to clear messy test data while keeping provider setup intact.

## Requirements

- Product behavior:
  - Settings must expose reset as a low-priority danger-zone control, not as part of the normal export flow.
  - The reset button is disabled until the explicit confirmation phrase matches.
  - The action label and success copy must say a backup was created before reset.
  - The UI must make clear that provider settings and saved API keys are not reset.
  - The UI must not use browser `confirm`, `alert`, or `prompt`.

- Data/API:
  - Add a narrow learning-assets IPC/preload API for reset.
  - Reset input includes an explicit confirmation value, and optionally `includeRawProviderOutput` for the backup only.
  - Invalid confirmation returns a typed safe failure and clears no data.
  - Backup is created before any delete transaction.
  - Delete user-owned writing-learning rows only:
    - writing attempts and revisions
    - review runs and dependent review artifacts
    - corrections
    - notebook entries
    - self-repair attempts
    - reference rewrites
    - rewrite tasks and rewrite checks
    - error patterns
    - learning events
  - Preserve settings, keychain/API keys, provider configuration, onboarding state, database file, migrations, and exported backup files.
  - Reset must be transactional after backup creation starts the destructive phase.

- Privacy/security:
  - The reset result must not return API keys, settings snapshots, raw provider bodies, or writing content.
  - Raw provider output is excluded from the backup unless the existing explicit raw-output export toggle is enabled and passed to the backup step.
  - Renderer code must use preload IPC only; it must not import database, filesystem, Electron dialog, keychain, or provider SDKs.

## Acceptance Criteria

- [ ] A typed reset input/result contract exists under learning-assets shared types.
- [ ] IPC/preload exposes a reset API under `window.api.learningAssets`.
- [ ] Reset with invalid confirmation returns a safe failure and does not delete rows.
- [ ] Reset creates a backup before clearing any rows.
- [ ] Backup failure prevents deletion.
- [ ] Successful reset clears user-owned writing-learning rows and preserves settings/keychain/provider config.
- [ ] Successful reset returns backup file path, backup manifest/counts, and reset counts without writing content or secrets.
- [ ] Settings renders a danger-zone reset control gated by an explicit confirmation phrase.
- [ ] After reset success, renderer state refetches to an empty current writing attempt and cleared learning-assets views.
- [ ] Tests cover service reset success/failure/invalid confirmation, privacy boundaries, IPC/preload schema exposure, query invalidation, and Settings render behavior.
- [ ] No restore/import execution, database-file deletion, provider reset, keychain deletion, or external sync is added.
- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass.

## Out of Scope

- Full restore/import execution.
- Resetting provider settings, API keys, keychain entries, raw-response setting, review thinking setting, onboarding state, or Electron-store settings.
- Deleting the SQLite database file or migration metadata.
- Cloud sync or external ecosystem integration.
- Per-table selective reset UI.
- Undo UI beyond the backup file created before reset.
- Resetting only generated demo/test fixtures by provenance; this foundation clears local writing-learning rows as private-beta test data.

## Confirmed Decision

- Proceed with the conservative backup-first Settings reset MVP. Treat the user's `ok` on 2026-05-07 as confirmation to start implementation after curated context validation.

## Open Question

- None.

## Definition of Done

- PRD and implementation context are curated.
- User confirms the recommended MVP.
- Trellis implementation and quality review run for this task.
- Tests added or updated for changed behavior.
- Lint, typecheck, and tests pass.
- Spec docs updated if the reset contract should become durable project knowledge.
- Work commits are created before finish-work archival/journal commits.

## Technical Notes

- Files inspected:
  - `.trellis/spec/product/roadmap.md`
  - `.trellis/spec/product/mvp-scope.md`
  - `.trellis/spec/product/privacy-security.md`
  - `src/main/services/learning-assets/export-history.ts`
  - `src/main/ipc/handlers.ts`
  - `src/shared/constants/channels.ts`
  - `src/main/db/client.ts`
  - `src/main/db/schema.ts`
  - `src/main/services/writing/service.ts`
  - `src/renderer/App.tsx`
  - `src/renderer/components/SettingsPage.tsx`
  - `src/renderer/query/learning-assets.ts`
- Existing backup path writes `inkline-learning-history` JSON under Electron `userData/backups`.
- Existing export input already supports explicit raw-output inclusion.
- Existing import preview validates but never mutates SQLite; this task should preserve that boundary.
