# Add Global Ink Landscape Decoration

## Goal

Add refined shanshui / ink-painting style decorative elements across the main English Coach app experience, using the empty space shown in the user's reference image to make the UI feel more polished without reducing readability or changing the writing/review workflow.

## What I Already Know

- The user provided a reference screenshot and asked: "参考这个图片在留白的地方加入山水/水墨风格元素，增加精致感".
- The user clarified: "不只是反馈页，全局都要有".
- The user rejected the current implementation because the visible decoration appears in the left-bottom sidebar. Desired placement is the main content area's upper-right whitespace.
- A DevTools screenshot after moving the decoration showed the left-bottom issue is gone, but the upper-right decoration is still effectively invisible. The decoration must be clearly visible as a refined corner accent, not just a barely perceptible background trace.
- The user now asks to restore the sidebar color, adjust the decoration size, and fix a conflict between the Practice page decoration and coach-side elements.
- The current Feedback & Rewrite page is implemented in `src/renderer/App.tsx`.
- The current top-right header art is only an `illustration-placeholder` styled in `src/renderer/styles.css`.
- There is an existing uncommitted change in `src/renderer/components/OnboardingIntro.tsx` changing `BRAND_HOLD_MS`; treat it as pre-existing user work and do not modify it for this task.
- The UI already uses a quiet paper palette, editorial serif headings, and light ornamentation; the new decoration should extend that visual language.
- The user explicitly asked to use the `imagegen` skill. A generated ink landscape asset has been processed into `src/renderer/assets/feedback-ink-landscape.png`.

## Assumptions

- The change should be visual-only: no writing/review state, persistence, model calls, or IPC behavior changes.
- Decorative elements can be implemented with lightweight CSS/inline SVG or component markup; no external image download or new runtime dependency is needed.
- The reference is directional rather than a pixel-perfect mockup.
- "Global" means the primary app shell and main pages after startup, not necessarily modal overlays or the welcome intro if that would interfere with their focused presentation.
- "Global" does not mean decorating every chrome region. The sidebar should not show the landscape; the shared page/content canvas should show the landscape in the upper-right.

## Requirements

- Add shanshui / ink-wash inspired visual elements at the application level so all primary areas (Today, Practice, Feedback & Rewrite, Notebook, Progress, Settings) carry the same refined visual atmosphere.
- Place the global landscape decoration in the upper-right of the main content area, matching the reference direction. Do not place the primary decoration in the left-bottom sidebar.
- Make the upper-right decoration visibly present at normal desktop opacity while still secondary to the text. Avoid double opacity/mask settings that make the image disappear.
- Restore the sidebar background to the original `var(--coach-paper)` treatment; do not tint or make the sidebar transparent for this decoration.
- Keep the decoration smaller than the oversized corner crop that conflicted with Practice content.
- On Practice / Feedback pages with right-side coach or review content, the decoration must not sit under, behind, or visually compete with those panels. It may shrink further, move into unused top-right margin, or hide on those dense pages.
- The Feedback & Rewrite page may still use page-local placement where it benefits from the larger right-side whitespace, but the design must not be limited to that page.
- Keep the decoration low-contrast, refined, and paper-like so English writing remains the visual priority.
- Ensure decoration is `aria-hidden` and does not add visible instructional text.
- Avoid blocking clicks, focus, text selection, or textarea interaction.
- Keep the layout responsive: decorative elements may shrink, fade, or hide on smaller viewports.
- Preserve the existing writing, feedback, rewrite, notebook, progress, settings, and onboarding behaviors.
- Do not touch the unrelated `OnboardingIntro.tsx` working-tree change.

## Acceptance Criteria

- [ ] All primary app areas show a consistent ink landscape / shanshui decorative treatment in large-screen whitespace or app chrome.
- [ ] The visible primary decoration appears in the main content upper-right, not the sidebar lower-left.
- [ ] A desktop screenshot shows the upper-right landscape clearly visible without overlapping the Today page heading or action button.
- [ ] Sidebar color matches the pre-decoration sidebar background.
- [ ] Practice page coach/right-side elements are not visually crossed by the landscape decoration.
- [ ] Feedback & Rewrite no longer depends on the bare placeholder look.
- [ ] Decoration does not overlap primary text, navigation, controls, or editable content on desktop and narrow widths.
- [ ] Decorative markup is hidden from assistive technology.
- [ ] `pnpm lint` and `pnpm typecheck` pass.

## Definition of Done

- Requirements above are implemented.
- Relevant frontend/product/shared specs are consulted through Trellis context.
- Quality check agent reviews the diff and fixes any issues it finds.
- No unrelated user changes are reverted or committed.

## Out of Scope

- Changing the review/rewrite product workflow.
- Adding persisted settings for decorative intensity.
- Introducing external image assets, network fetches, or new packages.
- Redesigning the whole application shell/sidebar beyond adding the global decorative atmosphere.

## Technical Notes

- Likely files: `src/renderer/App.tsx` and `src/renderer/styles.css`.
- The task is simple and visual-only, so no external research artifact is required.
- Use restrained ink lines, layered opacity, and warm paper colors consistent with the existing English Coach visual contract.
- Final asset path: `src/renderer/assets/feedback-ink-landscape.png`.
- Imagegen prompt summary: wide shanshui / ink-wash landscape, visual weight on the right third, distant mountains, pale moon, birds, shoreline water, sparse tree, no text or frame, generated on chroma-key and locally converted to transparent PNG.

## Spec Update Judgment

- `.trellis/spec/frontend/css-design.md` was updated.
- Reason: the final design decision is a reusable frontend convention: all primary pages should keep one consistent right-top ink landscape treatment, while dense pages move content away from the shared art instead of shrinking, hiding, or page-specifically repositioning the artwork.
