# Optimize Headless E2E Full-Chain Tests

## Goal

Further optimize Inkline's headless e2e coverage so the real Electron review loop can be verified more completely and repeatably without relying on manual UI interaction.

## What I Already Know

* The user wants to further optimize full-chain testing based on headless e2e.
* The repo currently exposes `pnpm test:e2e`, implemented by `scripts/review-provider-e2e.ts`.
* The existing e2e script loads project-root `.env`, launches Electron through Forge with a remote debugging port, connects to the real renderer through CDP, and evaluates through `window.api`.
* The current full-chain path covers provider config, default provider, keychain credential save, review thinking setting, disclosure acknowledgement, writing save, review start, preview fetch, and sanitized diagnostics.
* The existing e2e is intentionally outside `pnpm test` because it requires live provider credentials.
* The user now wants the full UI e2e to use a mock AI provider with a fixed deterministic test path.
* The current implementation is closer to a renderer/preload IPC workflow check than a user-level UI workflow test because it drives `window.api` directly instead of interacting with DOM controls.
* Renderer components expose some accessible labels/buttons that could be used for a DOM-driven UI e2e, but there are no dedicated `data-testid` hooks yet.
* The first-launch onboarding intro appears in isolated app data and can block the UI e2e until dismissed through the UI.
* The main navigation exposes visible buttons for Today, Practice, Notebook, Progress, and Settings; Feedback is hidden and opened from the review-ready panel.
* Writing UI has an accessible textarea label based on the selected template title and a visible `Get Feedback` button after content is entered/autosaved.
* Settings UI has accessible provider/model/key inputs, but OpenAI-compatible and Anthropic sections reuse generic `Save settings` / `Save API key` button text, so stable section-scoped querying or test ids would make UI automation less fragile.
* Existing specs require live-provider e2e logs to avoid API keys, Authorization headers, raw provider response bodies, raw model output JSON, and writing content beyond the fixed fixture sample. The new deterministic mock-provider UI e2e should preserve the same privacy posture even though it should not need real secrets.
* Existing specs require Electron/CDP validation for renderer-sensitive behavior and explicit reporting when manual UI interaction is not possible.

## Assumptions

* This task should improve the current `pnpm test:e2e` path rather than replace the unit/integration test suite.
* The deterministic UI e2e should not require live provider credentials.
* The optimization should preserve isolated app data and isolated keychain service behavior.
* Each deterministic mock UI e2e run should start from a fresh empty app data/config directory.

## Requirements

* Keep e2e execution headless-friendly and runnable from a single package script.
* Preserve the existing real Electron/CDP boundary rather than replacing the check with a Node-only service harness.
* Use a mock AI provider path for the full UI e2e so review output and rewrite-check output are deterministic.
* Keep deterministic e2e fixtures in test-owned files and avoid turning them into product contracts.
* Ensure the e2e mock provider cannot be enabled in production/package runtime.
* Make the default `pnpm test:e2e` command run the deterministic mock UI full-chain.
* Preserve the current live-provider e2e as a separate command that remains optional and env-gated.
* Keep `pnpm check` as the existing fast quality gate; do not add Electron e2e to the default check command in this task.
* Allow e2e-only Electron/Chromium launch flags that make headless/CI execution stable without changing the normal `pnpm dev` command.
* Ensure each deterministic mock UI e2e run uses isolated temporary app config/data and an isolated test keychain service.
* Add a small number of stable `data-e2e` selectors to controls that are required by the UI e2e path when existing accessible labels/text are ambiguous or fragile.
* Preserve strict secret and raw-output redaction.
* Improve failure output so the failing phase is easy to identify without exposing sensitive payloads.
* On mock UI e2e failure, capture bounded visual/DOM diagnostics to make headless failures debuggable.
* Keep the no-live-env path runnable and deterministic instead of skipping.
* Add or update automated tests for any new reusable e2e helpers.

## Acceptance Criteria

