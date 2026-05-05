# v0.2 learning assets backlog

## Goal

Preserve the post-v0.1 learning-asset roadmap without letting future learning-system behavior leak into earlier implementation tasks. The backlog now treats rewrite-check as completed baseline work and focuses remaining v0.2 scope on proving repair-to-transfer learning evidence.

## Requirements

- Track remaining v0.2 scope as backlog/planned work, not current MVP behavior.
- Treat durable rewrite-check attempts, retryable evaluator failures, and persisted rewrite-check feedback UI as completed baseline behavior.
- Keep remaining v0.2 work focused on the **Prove Pattern Transfer** axis:
  - rewrite task lifecycle: skip, snooze, expire, and retry semantics;
  - pattern evidence labels and mastery-aware Progress;
  - D+3/D+7 delayed new-context reuse;
  - pattern fingerprints and transfer boundaries;
  - hidden new-context prompt contracts;
  - transfer evaluator internal checks/reason codes.
- Include longer-term learning-system maintenance work such as pattern merge/de-dup, apply-correction revisions, local backup/import/export, and eventual learning event logs.
- Keep v0.1 data shapes compatible where explicitly required by a task PRD.
- Do not require future learning UI/workflows for v0.1 acceptance.

## Acceptance Criteria

- [ ] Remaining v0.2 scope is documented and linked from roadmap/specs.
- [ ] Completed rewrite-check work is not presented as unstarted future backlog.
- [ ] Future v0.2 work can start from this task plus `.trellis/spec/product/roadmap.md` without rereading the entire original product PRD.

## Definition of Done

- No code implementation is required for this backlog task.
- The backlog remains planning status until a future task explicitly starts a slice of the learning-evidence roadmap.

## Technical Approach

When the next v0.2 slice starts, split this backlog into separate implementation tasks after the specs are refreshed:

1. Rewrite lifecycle minimal: skip, snooze, expire, retry semantics, and lifecycle copy.
2. Mastery/evidence model: pattern evidence labels and Progress evidence chain.
3. Pattern fingerprints and transfer contracts: saved schema-validated fingerprints, transfer boundaries, hidden prompt contracts, and evaluator diagnostics.
4. D+3/D+7 new-context reuse: progressive task generation using saved fingerprints, hidden prompt contracts, and transfer evaluator semantics.
5. Pattern maintenance: merge/de-dup, richer status lifecycle, apply-correction revisions, and eventual event log.

## Out of Scope

- Reopening completed rewrite-check baseline scope.
- Implementing any remaining v0.2 behavior inside this planning backlog.
- Drill Center, Anki Sync, precise CET scoring, broad ecosystem integrations, or gamified progress until reliable delayed transfer evidence exists.

## Technical Notes

- Product references: `.trellis/spec/product/roadmap.md`, `.trellis/spec/product/mvp-scope.md`, `.trellis/spec/product/learning-flow.md`, `.trellis/spec/product/data-model-contract.md`.
