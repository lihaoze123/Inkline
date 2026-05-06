# CET Practice Refinements

## Goal

Make CET-4 and CET-6 practice feel more intentional and exam-scenario-aware while keeping Inkline's shared writing/review/rewrite/check engine as the product center. This should improve scenario framing and user guidance, not create mock-exam mode.

## What I Already Know

- The user asked to continue after completing and archiving the Drill Center foundation.
- The roadmap Horizon 3 next item after Drill Center foundation is "CET-specific practice refinements without making Inkline a mock-exam simulator by default."
- `WRITING_TEMPLATES` already includes `cet4` and `cet6` with titles, descriptions, starter prompt behavior, review focus, and `scenarioContext`.
- `Practice` already supports switching templates through the weak editor chrome, saving one draft per template, starter prompt generation, review, and rewrite practice through shared code paths.
- Review input is already template-aware: it includes selected template title, review focus, scenario context, generated prompt/topic, optional user goal/topic, and writing content.
- Starter prompt generation already receives template metadata and explicitly forbids word-count targets, timers, scores, and mock-exam instructions.
- Product specs explicitly say CET/scenario tracks should be first-class practice paths over the shared engine, not separate exam-mode flows by default.
- v0.1/v0.2 scope forbids timers, word-count pressure, precise CET scores, mock-exam mode, in-editor suggestions, and heavy dashboards.

## Recommended MVP

Build a thin CET framing layer in the existing Practice workspace:

- Add template-aware scenario guidance near the editor when the selected template is CET-4 or CET-6.
- Keep Journal, CET-4, CET-6, and Free Writing equal in the template switcher.
- Show practical CET focus cues such as task response, organization, clarity/coherence, and useful language pattern focus.
- Improve CET starter prompt/user-goal copy so users know they can generate an English CET-style topic or write from their own topic.
- Keep guidance lightweight and non-blocking; the editor remains the dominant surface.
- Do not add timers, word-count targets, scores, rubrics, mock-exam flow, or a separate review engine.
- Do not change database shape, provider configuration, rewrite task kinds, or review output schema.

## Why This MVP

- It makes CET practice more visible without breaking the existing shared engine.
- It aligns with the roadmap's "scenario/exam practice built on proven patterns" direction.
- It avoids expensive/fragile exam-mode semantics before the product explicitly prioritizes timed scoring or official rubric simulation.
- It can be validated with focused renderer tests and existing service tests for template-aware starter/review behavior.

## Requirements

- UI:
  - When `selectedTemplateId` is `cet4` or `cet6`, show a compact CET guidance strip or panel in Practice.
  - Guidance must be visually quiet and consistent with Inkline's editorial workspace.
  - Guidance must not duplicate the selected template label already shown beside `Draft`.
  - Guidance must fit desktop and mobile widths without overlapping the editor or coach panel.
  - Guidance copy must avoid timers, word-count targets, precise scores, "mock exam", or official-score claims.
  - Free Writing and Journal must not receive CET-specific guidance.

- Product semantics:
  - CET remains a scenario track over the same writing attempt, review, pattern archive, rewrite task, and rewrite-check engine.
  - CET refinements may guide what to think about before writing, but must not block independent writing.
  - CET refinements must not introduce live suggestions, in-editor correction, or AI co-writing.
  - Review still returns exactly one focus pattern and uses the existing validation caps.

- Data/API:
  - Reuse existing `WritingTemplate` metadata when possible.
  - No database migrations.
  - No new IPC channels.
  - No provider/runtime configuration changes.
  - No review schema changes.

## Acceptance Criteria

- [ ] CET-4 and CET-6 show distinct, lightweight scenario guidance in the Practice workspace.
- [ ] Journal and Free Writing do not show CET-specific guidance.
- [ ] Template switcher still treats all four templates as same-level practice paths.
- [ ] CET guidance does not use timers, word-count targets, scores, or mock-exam wording.
- [ ] Existing starter prompt flow still saves unsaved draft/goal before provider calls.
- [ ] Existing review flow still sends template-aware context and remains on the selected template.
- [ ] Focused renderer tests cover CET-4 guidance, CET-6 guidance, non-CET absence, and forbidden exam-mode wording.
- [ ] Existing template/starter/review tests continue to pass.
- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass.

## Out of Scope

- Timed writing mode.
- Word-count goals or word-count pressure.
- Precise CET scores or official rubric scoring.
- Mock-exam mode.
- Separate CET review engine.
- New review output schema fields.
- New starter prompt provider behavior beyond copy/context refinements.
- Scenario packs beyond CET-4/CET-6 framing.
- New database tables or migrations.

## Confirmed Decision

- User confirmed starting with a conservative CET Practice workspace refinement, not a mock-exam flow.

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
  - `.trellis/spec/product/review-agent-contract.md`
  - `src/shared/writing/templates.ts`
  - `src/renderer/App.tsx`
  - `src/renderer/components/WritingEditorCard.tsx`
  - `src/renderer/components/PracticeHeader.tsx`
  - `src/renderer/components/PracticeTemplatePicker.tsx`
  - `src/renderer/components/types.ts`
  - `src/main/services/writing/service.ts`
  - `src/main/services/review/lib/prompt.ts`
  - `test/writing-starter-prompt.test.ts`
- Existing `PracticeTemplatePicker` is present but not currently rendered in `App.tsx`; the current template switcher lives inside `WritingEditorCard`.
- Existing `getPracticePromptTitle` already provides fallback CET prompt titles.
- Existing starter prompt rules already forbid exam-mode mechanics.
