# Productize UI Polish

## Goal

Make the full desktop app feel like a mature writing-coach product instead of a demo. The polish should preserve the quiet paper-and-ink brand direction while making visible UI copy, hierarchy, separators, scrollbars, text selection, and empty/error states feel restrained, useful, and ready for daily use.

## Requirements

* Apply a full-app unified polish pass, not only the main writing flow.
* Keep the quiet writing-coach paper/ink visual identity, but make it mature, restrained, and content-first.
* Keep ink decoration as subtle brand texture; it must not compete with main content or feel like a landing-page effect.
* Rewrite all visible product UI copy in English product tone.
  * Remove development-stage language, placeholder/demo phrasing, and implementation-limit explanations.
  * Prefer short status/action copy over explanatory marketing copy.
* Make UI chrome non-selectable by default.
  * Navigation, buttons, labels, badges, stats, decorative text, and empty-state headings should not select accidentally.
  * User writing, review feedback, suggested expressions, error details, and learning material must remain selectable/copyable.
* Keep scrollbars minimal but accessible.
  * Stable desktop layout.
  * Scrollbars should be unobtrusive by default and lightly visible on hover/focus/scroll.
  * Do not fully hide scroll affordances.
  * Avoid awkward gutters, horizontal scrollbar leaks, or visible system-scrollbar roughness.
* Reduce hard borders and unnecessary dividers.
  * Prefer spacing, soft background layering, typography, and subtle surfaces.
  * Keep borders only for structural app boundaries, input/editing areas, and meaningful status/error/warning boundaries.
* Reduce panel-stacking and dashboard/demo feeling.
  * Fewer explanatory blocks.
  * More direct state and next-action presentation.
  * Small layout polish is allowed for spacing, max-widths, panel rhythm, editor height, and sidebar/content balance.
* Do not change information architecture, navigation structure, or core workflows.
* Include empty, loading, error, and disclosure states in the polish pass.
* Lightly tune color hierarchy without redesigning theme tokens.
  * Primary color should emphasize current navigation, primary CTA, and key states.
  * Info/warning/debug surfaces should be visually quieter than they are today.
* Onboarding should remain, including simulated skeleton/product preview, but become simpler and more practical.
  * Keep skeleton because it explains the writing/review/rewrite loop.
  * Reduce landing-page/demo presentation and make the copy feel like first-run product guidance.
* Settings should keep existing functionality but feel productized.
  * Provider/model remain visible core settings.
  * Thinking/raw response options become lower-priority advanced/debug-style controls.
  * Intro reset remains a low-priority helper action.
* Notebook and Progress should receive presentation polish only.
  * Do not change data model or learning logic.
  * Progress should feel like learning evidence/pattern progress, not a generic stats dashboard demo.
* Target desktop Electron default and narrower desktop windows.
  * No mobile-specific redesign in this task.
* Do not add new dependencies.
* Do not perform unrelated cleanup or remove unused components unless they directly affect visible UI or quality checks.

## Acceptance Criteria

* [ ] Main app screenshots no longer read as demo/prototype at first glance.
* [ ] All visible app pages use concise English product copy with no development-stage phrases such as "first UI version" or internal roadmap explanations.
* [ ] Placeholder text reads like real user guidance, not sample/demo copy.
* [ ] Navigation, buttons, badges, stats, decorative copy, and app chrome do not select accidentally.
* [ ] Writing text, review feedback, rewrite text, saved expressions, and useful error details remain selectable/copyable.
* [ ] Main content and textareas have subtle, accessible scrollbars with no awkward gutters or horizontal scrollbar leaks.
* [ ] Hard dividers, `border-b`, `divide-*`, and decorative `border-l` treatments are removed or softened unless they communicate structure, input, warning, or error state.
* [ ] Ink decoration is retained but visually subordinate to content.
* [ ] Onboarding keeps a simplified skeleton preview and practical first-run copy.
* [ ] Settings preserves existing options while lowering advanced/debug visual priority.
* [ ] Notebook and Progress keep existing data behavior while looking less like demo cards/dashboards.
* [ ] Empty/loading/error/disclosure states are short, specific, and action-oriented.
* [ ] Default desktop and narrower desktop windows have been visually checked.
* [ ] Quality checks pass for the changed renderer code.

## Definition of Done

* Visual baseline is captured by running the app and inspecting the main pages before implementation.
* Renderer UI changes are implemented without new dependencies.
* Typecheck/lint/test checks relevant to the project are run.
* Main pages are visually verified after implementation, including default desktop and narrower window states.
* Any newly discovered durable UI conventions are captured in Trellis specs only if they are broadly reusable.

## Technical Approach

Use a focused renderer polish pass rather than a redesign:

1. Inspect the running UI to identify the highest-impact demo-looking areas.
2. Update global shell styles for selection, scrollbars, borders/surfaces, ink subtlety, and reusable product polish utilities.
3. Rewrite visible English UI copy across app surfaces.
4. Polish visible page/component markup with minimal structural changes.
5. Verify with browser/DevTools and project quality checks.

Likely impacted files from initial inspection:

* `src/renderer/App.tsx` — app shell, state-based page switcher, Today/Write/Feedback/Notebook/Progress surfaces, dialogs.
* `src/renderer/styles.css` — global theme, shell, scrollbar, selection, paper/ink/surface styles.
* `src/renderer/components/WritingEditorCard.tsx` — writing prompt/editor copy and inline chrome.
* `src/renderer/components/LearningPanel.tsx` — right-side coach/status/rewrite panel.
* `src/renderer/components/SettingsPage.tsx` — provider/model and advanced/debug settings language/hierarchy.
* `src/renderer/components/OnboardingIntro.tsx` — first-run copy and skeleton presentation.
* `src/renderer/components/ReviewDisclosureDialog.tsx` — provider/privacy disclosure copy and layout.
* `src/renderer/components/RevealAnswerDialog.tsx` — confirmation copy.
* `src/shared/writing/templates.ts` — practice template names/descriptions/prompts where they surface in UI.

## Decision (ADR-lite)

**Context**: The app already has a coherent writing-coach direction, but visible details make it feel like a prototype: demo-like copy, explanatory/internal wording, excessive dividers, selectable chrome, and rough scrollbar/surface behavior.

**Decision**: Perform a full-app presentation polish while preserving the existing product structure, workflows, theme direction, and dependencies.

**Consequences**:

* Faster path to a product-quality impression than a redesign.
* Lower implementation risk because data flow and core workflows stay unchanged.
* Some deeper IA/content-model improvements remain out of scope for future product work.

## Out of Scope

* Mobile-specific redesign.
* New dependencies, icon libraries, or component systems.
* Data model, learning logic, provider runtime, or workflow changes.
* Navigation/information architecture changes.
* Broad refactors or unused-code cleanup not required for visible polish.
* Major brand/theme redesign.

## Technical Notes

* This is a single-window renderer app with state-driven navigation via `activeArea` rather than a route tree.
* Initial UI surface scan found most visible surfaces in `App.tsx`, `styles.css`, `WritingEditorCard`, `LearningPanel`, `SettingsPage`, `OnboardingIntro`, and dialogs.
* Existing global CSS already includes hidden-by-default scrollbar treatment and an `.app-ink` non-selectable decoration class; implementation should refine rather than replace these patterns.
* Visual verification is required because the task is UI polish; code inspection alone is insufficient.
