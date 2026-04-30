# UI/UX overall refactor

## Goal

Refactor the desktop app UI/UX from a dense single-screen practice workspace into a calmer writing-coach experience with clearer information architecture, lower visual noise, and a more guided practice flow. Preserve the current product capabilities while allowing the user journey, page structure, and entry points to be rearranged.

## What I already know

* The product should remain positioned as an AI writing practice coach, not a generic AI tool or dashboard-first analytics product.
* The refactor should reset information architecture and improve the practice flow, not merely reskin the current screen.
* Default entry should be a Home/Today page that helps the user start or continue today's writing practice.
* Top-level app areas should be Today, Write/Practice, Library, and Settings.
* Navigation should use a narrow left-side app shell suitable for a desktop app.
* Practice should preserve the left/right workbench model: writing document on the left, Coach guidance on the right.
* Practice should expose stages through a lightweight status line, not a prominent stepper/progress component.
* User-facing language should move toward Coach / Feedback / Try again / Coach rewrite / Follow-up rewrite.
* Visual direction should be calm, warm, focused, and writing-oriented.
* Avoid excessive cards, prominent rounded corners, obvious dividers, neon gradients, and generic bubbly AI-app aesthetics.
* Prefer simple whitespace, flat sections, restrained surfaces, modest radii, and very subtle structural hints.
* Template selection should primarily live on Today; Practice should show the current template with lightweight switching.
* AI starter should be an optional writing aid, not a required first step.
* Coach should organize feedback around next action: Next step / Focus / Feedback / Try again.
* Editor should feel like a plain-text document editor while remaining a textarea/plain-text implementation for now.
* Settings should become a dedicated page instead of a drawer.
* Library v1 should focus on a calm practice-history entry point and avoid a full learning-assets dashboard in this task.
* Existing capabilities should be preserved, but routes, paths, entry points, and the overall interaction path may be rearranged.
* Do not introduce a standalone reusable design-system package/layer in this task; use lightweight local shell/page primitives only where they directly reduce duplication.

## Assumptions (temporary)

* This task should not introduce v0.2 learning-assets features such as error pattern mastery, spaced repetition dashboard, or advanced analytics.
* This task may include component and state-ownership refactoring where needed to support the new information architecture.
* Existing data contracts and IPC boundaries should remain stable unless a small change is necessary for the UI reorganization.
* The first implementation should optimize for a coherent end-to-end experience over pixel-perfect polish on every secondary state.

## Open Questions

* None. MVP direction is confirmed as shell-first.

## Requirements

* Implement the shell-first MVP in this task:
  * add a narrow desktop app shell with Today, Write/Practice, Library, and Settings areas;
  * preserve the existing practice/review/autosave/rewrite logic behind the Write/Practice area as much as possible;
  * make Today useful from existing startup/settings/current-attempt/pending-rewrite state without adding broad new backend contracts;
  * extract Settings from drawer behavior into a dedicated Settings page;
  * keep Library v1 as a thin practice-history entry surface unless existing contracts can support more without new scope.
* Replace the single-screen feel with a clear app shell and top-level areas: Today, Write/Practice, Library, Settings.
* Default launch should land on Today/Home rather than directly inside the editor.
* Allow path reordering while preserving current functional capabilities:
  * choose template
  * write draft
  * optional AI starter
  * submit review
  * privacy disclosure
  * view feedback
  * try again/self-repair
  * reveal coach/reference rewrite
  * save session
  * D+1/follow-up rewrite
  * configure AI provider
* Keep Practice as a two-column writing workbench, with a document-like editor and Coach panel.
* Use a lightweight stage/status line instead of a visually dominant progress stepper.
* Move Settings from drawer to dedicated page.
* Make Library v1 a practice history surface with session detail entry points.
* Keep visual hierarchy simple and restrained: minimal card usage, modest rounding, very subtle separators, and generous whitespace.
* Do not add new v0.2 learning-asset functionality as part of this refactor.

## Acceptance Criteria (evolving)

