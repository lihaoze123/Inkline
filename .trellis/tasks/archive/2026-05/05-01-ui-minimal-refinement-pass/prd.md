# UI Minimal Refinement Pass

## Goal

Continue the English Coach quiet writing desk redesign with a second-pass simplification. The goal is to remove remaining unnecessary UI elements and make the app feel more minimal, elegant, and writing-first while preserving the existing product contracts for provider settings, independent writing, focused review, and rewrite practice.

This task is not a new visual direction. It is a convergence pass after the first redesign: keep the warm editorial desktop shell, but reduce visible modules, competing CTAs, and dashboard-like density.

## Background

This task is a child of `.trellis/tasks/04-30-quiet-writing-desk-ui-redesign/`.

Decisions from the `/grill-me` discussion:

* Sidebar: freeze current direction; do not keep iterating unless a clear mismatch appears.
* Today: reduce to **one hero only**.
* Writing Workspace Coach/LearningPanel: **collapse by default** so independent writing stays primary.
* Feedback & Rewrite: reduce to **coach note + rewrite**.
* Settings: keep **single column** preference-page structure.
* Buttons: enforce **one primary only** per page.
* Icons: keep current icons for now; do not proactively remove unless they become obvious noise.

## Requirements

### 1. Today: One Hero Only

The Today page should become a focused launch surface:

* Keep warm greeting.
* Keep Today’s Practice title/prompt.
* Keep one primary CTA to start or continue writing.
* Remove or visually hide secondary modules from the default Today view:
  * Continue last draft.
  * Recent progress.
  * Notebook / recent expressions.
  * Practice scenario picker.
* If secondary context is still needed, place it behind a subtle text link or move it to the relevant page.
* Do not add timers, difficulty labels, focus chips, streaks, badges, or metrics.

### 2. Writing Workspace: Coach Collapsed by Default

The writing page should privilege the editor:

* The writing editor remains the visual center.
* Practice header should be an extreme minimal prompt bar: show only the current prompt/title and current scenario as quiet text; remove breadcrumb, database/status detail, instruction paragraph, and illustration from the default writing workspace header.
* Scenario switching should be low-priority but not over-hidden: show the current scenario with a subtle `Change` affordance by default; keep the full scenario list collapsed until requested.
* Starter prompt should be weak-visible rather than fully hidden: show a quiet `Need a starting point?` tool row with `Generate starter` and `Skip` available by default, placed above the draft/saved status row so pre-writing setup reads before draft metadata.
* Generated starter prompt and optional goal/topic controls may remain secondary/collapsed so they do not compete with the editor.
* Coach/LearningPanel is collapsed or reduced by default.
* Default visible coach content should be limited to:
  * A calm status sentence.
  * One `Get Feedback` action when a draft exists.
  * Minimal disclosure/error/review state as needed.
* Keep the desktop two-column layout, but make the coach column narrower/lighter; on small screens it may sit below the editor.
* Word count and autosave should both be weak status elements, not prominent UI modules.
* When review is ready in the writing workspace, show only a short ready status plus a quiet `Open focused review` action; do not inline the review preview or save-review action in Practice.
* Helpful hints, rewrite practice details, review previews, and technical details should not compete with the writing surface.
* Preserve all existing review and autosave behavior.
* Do not introduce live suggestions, realtime corrections, or AI co-writing.

### 3. Feedback & Rewrite: Coach Note + Rewrite

The Feedback page should reduce review density:

* Left side should show only:
  * One overall coach note.
  * One focus pattern.
  * Original draft with gentle highlights.
* Right side should show only:
  * Rewrite textarea.
  * Hint before answer.
  * Reveal model answer action.
  * Save review / update learning history action.
* Remove or hide secondary sections from default view:
  * What improved.
  * Useful expressions placeholder.
  * Repeated “what went well” lists unless they are folded into the coach note.
  * Technical review details unless behind a low-priority disclosure.
* Preserve the product contract: exactly one focus pattern, hint-before-answer, positive feedback, reference rewrite / noticing-the-gap where available, and save boundary for learning history.

### 4. Settings: Single Column, Quiet Utility Page

Settings should remain a clear preference/configuration page:

* Keep one single-column flow: default provider → providers/credentials → privacy/debug → status.
* Do not convert Settings into a dashboard.
* Keep provider/key status as quiet text, not badges; place provider status near the provider title instead of floating at the far right.
* Keep save actions visually secondary unless the page has exactly one primary action.
* Use editorial form rows inside Settings sections: a short label column and a right-side control column on desktop, falling back to stacked rows on small screens.
* Across Today, Writing Workspace, Feedback & Rewrite, LearningPanel, and Settings, avoid using many horizontal separator lines to cut the page into blocks; prefer natural whitespace, typography, and aligned rhythm to separate elements. Use borders sparingly only for major page boundaries or meaningful warning/error/state accents.
* Merge provider model/base URL fields and credentials into one quiet provider section rather than a separate credentials sub-card.
* Place provider actions in one bottom actions row aligned with the control column; use short outline/text labels such as `Save settings`, `Save API key`, and `Delete key`.
* Put helper text under the relevant control and keep it constrained to the control width.
* Preserve required visibility for:
  * Default provider.
  * Provider model settings.
  * Credential/keychain status.
  * Raw response storage setting and warning.
  * Database location/readiness.
  * pi-mono auth status.
  * reserved AnkiConnect status.

