# Technical Design

## Product Shape

Drill Center is a navigation and prioritization surface over existing durable learning assets:

- Source pattern data from `ErrorPatternSnapshot[]` returned by `listErrorPatterns`.
- Source the currently actionable task from `WritingAttemptSnapshot.pendingRewritePractice`.
- Route users to Practice when the current pending rewrite task is the next drill for a pattern.
- Route users to Progress when they need full evidence/merge context.

## Matching Actionable Work

Use only IDs and fields already exposed to the renderer:

- A pattern's `evidence.latestRepair.rewriteTaskId` can match `pendingRewritePractice.id`.
- A pattern's `evidence.latestTransfer.rewriteTaskId` can match `pendingRewritePractice.id`.
- If either matches, the card can show a primary action to open Practice.
- If the latest check is `retryable` or `failed`, the card should label the drill as needing retry/follow-up but should still route to Practice only when the active pending/recoverable rewrite task is available through the writing snapshot.

## Sorting Heuristic

First version can use a local UI sort without adding API inputs:

1. Current pending rewrite practice matches a pattern.
2. Pattern lifecycle is `needs_attention`.
3. Evidence stage is `needs_repair`.
4. Evidence stage is `repaired_once`.
5. Evidence stage is `transferred_once`.
6. Stable patterns.
7. Higher `updatedAt` or `count` as a tie-breaker.

Keep sorting deterministic and simple.

## UI Notes

- Add `drills` to `AppArea`, nav, icon mapping, and content switch.
- Prefer a dedicated `DrillCenterPage.tsx` component to keep `App.tsx` from growing further.
- Reuse existing visual language from `ProgressPage`: compact headings, full-page layout, small pattern cards, no nested cards.
- Do not introduce large hero/marketing sections.
- Do not use visible help text about keyboard shortcuts or implementation details.

## Tests

- Add a renderer render test for the new page.
- Assert empty state.
- Assert D+1 repair action copy and route button render when pending practice matches latest repair.
- Assert D+3/D+7 copy for transfer practice without `mastered` wording.
- Assert stable pattern copy avoids mastery language.
- Existing `renderer-boundary` should continue to pass because Drill Center uses only shared types and callbacks.