* [ ] App launches into a Today/Home experience that can start a new practice session or continue relevant work.
* [ ] A narrow left-side navigation shell exposes Today, Write/Practice, Library, and Settings.
* [ ] The existing writing/review/rewrite/save capabilities remain reachable after path rearrangement.
* [ ] Practice page presents a document-like writing area and a Coach panel organized around next action.
* [ ] Template selection is primarily available from Today, with lightweight current-template display/switching in Practice.
* [ ] AI starter is optional and does not block direct writing.
* [ ] Settings provider configuration works from a dedicated Settings page.
* [ ] Library shows a thin practice-history entry surface without adding v0.2 learning-assets functionality.
* [ ] Visual design avoids excessive cards, large rounded corners, prominent dividers, and high-noise AI styling.
* [ ] Existing practice stateful flows are preserved behind the Write/Practice area with minimal behavior changes.
* [ ] Existing tests, lint, and typecheck pass; UI flow is manually verified in the running desktop app.

## Definition of Done (team quality bar)

* Tests added/updated where behavior or component boundaries change.
* Lint, typecheck, and relevant test suites pass.
* The desktop UI is manually exercised through the golden path: Today → Write → Feedback → Try again/Coach rewrite → Save → Library/Settings.
* Docs/notes updated if user-visible behavior or navigation changes.
* Rollback/risk considered for any data-contract or IPC change.

## Out of Scope (explicit)

* Error pattern mastery tracking.
* Spaced repetition queue beyond preserving existing D+1/follow-up rewrite capability.
* Analytics-heavy dashboard.
* Full design-system package or external component library migration unless later chosen explicitly.
* Rich-text editor adoption.
* New AI provider functionality.
* New backend/storage architecture.

## Technical Notes

* Current app is an Electron + Vite + React single-page desktop app.
* Current renderer entry is `src/renderer/main.tsx`, which mounts `App` under React Query.
* Current main app logic is concentrated in `src/renderer/App.tsx`, including loading/error state, practice layout, settings drawer, dialogs, template selection, autosave, review state, and rewrite practice state.
* Current UI has no React Router; screen selection is state-driven, so a desktop tab/shell state is enough unless deep links become required.
* Current core components include `PracticeHeader`, `PracticeTemplatePicker`, `WritingEditorCard`, `LearningPanel`, `SettingsDrawer`, `ReviewDisclosureDialog`, and `RevealAnswerDialog`.
* Current styling uses Tailwind v4 and DaisyUI theme tokens in `src/renderer/styles.css`; most component styling is inline utility classes rather than a design-system primitive layer.
* Existing product workflow is documented in `README.md`: choose template, optional AI starter, draft, review, self-repair, reference rewrite, save, and D+1 rewrite.
* Existing templates live in `src/shared/writing/templates.ts`.
* Existing React Query setup is lightweight and should remain the preferred renderer data boundary.
* Today can be built from existing startup/settings/current-attempt/pending-rewrite state, but summarizing all templates should avoid calling current-attempt APIs with creation side effects.
* A useful Library history list likely needs a new read-only IPC/shared type/query path; the database stores historical attempts and review runs, but renderer contracts currently do not expose a list API.
* Settings can become a dedicated page by extracting the content of the existing drawer from its drawer wrapper.
* Current tests are mostly backend/query contract tests; there are no renderer component/E2E tests for shell tab switching.
* Prior code exploration found no dedicated UI mockup/screenshot assets.

## Research References

* None yet. This task is currently guided by repo inspection and product decisions from the grill-me session.

## Decision (ADR-lite)

**Context**: The existing UI concentrates core writing, review, template, settings, and dialog flows into one screen. This makes the product feel dense and makes future learning assets harder to place without increasing clutter.

**Decision**: Reframe the app around a narrow left-side shell with Today, Write/Practice, Library, and Settings. Preserve current capabilities but allow user paths and page locations to be rearranged. Use a calm, flat, writing-oriented visual system with minimal card/rounding/separator emphasis. Implement the MVP as a shell-first slice: keep current Practice state/behavior mostly intact behind Write, make Today useful from existing state, extract Settings into a page, and keep Library as a thin v1 entry surface.

**Consequences**: This creates clearer product structure and room for future v0.2 learning assets while reducing regression risk. It intentionally defers a fuller Library/history API and standalone design-system layer so the first pass can focus on end-to-end information architecture and current capability preservation.
