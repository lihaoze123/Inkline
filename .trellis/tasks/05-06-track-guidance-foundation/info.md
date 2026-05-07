# Implementation Notes

## Recommended Shape

Add a shared optional `trackGuidance` object to writing templates:

```ts
trackGuidance?: {
  starterPromptFocus: string;
  reviewLens: string;
  rewritePracticeFocus: string;
};
```

Recommended implementation flow:

- Define the Zod schema in the shared writing template schema.
- Populate `trackGuidance` for all entries in `WRITING_TEMPLATES`.
- Extend review contract input `writingTemplate` with optional `trackGuidance`.
- Pass `template.trackGuidance` from review start into `buildReviewInput`.
- Keep `buildBoundedReviewInput` as the validation boundary.
- Include `starterPromptFocus` in starter prompt user prompt text when present.
- Include `reviewLens` and `rewritePracticeFocus` in review prompt context when present.
- Add a review prompt rule that the single `rewrite_original` task should follow `rewritePracticeFocus`.

## Constraints

- Do not add database tables, columns, migrations, IPC channels, provider settings, provider calls, template IDs, review output fields, or rewrite task kinds.
- Do not introduce UI behavior for this task.
- Do not duplicate guidance strings across starter/review prompt files; source them from the shared template metadata.
- Keep writing content wrapped as untrusted review input and do not change prompt safety rules.
- Keep `trackGuidance` optional for backward compatibility with any older serialized writing snapshots or test fixtures.
- Preserve the existing caps and exactly-one-focus-pattern contract.

## Suggested Test Targets

- Shared template/schema test:
  - All `WRITING_TEMPLATES` parse with `writingTemplateSchema`.
  - Each built-in template has non-empty `trackGuidance` fields.

- Starter prompt test:
  - Prompt text for CET-4 or CET-6 includes the selected template's starter focus.
  - Prompt text still includes forbidden behavior guards for timers, scores, word-count targets, mock-exam instructions, and essay drafting/outlining.

- Review input/prompt test:
  - Review start or `buildReviewInput` includes selected template `trackGuidance` in the persisted input snapshot.
  - `buildReviewUserPrompt` includes review lens and rewrite practice focus.
  - Review prompt still requests `kind rewrite_original` and does not mention new rewrite task kinds.

## Risk Notes

- Adding a new persisted track model would reopen export/migration scope for little value at this stage.
- Adding track-specific review output fields would require contract-harness and persistence changes; keep guidance prompt-only.
- Adding new-context generation now would overlap the later roadmap item and should remain a separate PRD.
- Hardcoding guidance separately in starter and review prompts would make future track edits drift; keep one shared template source.
