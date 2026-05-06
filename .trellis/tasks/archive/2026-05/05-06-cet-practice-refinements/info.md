# Implementation Notes

## Recommended Shape

Add a small renderer-only CET guidance component used by the existing Practice workspace when the selected template is `cet4` or `cet6`.

Likely shape:

- `WritingEditorCard` receives enough template metadata to render contextual guidance, or a new child component is placed immediately above the textarea inside the editor column.
- The guidance is derived from `WritingTemplateId`, not from string matching template titles.
- CET-4 and CET-6 copy should differ:
  - CET-4: concise everyday response, clear position, simple organization, accurate reusable pattern.
  - CET-6: argument clarity, coherence, precise expression, evidence/reasoning, reusable pattern.
- The component should return `null` for `journal` and `free`.
- The selected template label remains only in the existing weak editor chrome before `Draft`.

## Constraints

- No timers, word-count targets, scores, official rubric claims, or mock-exam language.
- No new provider calls.
- No new IPC channels.
- No schema/migration changes.
- No alternate review engine or review output shape.
- No blocking modal or required pre-writing checklist.

## Test Notes

Focused renderer tests should use server-side rendering or the repo's existing renderer test style.

Suggested assertions:

- CET-4 renders distinct concise-response guidance.
- CET-6 renders distinct argument/coherence guidance.
- Journal/Free Writing do not render CET guidance.
- Rendered CET guidance does not contain forbidden strings such as `timer`, `word count`, `score`, `mock exam`, or `rubric score`.
- Existing template-aware starter prompt tests remain unchanged unless implementation changes copy in service prompts.

## Risk Notes

- Duplicating template labels would violate the Practice workbench contract.
- Putting CET guidance above the prompt title would compete with the editor-first flow.
- Adding too much checklist copy would make CET feel like a mock-exam simulator.
