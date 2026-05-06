# Drill Center Foundation

## Goal

Add the first Drill Center surface so users can intentionally find and resume targeted pattern practice from existing durable learning assets, without creating a parallel drill engine or weakening repair/transfer evidence semantics.

## What I Already Know

- The user asked to continue after completing Horizon 2 import/export and local backup.
- Roadmap Horizon 1 is archived for rewrite lifecycle, evidence model, pattern fingerprints, D+3/D+7 new-context reuse, and weak-outcome recovery.
- Roadmap Horizon 2 is archived for pattern merge/de-dup, richer lifecycle, learning event log, apply-correction revisions, and learning-history export/backup.
- Roadmap Horizon 3 starts with "Drill Center for targeted pattern drills."
- The roadmap sequencing rule forbids starting Drill Center until the learning loop has reliable delayed transfer signals. Archived tasks and current code indicate that D+3/D+7 `new_context_reuse` and evidence are now present.
- Existing `ProgressPage` already lists patterns, lifecycle labels, evidence stage, merge controls, and repair/transfer context.
- Existing Practice `LearningPanel` already renders `rewrite_original` and `new_context_reuse` practice, including D+3/D+7 transfer copy.
- Existing writing service automatically generates D+3 after D+1 `correct`, and D+7 after D+3 `correct`.
- Existing `rewrite_tasks.kind = 'pattern_detection'` exists in database/export typing, but shared renderer-facing rewrite practice kinds currently expose only `rewrite_original` and `new_context_reuse`.

## Recommended MVP

Create a Drill Center as a focused entry point over existing pattern evidence and scheduled rewrite tasks:

- Add a top-level "Drills" area to navigation.
- Show active patterns as drill candidates using `listErrorPatterns()` snapshots.
- Prioritize patterns that have an actionable next step:
  - pending/in-progress D+1 repair,
  - pending/in-progress D+3 transfer,
  - pending/in-progress D+7 spaced reuse,
  - retryable/failed/weak latest check needing attention.
- If the global current pending rewrite task matches a displayed pattern's latest repair/transfer task, show a clear action to open Practice and work on it.
- For patterns without a due task, show why no drill is ready yet and what evidence is needed next.
- Keep evidence language truthful: no score, streak, mastery claim, or activity-volume success metric.
- Do not create ad-hoc drill tasks in this first version.

## Why This MVP

- It gives users a Drill Center entry point immediately.
- It reuses the durable learning loop instead of inventing a second drill model.
- It avoids turning scenario/new-context reuse into mechanical unlimited drills before product semantics are defined.
- It keeps D+3/D+7 evidence meaningful because only scheduled transfer tasks continue to advance the evidence chain.

## Requirements

- UI:
  - Add a visible "Drills" nav item.
  - Add a `DrillCenterPage` or equivalent component.
  - Show loading, error, and empty states.
  - Show compact pattern cards with category, rule, lifecycle, evidence stage, and next actionable drill state.
  - Provide an action to open Practice when the current pending rewrite practice is the actionable task for a pattern.
  - Provide an action to open Progress when the user needs more context or merge cleanup.
  - Keep the UI dense and utilitarian, consistent with existing Inkline app surfaces.

- Data:
  - Reuse existing `useErrorPatterns` / `window.api.learningAssets.listErrorPatterns`.
  - Reuse `writing.pendingRewritePractice` from the current writing snapshot for the currently actionable practice slot.
  - Do not add database tables or migrations.
  - Do not add new provider/AI calls.

- Semantics:
  - Drill Center must treat `completed` task status separately from learning success.
  - `correct` remains the only strong success signal for repair/transfer.
  - `partly_correct`, `incorrect`, `skipped`, `snoozed`, `expired`, `failed`, and `retryable` are visible context, not success.
  - Stable patterns can still be shown, but without claiming "mastered."

## Acceptance Criteria

- [ ] A new Drills nav item opens a Drill Center page.
- [ ] Drill Center lists active patterns from existing learning assets.
- [ ] Drill Center highlights pending/in-progress/retryable repair and transfer work when present.
- [ ] Drill Center can route the user to Practice for the current pending rewrite task.
- [ ] Drill Center does not create ad-hoc rewrite tasks or call the model provider.
- [ ] Drill Center does not introduce scores, streaks, mastered language, or a parallel drill lifecycle.
- [ ] Focused renderer tests cover empty state, actionable pending practice, D+3/D+7 transfer wording, and no mastery wording.
- [ ] Query/cache behavior remains consistent with existing learning-assets hooks.
- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass.

## Out of Scope

- On-demand generation of new drill tasks.
- Pattern-detection drills.
- CET/scenario packs.
- Drill scoring, streaks, or gamification.
- A new drill database table or new rewrite task kind.
- Changing rewrite-check evaluator prompts.
- Changing D+3/D+7 generation timing.

## Confirmed Decision

- User confirmed the conservative Drill Center foundation.
- This task will not include on-demand drill generation.
- On-demand generation needs a separate PRD because it must define whether those drills affect evidence, how they avoid prompt leakage, and how they avoid becoming mechanical unlimited practice.

## Definition of Done

- Tests added/updated for changed behavior.
- Lint, typecheck, and tests pass.
- Trellis implement/check agents run for implementation and quality review.
- Spec docs updated if the Drill Center establishes new product/API/UI contracts.
- Work commits are created before finish-work archival/journal commits.

## Technical Notes

- Files inspected:
  - `.trellis/spec/product/roadmap.md`
  - `.trellis/spec/product/mvp-scope.md`
  - `src/renderer/App.tsx`
  - `src/renderer/components/ProgressPage.tsx`
  - `src/renderer/components/LearningPanel.tsx`
  - `src/main/services/learning-assets/service.ts`
  - `src/main/services/writing/service.ts`
  - `src/shared/types/writing.ts`
  - `src/shared/types/learning-assets.ts`
- Existing route model is local `activeArea` state in `App.tsx`.
- Existing pattern data already includes `evidence` and `lifecycle` summaries.
- Existing pending practice is exposed through `WritingAttemptSnapshot.pendingRewritePractice`.
- Existing shared `rewritePracticeKindSchema` exposes `rewrite_original` and `new_context_reuse`; the first Drill Center should avoid introducing a third renderer-facing practice kind.
