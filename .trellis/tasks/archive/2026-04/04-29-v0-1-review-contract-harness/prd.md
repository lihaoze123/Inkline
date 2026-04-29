# v0.1 review contract harness

## Goal

Build the validation harness that turns mock review-agent JSON into validated app operations before the UI depends on live model output.

## Requirements

- Define Zod schemas for review input/output using the PRD contract.
- Implement review result validation for schema, category enum, focus pattern, self-repair task, reference rewrite, rewrite task indexes, and upgrade exclusion.
- Implement quote anchoring against normalized LF content using exact/prefix/suffix and occurrence index.
- Generate JavaScript UTF-16 `start_offset` and `end_offset` for anchored corrections.
- Downgrade failed anchors to low confidence and compute `valid`, `valid_with_warnings`, or `invalid`.
- Generate preview-stage operations for corrections, pattern reuse/new pattern suggestions, reference rewrite, self-repair, and rewrite practice without writing long-term statistics.
- Test `saveReviewRun` idempotency assumptions using a stub or early persistence layer when available.
- Provide CLI or test-script output showing validation result, anchoring success rate, generated operations, and validation status.

## Acceptance Criteria

- [ ] Harness accepts a sample journal, mock agent output, and existing patterns.
- [ ] Harness reports schema validation result.
- [ ] Harness reports anchoring success rate.
- [ ] Harness reports generated corrections, pattern operations, rewrite practice operations, and validation status.
- [ ] Required edge cases from `.trellis/spec/product/validation-and-testing.md` are covered.
- [ ] Every valid review derives exactly one focus correction.
- [ ] Invalid output cannot produce long-term history operations.
- [ ] Repeated save simulation cannot duplicate pattern counts or rewrite tasks.

## Definition of Done

- Unit tests cover normal and invalid mock outputs.
- Anchoring test set includes repeated phrases, multiline text, Chinese/English mix, curly quotes, irregular spaces, and paraphrased original text.
- Typecheck and lint pass.

## Technical Approach

Implement this before live model integration. Prefer pure functions for schema validation, anchoring, and operation generation so later UI and main-process services reuse the same contract.

## Out of Scope

- Live pi-mono calls.
- Full Review Result UI.
- Real Error Patterns page.
- Rewrite-check agent.

## Technical Notes

- Product references: `.trellis/spec/product/review-agent-contract.md`, `.trellis/spec/product/validation-and-testing.md`, `.trellis/spec/product/data-model-contract.md`.
