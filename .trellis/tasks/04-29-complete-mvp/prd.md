# Complete MVP

## Goal

Turn English Coach from a v0.1 scaffold with mock/contract review plumbing into a complete local-first MVP that a user can run, configure with their own provider key, submit today's journal for a real review, save the review, and receive one follow-up D+1 rewrite practice.

## What I already know

- The product goal is a local-first desktop writing coach for Chinese native speakers practicing English through daily journaling.
- v0.1 scope includes local database initialization, journal editor, autosave, review current journal, correction list, original-text annotations, saved review runs, exactly one focus pattern, hint-first self-repair, at least one `What you did well` item, one reference rewrite, `Notice the gap`, one rewrite practice, provider privacy disclosure, and review contract harness.
- README claims most v0.1 flow exists, but also states the default live review agent adapter is not configured.
- Current review adapter at `src/main/services/review/lib/pi-mono-agent.ts` always throws `pi-mono review agent is not configured.`
- Settings currently reports provider/model as `Not configured` and `piMonoAuthStatus` as `not-configured`.
- Keytar credential helpers exist, but IPC exposes only provider key status, not setting or deleting the key.
- Project memory says v0.1 should use a minimal direct provider adapter behind `ReviewModelClient`/`ReviewAgent`, not pi-mono by default.
- Existing scripts include lint, typecheck, tests, review harness, package, and make.

## Assumptions (temporary)

- A complete MVP means real review is usable with a user-provided OpenAI-compatible API key, not just mock review contract tests.
- The first live provider is a minimal OpenAI-compatible direct adapter; it does not need pi-mono, tools, multi-step agent sessions, Anki, dashboard, or v0.2 learning assets.
- Provider credentials should remain in the OS keychain boundary; renderer should only access credential status and explicit set/delete IPC methods.
- The live adapter should reuse the existing review contract validation rather than adding an alternate persistence path.

## Open Questions

- None. User selected OpenAI-compatible as the first live review provider boundary.

## Requirements (evolving)

- Keep existing v0.1 writing/review/save/rewrite-practice flow intact.
- Add the minimum OpenAI-compatible provider configuration path needed for a local user to make live review work: base URL, model, and API key.
- Add a direct OpenAI-compatible live review adapter behind the existing review boundary.
- Keep raw response storage disabled by default and controlled by the existing settings path.
- Preserve v0.1 hard caps and validation behavior from `.trellis/spec/product/mvp-scope.md` and `.trellis/spec/product/data-model-contract.md`.
- Do not implement v0.2 learning assets, dashboards, Anki, CET, Drill Center, Apply correction, or a full provider-management system.

## Acceptance Criteria (evolving)

- [ ] A user can configure, update, and delete the OpenAI-compatible base URL, model, and provider API key through app IPC and UI without exposing the key back to the renderer.
- [ ] Settings shows `OpenAI-compatible`, the configured model/base URL, and accurate provider key status.
- [ ] Clicking Review with a configured key calls the OpenAI-compatible direct adapter and stores a validated preview in the existing review flow.
- [ ] Clicking Review without a configured/unavailable key returns a clear recoverable error.
- [ ] The adapter enforces the existing v0.1 review schema/caps and supports the existing review harness/test path.
- [ ] Saving a live review uses the existing save transaction and can create the D+1 rewrite practice when valid.
- [ ] Lint, typecheck, tests, and review harness pass.
- [ ] README/user-facing claims are updated so a local MVP user knows how to configure and run review.

## Definition of Done (team quality bar)

- Tests added/updated for provider settings, credential IPC, live-adapter error mapping/parsing, and review start behavior with an injected/mock model response.
- Lint, typecheck, unit/integration tests, and review harness pass.
- User-facing docs updated if behavior changes.
- Rollback is simple: removing provider config/key leaves local journal/autosave and mock/contract tests unaffected.

## Out of Scope (explicit)

- pi-mono as the default v0.1 review runtime.
- Multiple provider selection UI beyond the first MVP provider/model.
- Streaming review UI.
- Tool-using agents, transcript replay, or agent session management.
- v0.2 Error Patterns page, mastery dashboard, pattern merge/de-dup UI, rewrite-check agent, D+3/D+7 reuse, upgrades/lexicon, Apply correction, Anki, CET, and Drill Center.

## Technical Approach

Use the existing review boundary and validation pipeline. Add the smallest OpenAI-compatible chat-completions adapter needed to produce the existing `ReviewAgent` JSON shape, add secure key set/delete IPC plus persisted base URL/model settings, expose a minimal settings UI for status/configuration, and add tests around the configured and unconfigured paths.

## Decision (ADR-lite)

**Context**: The current default review adapter is a pi-mono stub, but the project memory and v0.1 scope favor a minimal direct provider adapter for proving the learning loop.
**Decision**: Implement an OpenAI-compatible direct adapter first, configurable by base URL, model, and OS-keychain API key.
**Consequences**: This keeps the MVP provider-flexible without introducing pi-mono runtime complexity, but the UI must validate enough settings to avoid unclear review failures.

## Technical Notes

- Product specs inspected: `.trellis/spec/product/mvp-scope.md`, `.trellis/spec/product/data-model-contract.md`, `.trellis/spec/product/learning-flow.md`.
- Existing implementation notes: `src/main/services/review/lib/pi-mono-agent.ts` is currently a throwing stub.
- Existing credential helpers: `src/main/services/credentials/service.ts` has `getProviderKeyStatus`, `setProviderApiKey`, and `deleteProviderApiKey`.
- Existing channels: `src/shared/constants/channels.ts` exposes credential status only.
- README says live review requires providing a review agent adapter, which is the main complete-MVP blocker.
