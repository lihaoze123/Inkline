# DevTools Workflow Usability Verification

## Goal

Use Chrome DevTools MCP to verify Inkline's real app workflow after the learning-assets work, then iterate code until the workflow is demonstrably usable enough for the core write-review-save-revisit loop.

## What I Already Know

- The previous task added persistent learning assets, Notebook, and Progress.
- Automated checks passed, but interactive UI smoke was not proven because Electron exited before DevTools could attach.
- The goal is not just green tests. The app must be usable in the running UI.

## Requirements

- Launch the app in a way DevTools MCP can inspect.
- Verify the user can navigate the app's core workflow surfaces:
  - Today
  - Practice
  - Notebook
  - Progress
  - Settings
- Verify Notebook and Progress are not just placeholders:
  - Empty states are understandable when no learning assets exist.
  - Seeded or persisted learning assets render as useful content when present.
- Verify the current writing workflow remains usable:
  - Writing surface is visible.
  - Template switching is reachable.
  - Autosave/status and review entry points are not visually blocked.
- If the UI, launch, or DevTools attachment fails, iterate code or launch configuration until the failure is resolved or a real external environment blocker is proven.

## Acceptance Criteria

- [x] DevTools MCP connects to a running app or renderer page.
- [x] Screenshots or accessibility snapshots verify Today, Practice, Notebook, Progress, and Settings surfaces.
- [x] Notebook empty/data state is verified through the UI.
- [x] Progress empty/data state is verified through the UI.
- [x] Any discovered UI/workflow defects are fixed and re-verified.
- [x] `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm review:harness` pass after any changes.
- [x] If packaged/dev Electron cannot stay running, the reason is identified and either fixed or documented with concrete evidence.

## Verification Evidence

- Fixed Electron startup crash: `better-sqlite3` could not open the database when the nested dev `userData` directory did not exist.
- DevTools MCP attached to `http://localhost:5173/` after `pnpm dev`; startup IPC returned `databaseReady: true`, `migrationsApplied: true`, and the dev database path.
- Accessibility snapshots verified Today, Practice, Notebook, Progress, and Settings.
- Empty Notebook and Progress states were verified before seeding learning assets.
- Seeded one notebook entry, one recurring pattern, and one due D+1 rewrite task in the dev SQLite database; DevTools snapshots verified the populated Notebook and Progress states.
- Found and fixed a stale renderer cache bug: after submitting a rewrite practice, Progress stayed on `Waiting` even though the backend returned no pending rewrite. Re-verified that Progress changes to `After review` without reloading.
- Final Practice workflow smoke: DevTools verified the template picker expands, Free Writing selection changes the editor context, typing triggers autosave, `Get Feedback` is visible, and clicking it opens the provider disclosure instead of being blocked.
- Final quality gate: `pnpm check` passed; `git diff --check` passed.

## Definition Of Done

- The workflow is judged from DevTools-observed behavior, not only from code or unit tests.
- Any code changes are committed through the Trellis workflow.

## Out Of Scope

- Live AI provider calls unless a local configured provider is already available.
- Anki sync, drill center, and full CET scoring.
- Importing real Obsidian journal data.