* [ ] `pnpm test:e2e` runs a deterministic mock-provider full-chain UI e2e without requiring live-provider env vars.
* [ ] A separate live-provider e2e command remains available for `E2E_OPENAI_COMPATIBLE_*` checks and still skips cleanly when required env vars are missing.
* [ ] The e2e check verifies the selected full-chain scope through a real Electron renderer.
* [ ] The full-chain UI e2e is split into named subtask phases so failures identify whether setup, provider settings, review generation, feedback save, or rewrite practice failed.
* [ ] E2E output identifies setup, launch/CDP, renderer API readiness, provider workflow, validation, diagnostics, and cleanup failures distinctly.
* [ ] No API keys, Authorization headers, raw provider bodies, raw model JSON, or non-fixture writing content are printed.
* [ ] Mock UI e2e failures produce a bounded screenshot and DOM/phase summary without exposing secrets.
* [ ] Relevant helper behavior has focused unit coverage.
* [ ] `pnpm lint`, `pnpm typecheck`, and relevant tests pass.

## Out of Scope

* Making live-provider e2e part of ordinary `pnpm test`.
* Replacing the current Vercel AI SDK review generation path.
* Adding a new provider-management product flow unless required for e2e setup.
* Storing or printing raw provider responses by default.
* Making the mock provider available in normal user-facing Settings outside the e2e/runtime test mode.
* Including starter prompt generation in the default mock UI e2e chain.

## Candidate MVP Scopes

1. Harden the existing CDP `window.api` e2e: structured phases, better diagnostics, stronger cleanup, reusable helpers, and focused tests.
2. Add a true headless UI e2e path: drive the React UI through DOM events in the Electron renderer, while still using the live provider and existing isolated data setup. **Selected.**
3. Add CI-oriented orchestration: keep live-provider e2e optional, add a deterministic no-provider smoke path, and document/run it as part of release verification.

## Selected MVP Scope

Build a true headless UI e2e path that interacts with the React UI inside the real Electron renderer instead of invoking `window.api` directly for the product flow. The test should still use the existing CDP/Electron launch foundation, isolated app data, isolated keychain service, and sanitized output requirements, but the main deterministic path should use a mock AI provider instead of live-provider credentials.

The UI e2e should cover the golden review path:

* Configure provider settings and credential state through the Settings UI as required by the selected mock-provider integration strategy.
* Dismiss the first-launch onboarding intro through the UI when it appears.
* Return to the writing surface.
* Enter the fixed e2e sample writing and optional goal/topic through the editor UI.
* Start review from the UI.
* Acknowledge the review disclosure dialog when shown.
* Wait for review completion.
* Open focused review.
* Assert that focused review UI appears with correction/rewrite evidence.
* Save review and update learning history through the UI.
* Return to the writing surface and verify the D+1 rewrite practice card appears.

The existing direct `window.api` e2e may remain as a lower-level boundary check if useful, but the selected MVP must add or convert to a DOM-driven user path. Direct `window.api` calls should be allowed only for setup/cleanup that cannot reasonably be performed by the UI, not for the main review workflow being validated.

## Full-Chain E2E Subtasks

1. UI test foundation
   * Add minimal `data-e2e` selectors for e2e-critical controls.
   * Add a thin CDP DOM driver for waiting, filling, clicking, and reading text/visibility.
   * Preserve current Electron launch, temporary config, keychain isolation, and cleanup.
   * Start each mock UI e2e from a fresh empty app config/data directory.
2. App entry and provider setup
   * Dismiss first-launch onboarding through the UI when present.
   * Navigate to Settings through the UI.
   * Configure the provider/settings UI path required for the mock-provider run.
   * Ensure the app reaches a configured provider state without real network credentials.
3. Review generation path
   * Navigate to Practice.
   * Enter the fixed sample writing and optional goal/topic through the editor UI.
   * Skip or leave unused the starter prompt generation UI.
   * Click `Get Feedback`.
   * Acknowledge the provider privacy disclosure through the UI when shown.
   * Wait for deterministic mock review completion through visible UI state.
