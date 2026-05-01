# onboarding intro simplified visuals

## Goal

Update the onboarding intro start/slides so the visual side no longer looks or reads as a screenshot placeholder. Keep the current quiet, simplified visual language and use lightweight abstract elements that match the app's existing minimal UI.

## What I Already Know

* The user does not want screenshots for the onboarding start experience.
* The desired direction is similar to the current simplified elements, not real product screenshots.
* The existing onboarding intro lives in `src/renderer/components/OnboardingIntro.tsx`.
* Current slide visuals are implemented by `ScreenshotPlaceholder` and contain visible "Screenshot placeholder" copy plus per-slide simplified panels.
* Supporting styles live in `src/renderer/styles.css` under `.welcome-intro__screenshot`.

## Requirements

* Replace the screenshot placeholder framing with a simplified illustrative visual component.
* Remove screenshot-specific language from code-facing labels and visible UI copy.
* Preserve the existing slide flow, reduced-motion behavior, keyboard dismissal, skip button, and final enter action.
* Keep the visual direction restrained and consistent with the existing paper/minimal interface.
* Maintain responsive behavior on mobile and desktop.

## Acceptance Criteria

* [ ] Onboarding slides no longer render the "Screenshot placeholder" label.
* [ ] The main visual region no longer uses screenshot-specific component/class naming in new or changed code.
* [ ] Each slide still has a distinct visual for entry, draft, and review concepts.
* [ ] Navigation dots, Back/Next, Skip, and Enter English Coach still work.
* [ ] Lint and type-check pass.

## Definition of Done

* Lint / type-check green.
* No unrelated UI or data-flow changes.
* Trellis quality check completed after implementation.

## Out of Scope

* Real screenshots, image assets, or generated bitmap assets.
* Changing onboarding persistence/version behavior.
* Rewriting the broader onboarding copy or settings replay entry.

## Technical Notes

* Likely files: `src/renderer/components/OnboardingIntro.tsx`, `src/renderer/styles.css`.
* This is a focused frontend presentation change; no backend, IPC, or database changes expected.
