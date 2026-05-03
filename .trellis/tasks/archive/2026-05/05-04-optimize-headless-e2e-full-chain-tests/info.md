# Technical Design: Deterministic Headless UI E2E

## Chosen Direction

Build a deterministic, DOM-driven headless UI e2e for the review -> feedback save -> D+1 rewrite practice chain.

The default command should be:

```bash
pnpm test:e2e
```

This command should not require real provider credentials. It should launch real Electron, interact with the React UI through CDP DOM operations, and use an e2e-only mock AI provider path for fixed review and rewrite-check outputs.

Preserve the current live-provider check as a separate command, likely:

```bash
pnpm test:e2e:live
```

## Key Decisions

* Use existing Electron Forge + CDP launch infrastructure rather than adding Playwright.
* Add minimal `data-e2e` selectors where UI text/ARIA selectors are ambiguous or fragile.
* Keep mock provider hidden behind an e2e-only runtime switch such as `INKLINE_E2E_AI_MOCK=1`.
* Do not add `mock` to public provider schemas, Settings options, or normal user-facing provider UI.
* Enable mock output only when the e2e flag is set and runtime is not production.
* Store deterministic fixtures under `test/fixtures/`, not in product/shared contracts.
* Exclude starter prompt generation from the default mock UI e2e path.
* Keep `pnpm check` unchanged; Electron e2e remains explicit.

## Mock Provider Shape

The e2e mock provider should return fixed structured outputs at the shared structured-generation boundary:

* `schemaName === "review_output"` returns a valid review contract fixture matching the fixed sample writing.
* `schemaName === "rewrite_check_evaluation"` returns a fixed rewrite-check outcome and feedback.

The mock must not call external network providers and must not require real API keys. The UI may still exercise provider/settings/credential screens with dummy values if that remains useful for the user path.

Production/package runtime must not return mock output even if `INKLINE_E2E_AI_MOCK=1` is present.

## UI E2E Phases

1. UI test foundation
   * CDP DOM driver: wait, click, fill, text/visibility checks, screenshot on failure.
   * Fresh temp config/data root and isolated keychain service per run.
   * E2E-only Chromium launch flags where needed.
2. App entry and provider setup
   * Dismiss onboarding through UI when present.
   * Navigate to Settings.
   * Reach configured provider state without real network credentials.
3. Review generation
   * Navigate to Practice.
   * Enter fixed writing and optional goal.
   * Skip/ignore starter prompt.
   * Click `Get Feedback`, acknowledge disclosure, wait for review-ready UI.
4. Feedback persistence
   * Open focused review.
   * Assert feedback evidence appears.
   * Enter self-repair rewrite.
   * Save review and verify saved state.
5. D+1 rewrite practice
   * Return to Practice.
   * Verify D+1 practice card appears.
   * Submit fixed rewrite answer.
   * Wait for deterministic rewrite-check completion.

## Failure Diagnostics

For mock UI e2e failures:

* Print the current phase and sanitized summary.
* Capture a bounded screenshot such as `test-results/review-ui-e2e/failure.png`.
* Include bounded visible DOM/title/button summary.
* Do not print secrets, password input values, raw model JSON, or non-fixture writing content.

For live-provider e2e, do not capture screenshots by default because real user writing/provider output may appear.
