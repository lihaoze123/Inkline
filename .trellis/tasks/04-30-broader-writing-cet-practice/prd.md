# AI Writing Practice

## Goal

Reposition the product from a journal-centered English coach into an AI-assisted writing practice tool.

The core product is not Journal, CET, exam prep, generic English learning, or an AI correction tool. The core product is a repeatable practice loop:

1. Choose a writing practice scenario.
2. Optionally generate a starter prompt/topic with AI.
3. Write independently.
4. Get focused AI feedback.
5. Reinforce one improvement through next-day rewrite practice.

Journal, CET-4, CET-6, and Free Writing are initial scenarios that prove the generalized writing-practice loop.

## Product Positioning

* Product title direction: `Writing Practice`.
* Main entry direction: `Practice`.
* Primary narrative: writing practice.
* Supporting outcomes: English improvement, exam readiness, better feedback, expression reuse.
* AI role: practice design and feedback, not replacing the act of writing.

A suitable positioning line:

> Practice writing with focused AI feedback and next-day rewrite drills.

## Requirements

### Practice entry and templates

* Replace the journal/Today-first framing with a `Practice` entry surface.
* Show a template-picker-first experience before the editor.
* Ship four same-level initial template cards:
  * Journal
  * CET-4 Writing
  * CET-6 Writing
  * Free Writing
* Do not split templates into primary/secondary or exam/other sections in the MVP.
* Do not let Journal or CET dominate the product identity.
* Each template should define:
  * template id
  * title
  * description
  * starter prompt/topic generation behavior
  * review focus
  * optional scenario context, such as CET level

### Starter prompts/topics

* All templates should support AI-generated starter prompts/topics.
* Users can skip AI generation and start writing directly from their own topic or intention.
* Users who skip generation should have an optional goal/topic field to tell review what they are practicing.
* Starter prompt/topic generation should be one-click after selecting a template.
* Users can regenerate the starter prompt/topic before writing.
* If generation fails, show an error with Retry.
* Do not use local fallback topics in the MVP.
* Before the first starter prompt/topic generation, show a one-time provider disclosure explaining:
  * AI will be called to generate a prompt/topic.
  * No user essay content is sent for this generation step.
* Generated prompt/topic context and user-provided goal/topic should be persisted with the writing attempt when present.

### CET-specific behavior

* CET-4 Writing and CET-6 Writing are scenarios within Writing Practice, not the whole product identity.
* CET starter topics should be generated in English.
* Surrounding helper/explanatory copy may be in Chinese.
* Do not show word-count targets in the MVP editor.
* Do not show timers in the MVP editor.
* Do not build mock-exam mode in the MVP.
* Do not provide precise CET scores in the MVP.
* Review may use coarse performance labels where useful, but focused feedback remains the main review output.

### Writing editor and drafts

* Selecting a template opens a writing editor framed around that template.
* The editor should not be hardcoded as a journal editor.
* Preserve one current draft per template so templates do not overwrite each other.
* For generated prompts/topics, create or update the current writing attempt when the prompt/topic is generated or accepted, so draft autosave and prompt context stay bound together.
* Journal should preserve the existing habit/reflection writing use case as one template.
* Free Writing should support open-ended practice with optional AI prompt generation or user-provided goal/topic.

### AI boundaries

* Use AI for:
  * pre-writing starter prompt/topic generation
  * post-writing review
  * next-day rewrite practice generation/support
* Do not add in-editor AI co-writing in the MVP.
* Do not add live suggestions while the user is writing.
* Do not make AI generation mandatory before writing.

### Review and rewrite practice

* Keep one shared review framework across templates.
* Make review input/prompt template-aware by including:
  * selected template
  * template review focus
  * generated prompt/topic, if present
  * user-provided goal/topic, if present
  * user writing content
* Review prompt/input must no longer refer unconditionally to `journal entry`.
* Preserve the existing focused learning loop:
  * focus correction
  * self-repair
  * reference rewrite
  * D+1 rewrite practice
* Keep D+1 rewrite practice as a core product differentiator.
* The product should not feel like a one-off AI correction tool.

### Data and architecture

* Generalize journal-named product surfaces, IPC/API/types, review input, services, and persistence concepts into writing-oriented terminology.
* Because the project is still in development, allow rebuilding/replacing the local schema instead of preserving old local journal data.
* Make the data reset/schema rebuild assumption explicit; do not imply this is a production-safe migration.
* Keep MVP focused on current writing attempts and due rewrite practice.
* Do not add history/progress pages yet.

## Acceptance Criteria

* [ ] The app/page title direction is `Writing Practice`.
* [ ] The main entry is framed as `Practice`, not `Today` or journal-only.
* [ ] The entry surface presents Journal, CET-4 Writing, CET-6 Writing, and Free Writing as same-level writing practice templates.
* [ ] Selecting any template opens a template-aware editor, not a hardcoded journal editor.
* [ ] Every template supports one-click AI starter prompt/topic generation.
* [ ] Users can skip AI starter prompt/topic generation and write directly.
* [ ] Users can optionally provide their own goal/topic for review context.
* [ ] Users can regenerate an AI starter prompt/topic before writing.
* [ ] Starter prompt/topic generation failure shows an error with Retry.
* [ ] A one-time provider disclosure appears before the first starter prompt/topic generation.
* [ ] Generated prompt/topic context and optional user goal/topic are saved with the writing attempt.
* [ ] One current draft is preserved per template.
* [ ] CET-4/CET-6 generated topics are presented in English with Chinese helper copy where useful.
* [ ] CET editor does not show timers or word-count targets in the MVP.
* [ ] Review prompt/input is writing/template-aware and no longer assumes `journal entry`.
* [ ] Existing Journal write → review → save → D+1 rewrite behavior remains available through the Journal template.
* [ ] D+1 rewrite practice remains available after the generalization.
* [ ] Core shared types, service names, IPC channels, and persistence concepts use writing-oriented terminology.
* [ ] Tests cover template selection, prompt/topic generation states, skip behavior, template-aware review input, and the rewrite practice loop.

