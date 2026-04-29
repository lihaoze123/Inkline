# v0.1 D+1 rewrite practice

## Goal

Surface one D+1 `rewrite_original` practice generated from a saved review, without building the complete rewrite queue or rewrite-check agent.

## Requirements

- Generate at most one rewrite task when a review is saved.
- Rewrite task uses `practice_kind = rewrite_original` and `spaced_stage = D+1`.
- Show the pending rewrite practice on Today without blocking new journal writing.
- Practice includes original sentence, focus pattern, input field, and skip action.
- Hide native model until the user submits a rewrite or explicitly reveals if the task supports reveal.
- Store user rewrite and task status updates.
- Expire or de-prioritize tasks older than 7 days so they do not dominate Today.

## Acceptance Criteria

- [ ] Saved review can create one pending D+1 rewrite task.
- [ ] Today displays one pending rewrite practice when available.
- [ ] User can enter a rewrite and mark the task completed.
- [ ] User can skip the practice.
- [ ] Rewrite practice does not block writing today's journal.
- [ ] Native model is hidden until allowed by the flow.
- [ ] Older tasks no longer occupy the main Today position after 7 days.

## Definition of Done

- Tests cover rewrite task creation, status transitions, D+1 due date, skip/complete, and 7-day de-prioritization.
- Manual UI check covers writing a new journal while a rewrite task is pending.
- Typecheck and lint pass.

## Technical Approach

Use the `rewrite_tasks` table and status enum from v0.1, but keep the UI as a Today panel card. Do not create a dedicated Rewrite Queue page yet.

## Out of Scope

- Rewrite-check agent.
- D+3 and D+7 spaced reuse.
- Snooze unless explicitly selected in this task.
- Complete rewrite queue page.
- Successful reuse tracking.

## Technical Notes

- Product references: `.trellis/spec/product/learning-flow.md`, `.trellis/spec/product/data-model-contract.md`.
