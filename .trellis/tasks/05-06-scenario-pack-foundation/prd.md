# Scenario Pack Foundation

## Goal

Add the first scenario pack surface so users can quickly start practical writing situations such as school essays, work updates, applications, travel, and free expression while reusing the existing Free Writing template, user goal/topic field, starter prompt flow, review flow, and durable learning engine.

## What I Already Know

- The user asked to continue after completing and archiving CET Practice Refinements.
- Roadmap Horizon 3 next item is "Scenario packs for school essays, work updates, applications, travel, and free expression."
- Roadmap also requires scenario/exam tracks to stay first-class over the shared writing/review/rewrite/check engine.
- Existing templates are limited to `journal`, `cet4`, `cet6`, and `free`.
- The MVP scope still forbids user-created/editable templates, in-editor AI co-writing, live suggestions, mock-exam mode, heavy dashboards, and new parallel engines.
- `WritingAttemptSnapshot.userGoal` already persists an optional practice goal/topic per template and is included in starter prompt generation and review input.
- `WritingEditorCard` already renders a collapsible "Prompt and goal" area with a `Practice goal` input.
- Starter prompt generation already saves unsaved content/goal first and passes template metadata plus `userGoal`.
- Review input already includes template context and `userGoal`.
- The recent CET refinement added template-aware guidance and tests using `renderToStaticMarkup`.

## Recommended MVP

Add a renderer-only scenario pack picker inside the existing `Prompt and goal` area for the `free` template:

- Show compact scenario chips for:
  - School essay
  - Work update
  - Application
  - Travel
  - Free expression
- Selecting a scenario writes a concise editable goal/topic into the existing `Practice goal` input via `onUserGoalChange`.
- The selected goal remains normal user-editable text and persists through the existing autosave path.
- Scenario chips do not call the provider, generate a prompt, create a new template, or save a separate scenario entity.
- Journal, CET-4, and CET-6 do not show the scenario pack picker.

## Why This MVP

- It makes scenario practice visible immediately.
- It uses existing durable data flow (`userGoal`) instead of adding premature template/scenario schema.
- It keeps starter prompt and review context naturally scenario-aware because both already receive `userGoal`.
- It avoids adding a parallel scenario engine before track-level prompt/review/rewrite semantics are defined.

## Requirements

- UI:
  - Render a quiet scenario pack picker only when `selectedTemplateId === 'free'`.
  - Keep the picker compact and consistent with the editorial writing workspace.
  - Use semantic buttons, not nested interactive controls.
  - Clicking a scenario chip updates the existing `Practice goal` input.
  - Existing user goal text remains editable after selecting a scenario.
  - The scenario picker must not obscure the generated prompt or editor.
  - The picker must not appear for Journal, CET-4, or CET-6.

- Product semantics:
  - Scenario packs are preset goal/topic seeds for Free Writing, not new templates.
  - Scenario packs must not replace independent writing with outlines or model-written content.
  - Scenario packs must not imply scoring, levels, timers, official rubrics, or course tracks.
  - Scenario packs must not affect learning evidence directly.
  - Review still returns exactly one focus pattern and uses the existing caps.

- Data/API:
  - Reuse `WritingAttemptSnapshot.userGoal`.
  - Reuse existing `saveWritingAttempt`, `generateStarterPrompt`, and review input flows.
  - No new database tables or migrations.
  - No new IPC channels.
  - No provider/runtime configuration changes.
  - No review output schema changes.

## Acceptance Criteria

- [ ] Free Writing shows scenario pack chips for school essay, work update, application, travel, and free expression.
- [ ] Clicking a scenario chip updates the Practice goal input with editable scenario text.
- [ ] Journal, CET-4, and CET-6 do not show the scenario pack picker.
- [ ] Scenario packs do not trigger starter prompt generation or provider calls directly.
- [ ] Scenario packs do not introduce new template IDs, database fields, IPC channels, or review schema fields.
- [ ] Scenario pack copy avoids timers, scores, levels, official rubrics, mock-exam language, and AI-written outline promises.
- [ ] Focused renderer tests cover Free Writing scenario rendering, non-Free absence, goal update behavior, and forbidden wording.
- [ ] Existing starter prompt and review tests continue to pass.
- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass.

## Out of Scope

- New template IDs.
- User-created/editable scenario packs.
- Persisting selected scenario as a separate field.
- Scenario-specific review schemas or reviewer engines.
- Scenario-specific rewrite task kinds.
- Scenario-specific provider calls.
- On-demand drill generation from scenarios.
- Course tracks, levels, scores, official rubrics, or dashboards.
- Prompt libraries that draft outlines or essays for the user.

## Confirmed Decision

- User confirmed starting with Free Writing scenario presets that seed `userGoal`, not a new template/scenario data model.

## Open Question

- None.

## Definition of Done

- PRD and implementation context are curated.
- Trellis implement/check agents run for implementation and quality review.
- Tests added/updated for changed behavior.
- Lint, typecheck, and tests pass.
- Spec docs updated if new product/UI contract is established.
- Work commits are created before finish-work archival/journal commits.

## Technical Notes

- Files inspected:
  - `.trellis/spec/product/roadmap.md`
  - `.trellis/spec/product/mvp-scope.md`
  - `.trellis/spec/product/learning-flow.md`
  - `src/shared/writing/templates.ts`
  - `src/shared/types/writing.ts`
  - `src/renderer/components/WritingEditorCard.tsx`
  - `src/main/services/writing/service.ts`
  - `test/writing-editor-cet-guidance-render.test.tsx`
- Existing `userGoal` autosaves through `saveWritingAttempt({ templateId, content, userGoal })`.
- Existing starter prompt generation sends selected template and optional goal/topic only after starter disclosure.
- Existing review input sends selected template, generated prompt/topic, optional goal/topic, and writing content after review disclosure.
