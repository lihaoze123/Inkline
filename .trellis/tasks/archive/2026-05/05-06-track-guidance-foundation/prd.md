# Track Guidance Foundation

## Goal

Add a conservative track-level guidance foundation so Journal, CET-4, CET-6, and Free Writing can shape starter prompts, review focus, and D+1 rewrite practice prompts while still reusing the same writing attempt, review validation, rewrite task, rewrite-check, pattern archive, and learning-history engine.

## What I Already Know

- The user asked to continue the roadmap work after completing Drill Center, CET Practice refinements, and Scenario Pack foundation.
- Roadmap Horizon 3 calls for "Track-level guidance that changes prompts, review focus, and rewrite tasks while reusing the same learning-history engine."
- Roadmap track strategy allows tracks to vary entry points, starter prompt policy, review focus, scenario framing, rewrite task prompts, and progress framing.
- The same roadmap requires tracks to reuse writing attempts/revisions, review flow and validation, pattern archive, rewrite tasks, rewrite-check outcomes, and mastery/spaced-reuse semantics.
- Current writing templates already expose `starterPromptBehavior`, `reviewFocus`, and optional `scenarioContext`.
- Starter prompt generation already passes template title, description, starter behavior, review focus, scenario context, and optional user goal/topic.
- Review input already stores template id, title, review focus, optional scenario context, generated prompt/topic, and optional user goal/topic.
- The review prompt already instructs the agent to generate one `rewrite_original` task, but there is no explicit track-specific rewrite practice guidance.
- MVP scope forbids a parallel exam engine, mock-exam mode, timers, word-count pressure, precise CET scores, and user-created/editable templates.

## Recommended MVP

Add optional shared template metadata named `trackGuidance` and thread it through existing prompt construction paths:

- `trackGuidance.starterPromptFocus`: how starter prompt/topic generation should frame this track.
- `trackGuidance.reviewLens`: how review should prioritize feedback within the existing one-focus-pattern contract.
- `trackGuidance.rewritePracticeFocus`: how the single D+1 `rewrite_original` task should be phrased for this track.

Populate the metadata for all four built-in templates:

- Journal: reflective daily expression, natural sentence flow, and one transferable everyday pattern.
- CET-4: concise everyday response, clear position, simple organization, and one accurate reusable pattern.
- CET-6: argument clarity, coherent progression, useful evidence/reasoning, and precise expression pattern practice.
- Free Writing: user intention, practical scenario fit, natural expression, and one reusable improvement pattern.

Use the metadata in:

- Starter prompt user prompt construction.
- Review input schema and review input snapshots.
- Review user prompt context.
- Review prompt rules for shaping the one `rewrite_original` task.

Keep the review output schema unchanged. The agent still returns at most one `rewriteTasks` item with `kind: "rewrite_original"`.

## Why This MVP

- It implements the roadmap item at the shared-engine layer instead of creating per-track workflows.
- It centralizes track guidance in template metadata so starter, review, and rewrite prompts cannot drift independently.
- It gives CET and Free Writing a stronger first-class feel without introducing mock-exam behavior, new templates, database fields, or separate engines.
- It keeps future D+3/D+7 new-context reuse free to consume the same track metadata later without committing this task to new spaced-task generation.

## Requirements

- Shared template model:
  - Add an optional `trackGuidance` object to the shared `WritingTemplate` schema.
  - Validate each guidance string as non-empty when the object exists.
  - Keep `trackGuidance` optional so existing snapshots and fallback objects remain backward compatible.
  - Populate `trackGuidance` for Journal, CET-4, CET-6, and Free Writing.

- Starter prompt generation:
  - Include `starterPromptFocus` in the starter prompt user prompt when available.
  - Preserve the existing starter prompt behavior and rules.
  - Starter prompt generation must still send only template context and optional user goal/topic, not essay content.
  - Starter prompt generation must not create outlines, draft user essays, timers, word-count targets, scores, official rubrics, or mock-exam instructions.

