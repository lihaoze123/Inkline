# Implementation Notes

## Recommended Shape

Add a reset API next to the existing learning-history export APIs:

```ts
window.api.learningAssets.resetLearningHistory(input: {
  confirmationText: string;
  includeRawProviderOutput?: boolean;
}): Promise<ResetLearningHistoryResult>;
```

Suggested result shape:

```ts
type ResetLearningHistoryResult =
  | {
      success: true;
      backupFilePath: string;
      backupManifest: LearningHistoryExportManifest;
      includeRawProviderOutput: boolean;
      resetCounts: Record<LearningHistoryTableName, number>;
    }
  | { success: false; error: string };
```

Recommended service flow:

1. Parse input and require `confirmationText === 'RESET'`.
2. Count resettable tables before deletion.
3. Call `createLearningHistoryBackup({ includeRawProviderOutput })`.
4. If backup fails, return failure and do not delete.
5. In one SQLite transaction, delete user-owned writing-learning rows.
6. Return backup metadata and reset counts.

Recommended reset table set:

- `learning_events`
- `writing_attempts` (cascade should remove writing revisions, review runs, corrections, notebook entries, self-repair attempts, reference rewrites, rewrite tasks, and rewrite checks through existing foreign keys)
- `error_patterns`

If implementation needs explicit deletes because a table is not covered by cascade, delete dependent tables before parents and keep it in the same transaction.

Recommended renderer shape:

- Add a low-priority "Reset local learning data" subsection under Settings > Learning history.
- Use local input state for the confirmation phrase.
- Disable the reset button until the phrase matches exactly.
- On success, show backup file path and reset count summary.
- Invalidate/fetch:
  - current writing attempt
  - learning-assets error patterns
  - notebook entries
  - learning events
  - review/progress-derived data currently cached through those query keys

## Constraints

- No browser `confirm`, `alert`, or `prompt`.
- No deleting SQLite file, migrations, settings stores, provider config, keychain entries, or backup files.
- No restore/import execution.
- No raw provider output in backup unless explicitly requested through the existing export toggle.
- No renderer direct imports from `electron`, `node:fs`, database, keychain, or provider SDKs.
- No provider calls.

## Test Notes

Focused tests:

- Shared schema:
  - accepts exact `RESET`.
  - rejects/returns failure for incorrect confirmation.

- Service:
  - invalid confirmation leaves all rows intact and does not create backup.
  - backup failure leaves all rows intact.
  - success creates backup before deletion and clears resettable rows.
  - settings/keychain-provider data is not part of reset output.
  - reset counts are based on rows present before deletion.

- Renderer:
  - reset control is visible but disabled until confirmation phrase matches.
  - success message includes backup path and count summary.
  - reset mutation invalidates relevant queries.

## Risk Notes

- This is intentionally destructive. Keep the first version backup-first and whole-learning-data only; avoid per-table selectors that imply fine-grained restore support.
- Do not reuse import preview as restore. The existing preview-only boundary is valuable and should remain intact.
- Do not delete the database file; service-level deletes preserve migration and startup assumptions.
