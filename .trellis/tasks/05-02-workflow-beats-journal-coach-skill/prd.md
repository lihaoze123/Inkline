# Workflow Beats Journal Coach Skill

## Goal

Make Inkline's core daily writing workflow more usable and practical than using a generic agent plus the legacy `english-journal-coach` skill for the same journal-review habit. The app should win through a safer, lower-friction local workflow with durable learning assets, not by recreating every legacy skill mode at once.

## What I Already Know

- The legacy skill reviews Obsidian daily journal files and manages `error-patterns.json`, `lexicon.md`, rewrite targets, CET practice, drill modes, and Anki sync.
- Recent journal examples show the strongest legacy value is the persistent recurrence loop: pattern IDs, counts, examples, dated lexicon upgrades, and follow-up rewrite/CET prompts.
- Current Inkline already has a stronger app shell for writing: templates, autosave, local SQLite, provider disclosure, validated review previews, one focus pattern, self-repair, reference rewrite, and D+1 rewrite practice.
- Current Inkline still has placeholder Notebook and Progress pages.
- Current Inkline does not yet persist first-class error patterns. It builds `existingPatterns` from saved correction rows, so future reviews do not get a stable semantic archive equivalent to `error-patterns.json`.
- Current Inkline explicitly disables upgrade opportunities in v0.1.

## Research References

- `research/old-skill-and-journal-comparison.md`

## Requirements

- Add first-class persistent error patterns:
  - semantic app-owned `patternId`,
  - normalized `patternKey`,
  - category,
  - rule,
  - canonical example,
  - count,
  - first/last seen dates,
  - recent examples,
  - active state.
- Update save-review persistence so pattern archive updates happen atomically with correction persistence.
- Reuse existing active patterns in future review input instead of mining corrections as pseudo-patterns.
- Surface recurring patterns in the Progress page with counts, last seen date, and recent examples.
- Enable review upgrade opportunities with a small cap and persist them as Notebook entries.
- Surface saved upgrade opportunities in the Notebook page with source date, source phrase, suggested alternatives, and reason when available.
- Keep the existing writing/review/self-repair/D+1 rewrite loop intact.
- Preserve local-first and validation-first behavior. Invalid review output must not update learning assets.

## Acceptance Criteria

- [x] Saving a review with a matched pattern increments the existing pattern count and adds a recent example.
- [x] Saving a review with a new pattern suggestion creates or reuses one normalized pattern record without duplicate near-identical keys.
- [x] Future review input receives persisted active patterns, excluding spelling and respecting the existing cap.
- [x] Corrections remain linked to the pattern used or created during save.
- [x] Upgrade opportunities are allowed by the review prompt and validation cap.
- [x] Saving a review persists upgrade opportunities to a Notebook data model.
- [x] Progress page displays persisted recurring patterns with meaningful empty states.
- [x] Notebook page displays saved upgrade opportunities with meaningful empty states.
- [x] Existing tests for review validation, review save, rewrite practice, and renderer queries pass.
- [x] New or updated tests cover pattern persistence and notebook persistence.
- [x] `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm review:harness` pass.

## Verification Notes

- `pnpm lint`: pass.
- `pnpm typecheck`: pass.
- `pnpm test`: pass, 15 files / 82 tests.
- `pnpm review:harness`: pass.
- `git diff --check`: pass.
- `pnpm dev`: Vite main/preload/renderer build completed and Electron launch was reported, but the process exited before Chrome DevTools could connect to `9222`; interactive UI smoke is not claimed.
- `pnpm package`: production Vite bundles completed, then native rebuild failed because `make` is not available on PATH in the current shell. The repository `flake.nix` dev shell includes `gnumake`; this is an environment/toolchain limitation, not a TypeScript or Vite build failure.

## Definition Of Done

- The old skill comparison artifact exists and documents the concrete gap.
- The app has durable learning assets for patterns and upgrade opportunities.
- The main daily app workflow can be judged stronger than the legacy skill for the core write-review-save-revisit loop.
- Anki sync, drill center, full rewrite-check grading, and CET scoring are explicitly deferred.

## Out Of Scope

- Anki sync.
- Drill center.
- Full CET scoring and band reports.
- CET prompt alternation.
- Multi-stage D+3/D+7 spaced repetition.
- Pattern merge UI.
- Importing existing Obsidian `error-patterns.json` or `lexicon.md`.
- Applying corrections directly into the user's draft.

## Technical Notes

- Product specs already require the app to own pattern IDs, de-dup, validation, and persistence.
- `src/shared/review-contract/validation.ts` already produces `patternOperations`; save persistence should consume that validated output rather than reinterpreting raw model JSON.
- `src/main/services/review/lib/input.ts` is the current weak point for pattern reuse because it derives patterns from correction rows.
- `src/renderer/App.tsx` contains placeholder Notebook and Progress pages that can be replaced with real query-backed views.
- This is a cross-layer task touching SQLite schema, shared types, IPC, main services, renderer queries, and UI.