### 5. Global Button Hierarchy

* Each page should have at most one deep sea-blue primary button.
* Primary should be reserved for the current page’s main user action:
  * Today: Start/Continue Writing.
  * Writing Workspace: Get Feedback, if visible.
  * Feedback: Save review and update learning history.
* Settings save/delete/config actions should generally be outline/text actions.
* Secondary navigation/actions should not use primary styling.

### 6. Welcome Intro: Replace Brand Placeholder

The first-run welcome intro should no longer show the `EC` text placeholder as the brand mark.

* Use the project-owned English Coach app icon as the welcome intro brand mark.
* Do not add an extra blue/primary-tinted wrapper behind the icon; the intro mark should read as the app icon itself on the warm paper background.
* Keep the brand first screen visible long enough to register the app identity before advancing to the slides.
* Keep the intro minimal and editorial; do not add extra badges, slogans, decorative art, or product-tour metadata.
* Preserve the existing first-run intro behavior: brand hold, reduced-motion continue path, slide navigation, skip/dismiss behavior, and accessibility labels.
* Avoid pulling runtime resources directly from Electron `process.resourcesPath` in the renderer; use a bundled renderer asset or another Vite-safe asset path.

## Acceptance Criteria

* [ ] Today page renders as a single focused hero entry with one primary CTA and no default dashboard modules.
* [ ] Writing Workspace gives the editor more visual space and shows Coach/LearningPanel collapsed or reduced by default.
* [ ] Feedback & Rewrite default view is reduced to coach note + focus + original highlight + rewrite surface/actions.
* [ ] Settings remains single-column and quiet, with required provider/privacy/status information visible.
* [ ] No concept-art-only metadata is introduced: timers, difficulty, focus chips, honor/status labels, fake metrics, streaks, or badges.
* [ ] Each page has at most one primary deep sea-blue CTA.
* [ ] Existing product contracts remain intact: independent writing before review, autosave, provider disclosures, one focus pattern, hint-before-answer, save-review boundary, local-first Settings privacy.
* [ ] Welcome intro brand mark uses the app icon instead of the `EC` text placeholder.
* [ ] `pnpm typecheck && pnpm lint` passes.
* [ ] If the Electron runtime is available, perform a UI smoke test for Today → Practice → Feedback → Settings.

## Definition of Done

* Implementation stays within existing React/Vite/Electron/Tailwind stack.
* No new product features are introduced.
* No cross-layer API, database, or provider contract changes are made unless explicitly scoped later.
* UI copy remains calm, direct, and writing-first.
* Relevant code-spec updates are made if a new reusable UI convention emerges.

## Out of Scope

* Redesigning the sidebar again unless a concrete mismatch appears.
* Removing all icons from content areas.
* Full Notebook persistence or expression saving.
* Full Progress/history analytics.
* New provider settings features.
* New disclosure flows.
* New AI review behavior.
* New persistence tables or migrations.
* Rich-text editor migration.

## Technical Notes

Likely files:

* `src/renderer/App.tsx` — Today, shell routing, Feedback page.
* `src/renderer/components/LearningPanel.tsx` — Coach collapse/reduced default state.
* `src/renderer/components/WritingEditorCard.tsx` — editor-centered layout compatibility.
* `src/renderer/components/SettingsPage.tsx` — single-column quiet Settings adjustments.
* `src/renderer/components/OnboardingIntro.tsx` — welcome intro brand placeholder replacement.
* `src/renderer/styles.css` — minimal visual tokens only if needed.

Relevant specs:

* `.trellis/spec/frontend/css-design.md` — English Coach visual contract.
* `.trellis/spec/frontend/components.md` — semantic HTML and scrollbar behavior.
* `.trellis/spec/product/learning-flow.md` — review/self-repair contract.
* `.trellis/spec/product/privacy-security.md` — Settings privacy and provider boundaries.

## Implementation Order

1. Today single-hero simplification.
2. Writing Workspace Coach collapsed/reduced default.
3. Feedback & Rewrite coach-note + rewrite simplification.
4. Settings final single-column/button hierarchy audit.
5. Welcome intro brand placeholder replacement.
6. Validation and UI smoke test where available.