## Definition of Done

* Tests added/updated where appropriate.
* Lint/typecheck pass.
* UI manually verified for:
  * template picker
  * AI starter prompt/topic generation
  * regenerate
  * skip generation
  * optional user goal/topic
  * editor autosave
  * review
  * save review
  * due D+1 rewrite practice
* Specs/docs updated where behavior or contracts change.
* Development-stage schema rebuild/data reset assumption documented.

## Decisions

### Product north star

**Decision**: The product is an AI writing practice tool.

**Why**: The product planning drifted from journal-first to CET-first. Both are too narrow. The broader identity should be writing practice supported by AI.

**Consequence**: Journal and CET are scenarios/templates, not the product identity.

### Practice loop

**Decision**: The core loop is choose scenario → optional AI starter prompt/topic → write independently → focused AI review → next-day rewrite drill.

**Why**: This distinguishes the product from generic AI correction tools and preserves the existing rewrite-practice advantage.

**Consequence**: In-editor co-writing and live suggestions are out of scope for MVP.

### Template set

**Decision**: Ship Journal, CET-4 Writing, CET-6 Writing, and Free Writing as same-level initial templates.

**Why**: These scenarios cover habit/reflection, exam-oriented practice, and open-ended writing without making one scenario dominate the product identity.

**Consequence**: The picker should be a writing practice surface, not a journal dashboard or exam dashboard.

### AI starter prompts/topics

**Decision**: Every template supports AI-generated starter prompts/topics, but users can skip generation.

**Why**: This makes the product feel AI-assisted across scenarios while preserving user agency.

**Consequence**: Review input must support generated prompt/topic, user-provided goal/topic, both, or neither.

### CET behavior

**Decision**: CET-4/CET-6 are writing practice scenarios, not mock-exam modes.

**Why**: The MVP should validate writing practice, not build a full exam simulator.

**Consequence**: Timers, word-count pressure, precise scoring, and mock-exam dashboards are out of scope.

### Review contract

**Decision**: Keep one shared review framework, made template-aware through context and review focus.

**Why**: Fully custom per-template review outputs would expand validation and UI complexity too much for MVP.

**Consequence**: The existing focus correction / self-repair / reference rewrite / D+1 rewrite loop remains the stable foundation.

### Data model direction

**Decision**: Generalize journal-oriented naming to writing-oriented naming across app layers, with development-stage schema rebuild allowed.

**Why**: Keeping journal-named internals would preserve the old product assumption and make future scenarios awkward.

**Consequence**: This is a larger implementation, but it avoids legacy compatibility code while the product is still pre-production.

## Out of Scope

* User-created or editable templates.
* In-editor AI co-writing.
* Live writing suggestions.
* History/progress pages.
* Mock-exam mode.
* Timers.
* Word-count pressure.
* Precise exam scoring.
* Fully custom per-template review output contracts.
* Production-safe migration for old local journal data.
* Letting Journal or CET dominate product identity.

## Implementation Plan

* PR1: Define writing templates and replace journal-first UI copy/entry with the Practice template picker and template-aware editor state.
* PR2: Add shared starter prompt/topic generation for all templates, including disclosure, regenerate, skip, retry, and persisted context.
* PR3: Generalize shared types, IPC/API names, services, and schema from journal-oriented concepts to writing-oriented concepts, using development-stage schema rebuild.
* PR4: Make review input/prompt template-aware while preserving the shared review output contract and D+1 rewrite practice.
* PR5: Update tests/specs and manually verify the full practice loop across Journal, CET-4, CET-6, and Free Writing.

## Research References

* [`research/current-writing-workflow.md`](research/current-writing-workflow.md) — Current implementation is journal-centered with D+1 rewrite practice; CET appears only as out-of-scope/backlog and has no implementation or prompt assets.

## Technical Notes

* Task directory: `.trellis/tasks/04-30-broader-writing-cet-practice/`.
* Main journal UI files to generalize: `src/renderer/App.tsx`, `src/renderer/components/JournalEditorCard.tsx`, `src/renderer/components/LearningPanel.tsx`, `src/renderer/components/TodayHeader.tsx`.
* Main review/prompt files to generalize: `src/main/services/review/lib/prompt.ts`, `src/main/services/review/lib/review-input.ts`, `src/shared/review-contract/schemas.ts`, `src/shared/review-contract/validation.ts`.
* Persistence/API currently journal-named: `src/preload/index.ts`, `src/shared/constants/channels.ts`, `src/shared/types/journal.ts`, `src/main/services/journal/service.ts`, `src/main/db/schema.ts`.
* Related specs: `.trellis/spec/product/mvp-scope.md`, `.trellis/spec/product/learning-flow.md`, `.trellis/spec/product/data-model-contract.md`, `.trellis/spec/product/review-agent-contract.md`.
