# First-Launch Onboarding Intro

## Goal

Design a first-launch onboarding/intro flow for English Coach that introduces the product clearly without breaking the current quiet writing-desk style. The current concept is a slideshow-like intro: first a centered app icon and product name, then a dissolve transition into concrete product introduction using three screenshots of the app.

## What I Already Know

* The user wants a first-start guide/intro page.
* The user's initial direction is: globally centered icon + product name, dissolve effect, then detailed introduction.
* The user has three photos/screenshots of app pages intended for the intro, but those image files are not visible in the current thread or repo.
* Existing app shell is Electron + React + Tailwind + daisyUI.
* Current renderer surfaces live mainly in `src/renderer/App.tsx`, with global style tokens in `src/renderer/styles.css`.
* Current product style is warm editorial and writing-first: paper background, restrained deep sea-blue primary actions, serif editorial headings, thin dividers, minimal cards.
* Existing app pages are Today, Practice, Feedback, Notebook, Progress, and Settings.
* Product specs say Practice is the product entry. Journal, CET-4, CET-6, and Free Writing are equal templates, not product identities.
* No app icon/image asset is currently visible in the repo outside dependencies.

## Assumptions

* This is a design/planning pass first; implementation will happen only after requirements are confirmed.
* The onboarding should not introduce a new product identity beyond English Coach / writing practice.
* The onboarding should not add gamified metrics, streaks, exam timers, fake difficulty labels, or dashboard-like badges.

## Style Direction

Recommended direction: a short editorial intro rather than a conventional marketing carousel.

* Opening: full-screen warm paper surface, centered product mark, `English Coach` in editorial serif, one small line of calm supporting copy.
  * Duration/intensity: hold for about 1.2-1.6 seconds, with a light fade/scale from roughly 96% to 100%, then cross-dissolve into the first intro slide.
* Transition: soft cross-dissolve/fade-through with a subtle paper/ink feel; no flashy particle animation or heavy blur.
* Introduction: three quiet steps using the provided app screenshots as actual product evidence:
  * `Start with one quiet prompt`: Today / Practice entry, emphasizing that the user can start without navigating a complex flow.
  * `Write first, no interruptions`: writing editor, emphasizing independent writing with no live correction.
  * `Review one pattern, then rewrite`: Feedback / Rewrite, emphasizing one transferable focus pattern and follow-up rewrite practice.
* Layout: show screenshots primarily as large realistic app windows, with only light cropping if needed for fit. Keep screenshots large enough to inspect, with text secondary. Avoid nested cards, tight feature close-ups, and generic marketing-card composition.
* Copy density: each intro slide should use one short title and one sentence of supporting copy. Avoid paragraphs, bullet lists, feature checklists, and tutorial-style instruction text.
* CTA: one primary action at the end: `Enter English Coach`; secondary skip is text-only.
* Flow behavior: onboarding should be a skippable welcome story, not a required first-run setup gate.
* Slide behavior: after the brand opening dissolves into the first intro slide, the three-slide intro should auto-advance while still allowing manual control through next/back/progress controls. Manual interaction should take over gracefully rather than fighting the user's pace.
* Persistence behavior: completing or skipping onboarding should both count as dismissed. Store a local persistent marker rather than tying intro visibility to setup/API-key completion. Prefer a versionable marker such as `onboardingIntroVersionSeen` so a future redesigned intro can intentionally reappear.
* Reopen behavior: Settings should include a weak text action such as `View welcome intro` so users can replay the intro later. This should open the intro without clearing the dismissed/version-seen marker.
* Screenshot assets: use static committed image assets for the final version, likely under `src/renderer/assets/onboarding/`. Until the user provides screenshots, use restrained placeholders that communicate layout and slide rhythm only.
* Temporary product mark: until a final app icon exists, use a minimal `EC` text mark or equally simple line mark in the existing deep sea-blue. The mark should be easy to replace and should not introduce a competing visual identity.
* Reduced motion: when `prefers-reduced-motion` is active, keep the intro content available but disable auto-advance, scale movement, and long dissolve transitions. Use static/manual slides with either no transition or a very short fade.

## Open Questions

None. Remaining implementation details should be decided conservatively from existing project patterns.

## Requirements (Evolving)