4. Feedback and persistence path
   * Open focused review from the Practice coach panel.
   * Assert `Feedback & Rewrite`, highlighted original draft evidence, focus feedback, and rewrite affordance are visible.
   * Enter a small self-repair rewrite through the feedback UI.
   * Save review and update learning history through the UI.
   * Assert the saved state is visible.
5. D+1 rewrite practice path
   * Return to Practice.
   * Assert the D+1 rewrite practice card appears from the saved review.
   * Submit a fixed rewrite practice answer through the UI.
   * Wait for deterministic mock rewrite-check completion.

Each phase should produce a bounded sanitized summary so a failure does not read like a generic e2e crash.

## Decisions

* Stable selectors: allowed. Add minimal `data-e2e` attributes for the UI e2e path, especially where multiple controls share the same text such as provider `Save settings` and `Save API key`.
* UI automation engine: reuse the existing CDP/Electron launcher and add a thin DOM driver. Do not introduce Playwright in this task. Reconsider Playwright later if multiple UI e2e paths, traces, screenshots, or richer debugging become necessary.
* Scope direction: run a more complete UI chain and split it into named e2e phases/subtasks instead of stopping at the first review preview.
* Provider behavior: use a mock AI provider path for the deterministic UI e2e so review generation and rewrite-check outcomes are fixed and do not depend on external provider availability or model variance.
* Mock provider exposure: implement the mock as an e2e-only hidden runtime switch such as `INKLINE_E2E_AI_MOCK=1`. Do not add `mock` to the public provider list, Settings provider schema, or normal user-facing provider UI.
* E2E command split: default `pnpm test:e2e` should run the deterministic mock UI full-chain. Preserve the current live-provider/CDP check as a separate env-gated command such as `pnpm test:e2e:live`.
* Starter prompt scope: exclude starter prompt generation from the default mock UI e2e. Add a separate future UI e2e for `starter prompt -> writing -> review` if needed.
* Fixture ownership: store deterministic UI e2e inputs/outputs in `test/fixtures/review-ui-e2e.ts` or an equivalent test-owned fixture file. Reuse it from the e2e script and mock-provider adapter.
* Production safety: enable the e2e mock provider only when both a dedicated env flag such as `INKLINE_E2E_AI_MOCK=1` is set and the runtime is not production. Production/package runtime must not return mock AI output even if the env flag is present. Add focused coverage for this guard.
* Quality command scope: do not put the Electron e2e command into `pnpm check` in this task. Keep e2e as an explicit command and consider a separate CI job or `check:e2e` later.
* Headless launch flags: allow the e2e script to pass e2e-only Electron/Chromium flags such as `--remote-debugging-port=<port>`, `--disable-gpu`, a fixed window size, and Linux-only `--no-sandbox` when needed. Do not change the normal `pnpm dev` behavior.
* Failure artifacts: for mock UI e2e only, capture a screenshot such as `test-results/review-ui-e2e/failure.png` and print a bounded sanitized phase/DOM summary on failure. Do not capture screenshots for live-provider e2e by default because it may contain real writing content.
* Isolation: every mock UI e2e run must create a fresh temporary config/data root and a random e2e keychain service name, then best-effort clean both up. It must not reuse the developer's normal Inkline database/settings or production keychain service.
* Subtask model: keep the five full-chain phases inside this PRD rather than creating separate Trellis child tasks, because the implementation touches the same e2e infrastructure and UI selector files.

## Technical Notes

* Relevant code:
  * `scripts/review-provider-e2e.ts`
  * new deterministic UI e2e script, likely `scripts/review-ui-e2e.ts`
  * `test/fixtures/review-provider-e2e.ts`
  * `test/review-provider-e2e-env.test.ts`
  * `package.json`
* Relevant prior task:
  * `.trellis/tasks/archive/2026-05/05-02-review-provider-long-output-observability/prd.md`
* Relevant specs:
  * `.trellis/spec/product/review-agent-contract.md`
  * `.trellis/spec/product/privacy-security.md`
  * `.trellis/spec/product/validation-and-testing.md`
  * `.trellis/spec/frontend/electron-browser-api-restrictions.md`
