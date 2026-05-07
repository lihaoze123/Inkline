# Implementation Notes

## Recommended Shape

Add active-pattern context to starter prompt generation as an opt-in flag:

```ts
generateStarterPrompt({ templateId, userGoal, useActivePatterns?: boolean })
```

Suggested service shape:

- Add `useActivePatterns: z.boolean().optional()` to `generateStarterPromptInputSchema`.
- Define a small cap such as `STARTER_PROMPT_ACTIVE_PATTERNS_LIMIT = 3`.
- When enabled, call `selectActiveReviewPatterns(undefined, STARTER_PROMPT_ACTIVE_PATTERNS_LIMIT)`.
- Build a compact prompt section only when the selected list is non-empty.
- Keep the section out of the prompt when disabled or empty.
- Include only safe fields:
  - category
  - rule
  - canonical example
  - optionally one recent example if already public pattern context
- Do not include fingerprint internals or hidden prompt contracts.

Suggested renderer shape:

- Keep `useActivePatternsForStarterPrompt` as local `useState(false)` in `App`.
- Pass it to `WritingEditorCard`.
- Pass active pattern availability from `errorPatternsQuery.data`.
- Render a compact checkbox/toggle in the existing `Prompt and goal` details area only when active patterns exist.
- Toggling only changes local state; it must not call `generateStarterPrompt`.
- Include the flag when calling `generateStarterPromptMutation`.

## Constraints

- No persistence for the option.
- No database schema/migration.
- No new IPC channel; reuse `practice:generateStarterPrompt`.
- No provider/runtime setting.
- No review output schema or rewrite task kind changes.
- No D+3/D+7 generation changes.
- No individual pattern picker in this foundation.
- No hidden fingerprints/contracts in prompt-generation context.
- Starter prompt generation must still never send the user's essay/draft content.

## Test Notes

Focused test targets:

- Shared schema:
  - old `{ templateId, userGoal }` inputs still parse.
  - `{ templateId, userGoal, useActivePatterns: true }` parses.

- Service:
  - disabled/default generation omits active-pattern context.
  - enabled generation includes capped active-pattern summaries.
  - provider prompt does not include `writing_content` or draft text.
  - active-pattern context preserves no-outline/no-copyable-answer/no-score/no-timer/no-mock-exam guards.

- Renderer:
  - active-pattern option renders when active patterns exist.
  - option is absent or disabled when no active patterns exist.
  - toggling option does not call `onGenerateStarterPrompt`.
  - click Generate passes the current option state.

## Risk Notes

- Automatically using patterns would make prompt generation feel like a hidden curriculum shift. Keep it opt-in.
- Creating rewrite tasks from this option would blur starter prompts with evidence-affecting transfer practice. Keep rewrite task creation on the existing delayed-transfer path.
- Exposing individual pattern selection is likely useful later, but it adds state and layout complexity not needed for the first foundation.
