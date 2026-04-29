# English Journal Coach MVP framework

## Goal

Turn `.trellis/tasks/04-29-english-journal-coach-mvp/source-prd.md` into an implementable Trellis task tree for a local-first Electron English journal coach. The MVP should validate whether daily journal review is valuable and low-friction before building long-term learning assets.

## Requirements

- Preserve the PRD's local-first architecture: Electron app owns state, SQLite persistence, settings, privacy, and UI; pi-mono agents return structured language judgments.
- Deliver v0.1 as a sequence of implementation tasks:
  1. Project foundation.
  2. Review contract harness.
  3. Journal editor and autosave.
  4. Review agent integration.
  5. Review result learning flow.
  6. D+1 rewrite practice.
- Keep v0.2 learning assets in a backlog task, not in v0.1 implementation scope.
- Use `.trellis/spec/product/` as the product-contract source of truth for implementation and checking.

## Acceptance Criteria

- [ ] Parent task links to all v0.1 child tasks and the v0.2 backlog task.
- [ ] Each child task has a scoped `prd.md` with requirements, acceptance criteria, and out-of-scope notes.
- [ ] Each child task has `implement.jsonl` and `check.jsonl` pointing to product, frontend/backend/shared, and guide specs relevant to that task.
- [ ] v0.1 task boundaries do not require v0.2 features such as full Error Patterns page, rewrite-check, upgrade opportunities, Anki, CET, or Apply correction.

## Definition of Done

- Trellis task tree is valid via `python3 ./.trellis/scripts/task.py validate` for each created task.
- `.trellis/spec/product/` documents MVP scope, learning flow, agent contract, data model, privacy/security, and validation/testing.
- `.trellis/spec/README.md` links the product layer.

## Technical Approach

This is a planning/scaffolding parent task. Implementation should happen in the child tasks in order, with the review contract harness built before UI integration relies on live model output.

## Out of Scope

- Writing application code in this task.
- Choosing a final editor library beyond respecting the annotation-safe editor contract.
- Implementing v0.2 or backlog features.

## Technical Notes

- Source PRD: `.trellis/tasks/04-29-english-journal-coach-mvp/source-prd.md`.
- Product contracts: `.trellis/spec/product/`.
- Generic Electron conventions: `.trellis/spec/frontend/`, `.trellis/spec/backend/`, `.trellis/spec/shared/`.
