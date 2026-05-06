# Implementation Notes

## Recommended Shape

Add a small renderer-only scenario pack component used inside `WritingEditorCard` when `selectedTemplateId === 'free'`.

Likely shape:

- Define a local constant for the five scenario packs:
  - School essay
  - Work update
  - Application
  - Travel
  - Free expression
- Each pack has a short editable goal seed, not a generated prompt and not an outline.
- Render the chips near the `Practice goal` input in the existing `Prompt and goal` details area.
- Clicking a chip calls `onUserGoalChange(pack.goalSeed)`.
- Do not introduce scenario state; the selected value is simply the current `userGoal`.
- Use `WritingTemplateId` checks rather than title string matching.

## Constraints

- No new templates, DB fields, migrations, IPC, provider calls, or review schema changes.
- No generated essay/outlines.
- No scoring, levels, official rubrics, timers, course-track language, or dashboards.
- Do not render the scenario picker for Journal, CET-4, or CET-6.
- Keep the component quiet and compact; avoid card-heavy dashboard treatment.

## Test Notes

Focused renderer tests can use `@testing-library/react` if click behavior is needed, or server-side rendering for static absence/wording checks.

Suggested assertions:

- Free Writing renders all five scenario packs.
- Journal/CET-4/CET-6 do not render scenario packs.
- Clicking "Travel" or another pack calls `onUserGoalChange` with the expected editable goal seed.
- Existing typed userGoal remains the input value when rendered.
- Scenario pack markup avoids forbidden strings: `score`, `level`, `timer`, `rubric`, `mock exam`, `outline for you`, `write it for you`.

## Risk Notes

- Adding a selected scenario field would increase persistence/export scope for little gain.
- Adding scenario-specific review behavior would reopen review-agent contract work and should be a separate PRD.
- Scenario chips should seed intent, not become a prompt library that replaces writing.
