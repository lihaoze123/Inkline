# Refine Sidebar Visual Hierarchy

## Goal

Make the Inkline sidebar feel cohesive with the refined writing surface by improving the logo-to-menu grouping and spacing while keeping the original understated active-state color/emphasis treatment.

## What I Already Know

- The current sidebar feels visually thin and detached from the main content area.
- The active item should keep the original understated emphasis: primary-blue text/icon color and stronger font weight only.
- The logo sits too far above the navigation list, causing the sidebar to read as loose rather than as one coherent block.
- Navigation spacing should be tighter vertically, with icon/text spacing reduced so each row reads as a single control.
- The sidebar should keep the app's elegant, literary feel: serif/editorial brand, humanist sans navigation, ink/paper palette, and restrained use of the primary blue.
- Existing implementation is in `src/renderer/App.tsx` with shared styling tokens in `src/renderer/styles.css`.

## Assumptions

- The requested design critique is the source of truth for this task and counts as requirements confirmation.
- This is a visual refinement only; no route/state behavior, copy, onboarding, review, notebook, or settings behavior should change.
- Confirmed through a focused grill-me pass: keep the improved position/spacing relationships, but restore the original color and active/focus emphasis approach.

## Requirements

- Do not use an active row background, left accent marker, or pale-blue hover background.
- Keep active navigation emphasis to `font-semibold text-primary`, matching the original color/focus approach.
- Keep inactive hover emphasis understated, matching the original text-color-only behavior.
- Tighten navigation list spacing so items read as a grouped menu.
- Reduce icon-to-label horizontal spacing.
- Increase line icon stroke weight enough to match the navigation label weight.
- Bring the `Inkline` mark closer to the nav group and align it with the same left axis.
- Keep the sidebar background and divider treatment aligned with the original quiet paper surface.
- Preserve semantic `<nav>` and `<button>` behavior plus existing `aria-current` handling.
- Keep the change responsive within the existing fixed sidebar grid.

## Acceptance Criteria

- [ ] The active nav row does not use a background fill, left accent marker, or large pill treatment.
- [ ] Active row text and icon use primary blue plus font weight, matching the original emphasis model.
- [ ] Hover state for inactive rows remains text-color-only and does not introduce a colored row fill.
- [ ] Logo-to-menu spacing is visibly reduced.
- [ ] Menu item vertical and icon-label spacing is tighter than before.
- [ ] Sidebar background and divider remain quiet and consistent with the original paper treatment.
- [ ] No behavior changes are introduced in area switching.
- [ ] `pnpm lint` and `pnpm typecheck` pass.

## Definition of Done

- Styling and markup changes are limited to the renderer shell/sidebar where practical.
- The design remains consistent with Inkline's refined editorial writing aesthetic.
- Quality checks pass, or any inability to run them is documented.

## Out of Scope

- New sidebar items or route changes.
- Mobile navigation redesign.
- Reworking the main content layout beyond alignment needed for the sidebar.
- Adding new font dependencies.

## Technical Notes

- Sidebar markup starts around `src/renderer/App.tsx` in the app shell `<nav>`.
- Current theme tokens live in `src/renderer/styles.css`, including `--coach-paper`, `--coach-paper-warm`, and `--coach-blue`.
- Use existing CSS/Tailwind approach; avoid new dependencies.
