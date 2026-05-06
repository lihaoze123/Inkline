# Technical Design

## Proposed API Surface

Add shared schemas/types in `src/shared/types/learning-assets.ts` or a small adjacent shared module:

```ts
type ExportLearningHistoryInput = {
  includeRawProviderOutput?: boolean;
};

type LearningHistoryExportResult =
  | {
      success: true;
      canceled: false;
      filePath: string;
      manifest: LearningHistoryExportManifest;
      includeRawProviderOutput: boolean;
      byteSize: number;
    }
  | { success: true; canceled: true }
  | { success: false; error: string };

type PreviewLearningHistoryImportResult =
  | {
      success: true;
      canceled: false;
      filePath: string;
      manifest: LearningHistoryExportManifest;
    }
  | { success: true; canceled: true }
  | { success: false; error: string };
```

Preload:

```ts
window.api.learningAssets.exportLearningHistory(input?: ExportLearningHistoryInput): Promise<LearningHistoryExportResult>;
window.api.learningAssets.createLearningHistoryBackup(input?: ExportLearningHistoryInput): Promise<LearningHistoryExportResult>;
window.api.learningAssets.previewLearningHistoryImport(): Promise<PreviewLearningHistoryImportResult>;
```

## Service Shape

Prefer a focused module under `src/main/services/learning-assets/` if `service.ts` is too large:

- `export-history.ts` for snapshot, manifest, serialization, backup/write helpers.
- Keep IPC handlers thin: parse shared input schema, call service, parse output schema.
- Allow test injection for dialog/filesystem paths where practical so tests do not need real Electron dialogs.

## Export Format

Use a stable first-version envelope:

```json
{
  "format": "inkline-learning-history",
  "formatVersion": 1,
  "appName": "Inkline",
  "appVersion": "0.1.6",
  "exportedAt": 1770000000000,
  "manifest": {
    "formatVersion": 1,
    "exportedAt": 1770000000000,
    "includeRawProviderOutput": false,
    "counts": {
      "writingAttempts": 0,
      "writingRevisions": 0,
      "reviewRuns": 0,
      "errorPatterns": 0,
      "corrections": 0,
      "notebookEntries": 0,
      "selfRepairAttempts": 0,
      "referenceRewrites": 0,
      "rewriteTasks": 0,
      "rewriteChecks": 0,
      "learningEvents": 0
    },
    "tablesChecksum": "sha256:..."
  },
  "tables": {}
}
```

The checksum should be computed over a deterministic JSON serialization of `tables`. It is acceptable for this first version to use the insertion order from the fixed table list plus `JSON.stringify`.

## Privacy Boundary

- Do not export `settings`, credential statuses, keychain data, provider API keys, request headers, or app config.
- `reviewRuns.summaryJson.providerDiagnostics` may already contain bounded metadata and can remain as part of `reviewRuns`.
- `reviewRuns.rawOutputJson` is the sensitive field. Default output must null it or omit it; tests should assert the raw string is absent from the serialized file.
- Learning event payloads are already compact by contract and should be exported as stored.

## Import Preview Boundary

- Validate envelope and tables with Zod.
- Recompute table counts and checksum. If manifest counts/checksum disagree, return a failure.
- Return only preview metadata to renderer.
- Do not call `db.insert`, `db.update`, `db.delete`, or transaction APIs in the preview path.

## UI Notes

- Add Learning history controls in Settings below Review behavior and above the welcome intro.
- Use existing Settings message/error state for feedback. A path returned from main process is okay to show as selectable text.
- Optional raw output inclusion can be a small checkbox or explicit secondary action, but default button behavior must exclude raw output.

## Testing Notes

- Service tests can use an in-memory fake database with `.select().from(...).all()` patterns similar to existing learning-assets tests, or test pure snapshot/serialization helpers directly.
- Mock Electron `dialog` and `app.getPath('userData')` in service/IPC tests if needed.
- Update `test/renderer-boundary.test.ts` expectations only if the static boundary needs new allowed shared imports; renderer must still not import filesystem/Electron main modules.