* The intro must match the minimal editorial writing-workspace visual contract.
* The first screen must feature product identity clearly: icon/mark + `English Coach`.
* Before a final icon asset exists, the opening mark should use a restrained `EC` placeholder or simple line mark.
* The brand opening must be brief and understated, not a long splash animation.
* The transition from brand screen into product explanation should feel soft and quiet.
* The intro should use real app screenshots rather than generic illustration.
* Until screenshots are ready, placeholder screenshot panels may be used, but they must not pretend to be final product screenshots.
* Screenshots should preserve the user's sense of entering the real app, not become isolated feature-detail panels.
* The intro should explain the core loop without overloading the user.
* Each intro slide should carry only one short title and one sentence.
* Users must have a clear path into the app.
* Users must be able to skip the intro and enter the app without completing setup.
* Dismissing from either skip or final CTA should land the user on the existing Today page, not directly inside the Practice editor.
* Users must be able to manually control the intro even though it auto-advances by default.
* Reduced-motion users must get a static/manual version of the intro without auto-play or scale transitions.
* The three screenshot slides must follow the writing loop: writing entry, independent drafting, focused review/rewrite.
* Onboarding dismissal must persist locally across app restarts.
* Settings must offer a low-priority way to replay the welcome intro.

## Acceptance Criteria (Evolving)

* [ ] First-launch intro appears only when appropriate for a first-run experience.
* [ ] Opening screen presents icon/mark and product name centered on the warm paper background.
* [ ] Temporary mark is simple and replaceable when the final app icon is supplied.
* [ ] Product explanation uses three app screenshots with restrained editorial copy.
* [ ] Placeholder screenshot panels can stand in temporarily and are easy to replace with `entry`, `writing`, and `review` image assets later.
* [ ] Each slide uses one short title plus one sentence, not paragraphs or lists.
* [ ] Slides auto-advance by default, with manual next/back/progress controls that pause or reset the automatic timing after interaction.
* [ ] Reduced-motion mode disables auto-advance and motion-heavy transitions while keeping all content reachable.
* [ ] The flow has at most one deep sea-blue primary CTA visible at a time.
* [ ] Final CTA says `Enter English Coach` and routes to Today after dismissal.
* [ ] A skip or close affordance exists and does not require setup completion.
* [ ] Completing or skipping the intro stores a local dismissed/version-seen marker.
* [ ] Settings includes a weak `View welcome intro`-style action that reopens the intro without resetting dismissal state.
* [ ] The design avoids dashboard badges, metrics, timers, and noisy marketing cards.

## Definition of Done

* Requirements confirmed by the user.
* Grill-me pass completes for key product/design decisions.
* Implementation context is curated before coding.
* Lint and typecheck pass after implementation.
* Specs/notes updated if this establishes a new reusable first-run UI convention.

## Out of Scope

* Full marketing landing page.
* Account creation or cloud sync onboarding.
* New AI review behavior.
* New learning analytics, streaks, scores, timers, or gamification.
* Reworking the main app navigation beyond what first-launch routing requires.

## Technical Notes

* Likely impacted renderer area: `src/renderer/App.tsx`.
* Likely impacted settings UI area: `src/renderer/components/SettingsPage.tsx`.
* Likely styling area: `src/renderer/styles.css`.
* Likely impacted IPC/preload areas: `src/main/ipc/handlers.ts` and `src/preload/index.ts`.
* Likely impacted shared types: `src/shared/types/settings.ts` and possibly `src/shared/types/app.ts`.
* Existing settings persistence uses `electron-store` in `src/main/services/settings/service.ts`.
* Existing `SettingsSnapshot` does not yet expose onboarding state.
* Recommended persistence shape: add local settings-store state for a versioned onboarding marker, expose it through the startup/settings snapshot and IPC only as needed by the renderer.
* Relevant specs inspected:
  * `.trellis/spec/frontend/css-design.md`
  * `.trellis/spec/product/index.md`
  * `.trellis/spec/product/learning-flow.md`

## Resolved Decisions

* Onboarding is a skippable welcome story, not required setup.
* Opening brand screen is brief: about 1.2-1.6 seconds, light fade/scale, then cross-dissolve.
* Intro slides auto-advance by default and remain manually controllable.
* Reduced-motion mode disables auto-advance and motion-heavy transitions.
* Three slides follow the loop: entry prompt, independent writing, focused review/rewrite.
* Final screenshots will be static assets; use restrained placeholders until the user supplies them.
* Temporary opening mark is a minimal `EC` or simple line mark.
* Completion and skip both persist dismissal locally.
* Settings includes a low-priority replay action.
* Final CTA is `Enter English Coach`, and dismissal lands on Today.
