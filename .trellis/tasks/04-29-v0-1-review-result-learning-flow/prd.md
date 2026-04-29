# v0.1 review result learning flow

## Goal

Implement the review preview and save experience that turns a validated review into a learning path: positive evidence, one focus pattern, hint-first self-repair, corrections, reference rewrite, notice-the-gap, and saved learning history.

## Requirements

- Render validated review preview in the PRD order:
  1. What you did well.
  2. Today's Focus Pattern.
  3. Focus correction hint.
  4. User self-repair attempt or reveal model.
  5. Other corrections.
  6. Reference rewrite + Notice the gap.
  7. Rewrite practice.
- Enforce exactly one focus pattern and one focus correction.
- Do not reveal the corrected focus answer until the user attempts self-repair or clicks reveal.
- Show concrete `What you did well` entries before corrections.
- Highlight anchored corrections in the original text without mutating journal content.
- Fold low-confidence corrections into `Other suggestions`.
- Use primary button copy: `Save review and update learning history`.
- Saving review writes review artifacts and learning-history updates atomically and idempotently.
- After save, update `journal_entries.last_review_run_id` and preserve older saved reviews as history.

## Acceptance Criteria

- [ ] Review preview follows the required learning order.
- [ ] Focus hint does not leak the full corrected text.
- [ ] User can submit a self-repair attempt or reveal the model answer.
- [ ] Anchored corrections highlight the reviewed text version.
- [ ] Low-confidence corrections are not used for pattern counts or rewrite practice.
- [ ] Save action is atomic and idempotent.
- [ ] Preview does not update long-term statistics before save.
- [ ] Editing journal after save marks the review stale for current highlighting.

## Definition of Done

- Tests cover save transaction, idempotency, low-confidence exclusion, and stale-review behavior.
- Manual UI check covers valid, valid-with-warnings, and invalid/no-preview paths.
- Typecheck and lint pass.

## Technical Approach

Keep preview state separate from persisted saved-review state. Use the harness-generated operations as the persistence input to avoid divergence between test contract and UI behavior.

## Out of Scope

- Apply correction.
- Full Error Patterns page.
- Upgrade opportunities / lexicon entries.
- Complete rewrite queue.
- Rewrite-check agent.

## Technical Notes

- Product references: `.trellis/spec/product/learning-flow.md`, `.trellis/spec/product/data-model-contract.md`, `.trellis/spec/product/review-agent-contract.md`.
