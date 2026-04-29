# v0.1 review agent integration

## Goal

Connect the journal review action to pi-mono while enforcing provider disclosure, bounded context, structured JSON output, and client-side validation before any learning history is saved.

## Requirements

- Implement Review button flow for the current journal revision.
- Before first review, display provider/model/privacy disclosure and require acknowledgement.
- Build `ReviewInput` with current date, journal content, content hash, selected existing patterns, and v0.1 caps.
- Limit existing patterns to at most 30 and exclude spelling by default.
- Call pi-mono review agent through the main process, not the renderer.
- Delimit journal content as untrusted text in the agent prompt.
- Require JSON output matching the review schema.
- Persist review run status transitions: `reviewing`, `review_ready`, `review_failed`.
- Store validation errors when schema or contract validation fails.
- Respect raw model response setting: production default is not to save raw output.

## Acceptance Criteria

- [ ] Review cannot run without provider/model disclosure acknowledgement on first use.
- [ ] Review calls are made from the main process.
- [ ] Agent input uses v0.1 caps.
- [ ] Journal content is clearly delimited as untrusted content.
- [ ] Valid output transitions review run to `review_ready`.
- [ ] Invalid output transitions review run to `review_failed` or equivalent invalid validation state without learning-history writes.
- [ ] Raw output is stored only when settings allow it.

## Definition of Done

- Tests cover review input construction, first-review disclosure gate, status transitions, raw-output setting, and validation failure.
- Typecheck and lint pass.

## Technical Approach

Reuse the contract harness validation instead of creating a second validation path. Treat pi-mono as a dependency behind a narrow service interface so mock outputs remain testable.

## Out of Scope

- Designing the full Review Result UI.
- Saving review results into learning history.
- Rewrite-check agent.
- Anki/CET/drill integrations.

## Technical Notes

- Product references: `.trellis/spec/product/review-agent-contract.md`, `.trellis/spec/product/privacy-security.md`, `.trellis/spec/product/mvp-scope.md`.
