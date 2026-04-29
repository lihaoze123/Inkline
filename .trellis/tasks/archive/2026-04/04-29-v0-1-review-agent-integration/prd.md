# v0.1 review agent integration

## Goal

Connect the journal review action to a main-process review-agent boundary while enforcing provider disclosure, bounded context, structured JSON output, and client-side validation before any learning history is saved.

MVP v0.1 does not bind to pi-mono. The client uses a minimal `ReviewModelClient` provider adapter for structured model output, then applies Zod validation, quote anchoring, and persistence in Electron main process. pi-mono remains a v0.2+ optional runtime adapter if the product later needs multi-step agent workflows or controlled tool calls.

## Requirements

- Implement Review button flow for the current journal revision.
- Before first review, display provider/model/privacy disclosure and require acknowledgement.
- Build `ReviewInput` with current date, journal content, content hash, selected existing patterns, and v0.1 caps.
- Limit existing patterns to at most 30 and exclude spelling by default.
- Call the review-agent boundary through the main process, not the renderer.
- Keep live model invocation behind the `ReviewModelClient`/`ReviewAgent` seam; this task wires the app-side boundary, not a concrete provider SDK.
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

Reuse the contract harness validation instead of creating a second validation path. Treat the concrete model provider as a dependency behind a narrow `ReviewModelClient`/`ReviewAgent` service interface so mock outputs remain testable.

The next runtime task should implement the minimal direct provider adapter first: provider/model settings, OS keychain auth, structured output or JSON schema enforcement, timeout/error mapping, raw response capture under the existing privacy setting, and live smoke tests. Do not introduce pi-mono in v0.1 unless a later PRD explicitly requires multi-step agent workflows or controlled tool calls.

## Out of Scope

- Designing the full Review Result UI.
- Wiring a concrete live provider adapter, including provider SDK dependency, keychain auth injection, raw response capture, and live smoke tests.
- Saving review results into learning history.
- Rewrite-check agent.
- Anki/CET/drill integrations.

## Technical Notes

- Product references: `.trellis/spec/product/review-agent-contract.md`, `.trellis/spec/product/privacy-security.md`, `.trellis/spec/product/mvp-scope.md`.
