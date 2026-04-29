# v0.1 review agent integration

## Goal

Connect the journal review action to a main-process review-agent boundary while enforcing provider disclosure, bounded context, structured JSON output, and client-side validation before any learning history is saved.

Live pi-mono runtime invocation is deferred until a concrete project contract exists for package/version, SDK or CLI/RPC mode, auth/model configuration, no-tool policy, and structured JSON extraction.

## Requirements

- Implement Review button flow for the current journal revision.
- Before first review, display provider/model/privacy disclosure and require acknowledgement.
- Build `ReviewInput` with current date, journal content, content hash, selected existing patterns, and v0.1 caps.
- Limit existing patterns to at most 30 and exclude spelling by default.
- Call the review-agent boundary through the main process, not the renderer.
- Keep live pi-mono invocation behind the `ReviewAgent` seam until the pi-mono integration contract is defined.
- Delimit journal content as untrusted text in the agent prompt.
- Require JSON output matching the review schema.
- Persist review run status transitions: `reviewing`, `review_ready`, `review_failed`.
- Store validation errors when schema or contract validation fails.
- Respect raw model response setting: production default is not to save raw output.

## Acceptance Criteria

- [ ] Review cannot run without provider/model disclosure acknowledgement on first use.
- [ ] Review calls enter the review-agent boundary from the main process only.
- [ ] Agent input uses v0.1 caps.
- [ ] Journal content is clearly delimited as untrusted content.
- [ ] Valid output transitions review run to `review_ready`.
- [ ] Invalid output transitions review run to `review_failed` or equivalent invalid validation state without learning-history writes.
- [ ] Raw output is stored only when settings allow it.

## Definition of Done

- Tests cover review input construction, first-review disclosure gate, status transitions, raw-output setting, and validation failure.
- Typecheck and lint pass.

## Technical Approach

Reuse the contract harness validation instead of creating a second validation path. Treat the future pi-mono runtime as a dependency behind a narrow `ReviewAgent` service interface so mock outputs remain testable.

Research in `research/pi-mono-integration.md` found no current local pi-mono invocation contract. Do not invent one in this task; define it separately before wiring the live runtime.

## Out of Scope

- Designing the full Review Result UI.
- Choosing or wiring the concrete live pi-mono SDK/CLI/RPC integration.
- Saving review results into learning history.
- Rewrite-check agent.
- Anki/CET/drill integrations.

## Technical Notes

- Product references: `.trellis/spec/product/review-agent-contract.md`, `.trellis/spec/product/privacy-security.md`, `.trellis/spec/product/mvp-scope.md`.
