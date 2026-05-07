# Active Pattern New-Context Foundation

## Goal

Add an optional way for starter prompt generation to use the learner's active saved patterns as context, so new writing prompts can invite natural reuse of patterns the learner is already working on without creating evidence-affecting rewrite tasks or a separate drill engine.

## What I Already Know

- The user asked to continue after the Track Guidance Foundation was completed and archived.
- Roadmap Horizon 3 next item is "Optional new-context generation using the user's active patterns."
- The app already has a durable pattern archive from saved reviews and exposes active pattern snapshots through `listErrorPatterns()`.
- `selectActiveReviewPatterns()` already returns active, non-merged, non-spelling patterns ordered by count and recency for review context reuse.
- Starter prompt generation currently sends selected template context and optional user goal/topic only; it does not send essay content.
- The previous track-guidance task added template `trackGuidance.starterPromptFocus`, `reviewLens`, and `rewritePracticeFocus`.
- D+3/D+7 `new_context_reuse` infrastructure already exists in `writing/service.ts` for delayed transfer after correct rewrite checks.
- Existing D+3/D+7 transfer tasks are evidence-affecting and should not be duplicated by this optional starter-prompt feature.
- The product must remain local-first and user-authored. Prompt generation may shape the task, but must not write the answer, outline the essay, create scores, or simulate mock exams.

## Recommended MVP

Add an opt-in active-pattern context switch to starter prompt generation:

- In Practice, show a quiet optional control near the prompt/goal controls when active patterns exist.
- The control asks starter prompt generation to consider a small bounded set of active patterns.
- The selected option is UI state only; it does not persist to the writing attempt.
- `generateStarterPrompt` receives `useActivePatterns?: boolean`.
- When `useActivePatterns === true`, the main service pulls a small capped list from `selectActiveReviewPatterns()` and includes compact pattern context in the starter prompt request.
- When false or no active patterns exist, existing starter prompt behavior remains unchanged.

The generated prompt should invite a fresh writing situation where the selected active patterns could be reused naturally. It must not tell the learner exactly which correction to write, leak hidden fingerprints/contracts, create a fill-in-the-blank drill, or change learning evidence.

## Why This MVP

- It directly implements the "optional new-context generation using active patterns" roadmap item without disturbing the delayed-transfer engine.
- It reuses the existing active pattern archive and starter prompt provider path.
- It keeps learner authorship intact: the app generates a context, not the answer.
- It avoids adding new database schema, rewrite task kinds, D+3/D+7 generation behavior, or Progress evidence semantics.

## Requirements

- Product behavior:
  - Active-pattern context is optional and off by default.
  - The option is available only when there are active saved patterns.
  - The option affects starter prompt generation only.
  - Generated prompts should remain concise and suitable for the selected template.
  - Pattern context should be framed as natural reuse opportunity, not mechanical drilling.

- Data/API:
  - Extend `GenerateStarterPromptInput` with optional `useActivePatterns?: boolean`.
  - Keep the field optional for backward compatibility with preload, tests, and older callers.
  - Do not persist this option to `writing_attempts`.
  - Do not add database tables, migrations, IPC channels, provider settings, template IDs, review output fields, or rewrite task kinds.
  - Do not expose hidden pattern fingerprints or prompt contracts to starter prompt generation.
  - Use a capped active-pattern list, with a recommended cap of 3.

- Starter prompt service:
  - Continue requiring starter disclosure before provider calls.
  - Continue saving unsaved draft/goal before generation through the existing renderer flow.
  - Continue sending no essay/writing content to starter prompt generation.
  - When active-pattern context is enabled, include pattern category, rule, canonical example, and at most a small recent-example hint if needed.
  - Preserve existing track guidance and user goal/topic behavior.
  - Add rules forbidding answer drafting, outlines, copyable answer sentences, scores, timers, word-count targets, official rubrics, and mock-exam instructions.

- UI:
  - Add a compact optional control inside the existing prompt/goal surface.
  - The control must not look like a required checklist, score mode, or separate drill center.
  - It should be disabled or hidden when no active patterns exist.
  - It should not trigger a provider call by itself; only the existing Create/Refresh prompt action calls the provider.

## Acceptance Criteria

- [ ] `GenerateStarterPromptInput` accepts optional `useActivePatterns`.
- [ ] Existing callers/tests without `useActivePatterns` continue to pass.
- [ ] Starter prompt generation includes capped active-pattern context only when `useActivePatterns` is true and active patterns exist.
- [ ] Starter prompt generation never sends essay/writing content.
- [ ] The renderer exposes a quiet optional active-pattern control near prompt/goal generation when active patterns exist.
- [ ] Toggling the option does not persist extra state and does not call the provider directly.
- [ ] Generated prompt rules keep writing user-authored and forbid outlines, copyable answer sentences, timers, word-count targets, scores, official rubrics, and mock-exam instructions.
- [ ] No new DB schema/migration, IPC channel, provider setting, template ID, review output field, rewrite task kind, D+3/D+7 task generation path, or evidence semantics are added.
- [ ] Tests cover schema backward compatibility, service prompt context on/off behavior, UI control rendering/absence, and no direct provider call from toggling.
- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass.

## Out of Scope

- Automatic D+3/D+7 delayed transfer generation changes.
- On-demand rewrite task creation from Practice or Drill Center.
- New rewrite task kinds.
- New pattern evidence or Progress states.
- Persisting the active-pattern option to writing attempts or settings.
- User selection of individual patterns.
- Pattern fingerprints or hidden new-context prompt contracts in starter prompt generation.
- New provider/runtime configuration.
- Mock-exam, official rubric, timer, score, level, dashboard, or gamified workflow.

## Confirmed Decision

Proceed with the opt-in starter prompt context approach: add `useActivePatterns?: boolean`, pass a capped active-pattern summary into starter prompt generation only when enabled, and add a small Practice control to toggle it. Do not create rewrite tasks or change D+3/D+7 transfer generation in this task.

## Open Question

- None.

## Definition of Done

- PRD and implementation context are curated.
- User confirms the recommended MVP.
- Trellis implementation and quality review run for this task.
- Tests added or updated for changed behavior.
- Lint, typecheck, and tests pass.
- Spec docs updated if a new active-pattern prompt-generation contract should become durable project knowledge.
- Work commits are created before finish-work archival/journal commits.

## Technical Notes

- Files inspected:
  - `.trellis/spec/product/roadmap.md`
  - `.trellis/spec/product/mvp-scope.md`
  - `.trellis/spec/product/learning-flow.md`
  - `.trellis/spec/product/review-agent-contract.md`
  - `.trellis/spec/product/data-model-contract.md`
  - `.trellis/spec/product/validation-and-testing.md`
  - `src/main/services/writing/service.ts`
  - `src/main/services/learning-assets/service.ts`
  - `src/shared/types/writing.ts`
  - `src/shared/types/learning-assets.ts`
  - `src/main/ipc/handlers.ts`
  - `src/preload/index.ts`
  - `src/renderer/App.tsx`
  - `src/renderer/components/WritingEditorCard.tsx`
  - `src/renderer/components/types.ts`
  - `src/renderer/query/writing.ts`
- Existing `selectActiveReviewPatterns(database, limit)` returns active, non-merged, non-spelling patterns ordered by count and recency.
- Existing D+3/D+7 `new_context_reuse` generation is triggered after correct rewrite checks and should remain untouched except for tests that prove this feature does not call it.
