# Implement pattern merge and de-dup flow

## Goal

Implement the first Horizon 2 maintainability slice: let the user merge duplicate saved error patterns without losing historical learning evidence, so long-term Progress and future review input stay understandable instead of noisy.

## What I already know

- Roadmap Horizon 2 starts with "Pattern merge/de-dup flow" after the delayed-transfer learning loop is stable.
- The product contract already says pattern merge is v0.2+, historical corrections keep their original pattern IDs, and display follows `merged_into_pattern_id` only when merge exists.
- Existing save-time de-dup already reuses exact `pattern_key` matches and same-category rule-similar patterns before inserting new rows.
- `error_patterns` currently has `fingerprint_json`, `active`, count/date/example fields, and a unique `pattern_key`.
- Progress reads `learningAssets.listErrorPatterns()` and evidence is derived at query time from `corrections.pattern_id` joined to rewrite tasks/checks.
- `selectActiveReviewPatterns()` already excludes inactive rows, so merged-away rows can be marked inactive and kept for traceability.

## Assumptions

- This is a v0.2/Horizon 2 product slice, not a backlog analytics/event-log feature.
- Merge must be explicit and user initiated from Progress; no automatic background merges in this task.
- Merge is conservative: source and target must be active, unmerged, distinct patterns in the same category.
- Historical corrections are not rewritten; evidence rollup resolves `source -> target` at query time.

## Requirements

- Add local schema support for pattern merge traceability:
  - `error_patterns.merged_into_pattern_id text null`
  - `error_patterns.merged_at integer timestamp_ms null`
- Add a typed shared merge request/result API:
  - Input: `{ sourcePatternId, targetPatternId }`
  - Output: discriminated success/error result with the updated target snapshot when successful.
- Implement `mergeErrorPatterns` in the learning-assets service:
  - Validate input with Zod before mutating.
  - Reject missing IDs, identical IDs, missing patterns, already-merged patterns, inactive patterns, and cross-category merges with user-safe errors.
  - In one transaction, preserve source rows, mark the source inactive, set merge metadata, update target aggregate count/date/examples, and fill target `fingerprint_json` from source only when target is missing one.
  - Do not update `corrections.pattern_id`.
  - Return a fresh target snapshot whose evidence includes source historical corrections through merge resolution.
- Update pattern read flows:
  - `listErrorPatterns` hides inactive merged-away sources by default.
  - Evidence derivation rolls source correction evidence up to the target pattern.
  - `selectActiveReviewPatterns` continues to use only active, unmerged, non-spelling patterns.
- Expose merge through IPC/preload and renderer query hooks:
  - Add a learning-assets mutation hook that invalidates `learningAssets.errorPatterns` after success.
  - Keep renderer code using `window.api`, never importing main/db modules.
- Add a minimal Progress UI flow:
  - Each pattern can choose a same-category active candidate and merge that candidate into the current target.
  - The UI must clearly show which pattern is kept and which duplicate is removed from the active list.
  - Disable self-merge and invalid choices before sending the mutation.
  - Show pending/error state without using `prompt`, `alert`, or `confirm`.

## Acceptance Criteria

- [x] Database schema and migration add merge traceability columns to `error_patterns`.
- [x] Merge API rejects invalid, inactive, already-merged, missing, same-ID, and cross-category requests without partial writes.
- [x] Successful merge keeps historical corrections unchanged, marks the source inactive, stores source merge metadata, and updates target aggregate fields.
- [x] Target evidence after merge includes source historical correction/rewrite evidence.
- [x] Progress lists only active target patterns by default and exposes a typed manual merge flow.
- [x] Future review pattern selection excludes merged-away source patterns.
- [x] Future exact-key save-time de-dup resolves merged source keys to the active target.
- [x] Tests cover service merge behavior, evidence rollup, query invalidation, migration registration, and Progress render/mutation behavior where practical.

## Definition of Done

- `pnpm check` passes.
- Task context validates with `python3 ./.trellis/scripts/task.py validate .trellis/tasks/05-06-pattern-merge-dedupe`.
- PRD acceptance criteria are updated before finish.
- Product/data-model spec is updated if the merge contract changes from the existing v0.2 placeholder.

## Out of Scope

- Automatic AI duplicate detection or bulk merge.
- Undo/restore UI for merged patterns.
- Full learning event log.
- Richer pattern status lifecycle.
- Import/export or backups.
- Apply-correction revision workflow.

## Technical Notes

- Relevant code paths inspected:
  - `src/main/db/schema.ts`
  - `src/main/services/learning-assets/service.ts`
  - `src/shared/types/learning-assets.ts`
  - `src/shared/constants/channels.ts`
  - `src/preload/index.ts`
  - `src/main/ipc/handlers.ts`
  - `src/renderer/query/learning-assets.ts`
  - `src/renderer/components/ProgressPage.tsx`
- Relevant specs inspected:
  - `.trellis/spec/product/roadmap.md`
  - `.trellis/spec/product/mvp-scope.md`
  - `.trellis/spec/product/data-model-contract.md`
  - `.trellis/spec/product/validation-and-testing.md`
  - `.trellis/spec/backend/api-module.md`
  - `.trellis/spec/backend/database.md`
  - `.trellis/spec/backend/error-handling.md`
  - `.trellis/spec/backend/type-safety.md`
  - `.trellis/spec/frontend/ipc-electron.md`
  - `.trellis/spec/frontend/hooks.md`
  - `.trellis/spec/frontend/components.md`
  - `.trellis/spec/frontend/react-pitfalls.md`
  - `.trellis/spec/shared/code-quality.md`
  - `.trellis/spec/shared/typescript.md`
  - `.trellis/spec/guides/cross-layer-thinking-guide.md`
  - `.trellis/spec/guides/db-schema-change-guide.md`
  - `.trellis/spec/guides/transaction-consistency-guide.md`

## Verification

- `pnpm check`
- `python3 ./.trellis/scripts/task.py validate .trellis/tasks/05-06-pattern-merge-dedupe`
- `git diff --check`