- Review input and prompt:
  - Extend review input `writingTemplate` to include optional `trackGuidance`.
  - Pass `trackGuidance` from the selected template when building review input.
  - Include `reviewLens` and `rewritePracticeFocus` in the review prompt context when available.
  - Keep the existing review caps and exactly-one-focus-pattern contract.
  - Tell the review agent to shape the one `rewrite_original` task according to `rewritePracticeFocus`.
  - Treat writing content as untrusted text exactly as before.

- Product semantics:
  - Tracks remain first-class context over one shared learning engine.
  - No track-specific review output schema.
  - No track-specific rewrite task kind.
  - No new progress/evidence semantics.
  - No provider/runtime configuration changes.

## Acceptance Criteria

- [ ] `WritingTemplate` exposes optional `trackGuidance` with `starterPromptFocus`, `reviewLens`, and `rewritePracticeFocus`.
- [ ] All built-in writing templates provide track guidance and still pass the shared template schema.
- [ ] Starter prompt prompt text includes relevant track starter guidance.
- [ ] Review input snapshot includes selected template `trackGuidance`.
- [ ] Review prompt text includes track review lens and rewrite practice focus when available.
- [ ] Review prompt still requests at most one `rewrite_original` task and does not change review output schema.
- [ ] No new database tables, migrations, IPC channels, provider settings, provider calls, template IDs, rewrite task kinds, or UI surfaces are introduced.
- [ ] Tests cover shared template schema validity, starter prompt prompt text, review input snapshot construction, and review prompt text.
- [ ] Existing starter prompt, review, rewrite practice, and renderer template tests continue to pass.
- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm review:harness` pass.

## Out of Scope

- User-created or editable templates.
- New template IDs.
- New database fields or migrations.
- New IPC channels.
- New provider/runtime settings.
- Track-specific review output fields.
- Track-specific rewrite task kinds.
- D+3/D+7 new-context generation.
- Progress framing UI.
- Mock-exam mode, timers, word-count pressure, precise CET scores, official scoring/rubrics, levels, dashboards, or gamification.
- UI changes unless a test fixture needs a minimal type adjustment.

## Confirmed Decision

Use shared optional `trackGuidance` metadata on built-in writing templates and thread it into starter prompt, review input, review prompt, and rewrite-task prompt instructions. Do not add new persistence, IPC, provider, output-schema, or UI behavior in this task.

## Open Question

- None.

## Definition of Done

- PRD and implementation context are curated.
- User confirms the recommended MVP.
- Trellis implementation and quality review run for this task.
- Tests added or updated for changed behavior.
- Lint, typecheck, unit tests, and review harness pass.
- Spec docs updated if the new track-guidance contract should become durable project knowledge.
- Work commits are created before finish-work archival/journal commits.

## Technical Notes

- Files inspected:
  - `.trellis/spec/product/roadmap.md`
  - `.trellis/spec/product/mvp-scope.md`
  - `.trellis/spec/product/learning-flow.md`
  - `.trellis/spec/product/review-agent-contract.md`
  - `.trellis/spec/product/validation-and-testing.md`
  - `src/shared/types/writing.ts`
  - `src/shared/writing/templates.ts`
  - `src/shared/review-contract/schemas.ts`
  - `src/main/services/writing/service.ts`
  - `src/main/services/review/lib/input.ts`
  - `src/main/services/review/lib/review-input.ts`
  - `src/main/services/review/lib/prompt.ts`
  - `src/main/services/review/procedures/start.ts`
- Existing review contract already allows template-aware context, but its documented `ReviewInput.writingTemplate` shape does not yet mention `trackGuidance`.
- Review output `rewritePracticeKindSchema` under `src/shared/review-contract/schemas.ts` currently only allows `rewrite_original`; this task should preserve that.
- Writing snapshot rewrite practice kinds already include future `new_context_reuse`, but this task must not create those tasks.
