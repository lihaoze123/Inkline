# Review Provider Long Output Observability

## Goal

Make the review workflow tolerate AI providers that spend a large token budget on reasoning before producing final JSON, and make provider failures easier to diagnose from persisted review run details.

## What I Already Know

* The user initially wanted longer timeout, acceptance of long output, and stronger observability.
* The user then clarified that review thinking/reasoning should be disabled by default, with an explicit on/off control.
* Thinking control should use Vercel AI SDK provider options, not provider-specific DeepSeek API documentation.
* Current saved provider testing showed the configured OpenAI-compatible DeepSeek endpoint and API key work.
* The observed failing review run returned `AI_NoOutputGeneratedError: No output generated.`
* Raw DeepSeek testing showed `finish_reason: "length"` with output tokens consumed by reasoning before usable JSON content was available.
* The current review agent uses `timeoutMs: 60_000` and `maxOutputTokens: 2_500`.
* The UI currently maps this failure into a generic provider error message.

## Requirements

* Disable OpenAI-compatible review reasoning/thinking by default where the Vercel AI SDK/provider supports it using `providerOptions.openai.reasoningEffort = 'none'`.
* If an OpenAI-compatible provider rejects AI SDK `reasoningEffort: 'none'` as an unsupported enum value, retry once without the `reasoningEffort` field, keep the user-facing review result normal when validation passes, and persist sanitized diagnostics that fallback/provider-default behavior was used.
* Support an explicit Settings toggle to enable or disable review thinking. If enabled, use the AI SDK OpenAI provider option for reasoning effort rather than a provider-specific request body.
* Keep the longer review timeout and output budget because enabled thinking may take much longer and consume reasoning tokens.
* Preserve existing review validation: long output is acceptable only if the final content parses and passes the review contract.
* Improve persisted observability for provider calls, including enough detail to distinguish timeout, output-length truncation, no-output, schema validation, app validation, and whether review thinking was enabled.
* Surface provider diagnostics in the user-facing shell/renderer details so users can inspect finish reason, token counts, reasoning tokens, cache tokens, response model/id, metadata keys, error name, and safe error category/message.
* Use the user's already-saved provider settings/credentials for a real workflow check after implementation.
* Do not stop at a mocked pass: when review thinking is enabled, repeatedly inspect provider diagnostics and adjust the review call until the real saved provider returns normal structured output that passes the review contract, or record the exact remaining external blocker.
* Add an e2e test entrypoint that loads provider configuration from local `.env` environment variables and runs the full review generation/validation path against a real provider without logging secrets or raw provider bodies.
* The e2e test must run through an actual Electron/Chromium renderer via Chrome DevTools Protocol (CDP), not only a Node CLI service harness. It may use CDP runtime evaluation to drive the renderer/preload IPC boundary, but it must connect to a real browser target.
* Keep raw provider response storage behind the existing raw-response setting; do not expose API keys or sensitive secrets.
* Keep starter prompt behavior unchanged unless shared AI plumbing requires a compatible metadata change.

## Acceptance Criteria

* [x] Review calls use a longer timeout than the current 60 seconds.
* [x] Review calls use a larger output token budget than the current 2,500 tokens.
* [x] A no-output provider failure records a more specific diagnostic than the generic provider error category alone.
* [x] Provider finish reason, usage/token details, and warning metadata are captured when available without saving raw response content unless enabled.
* [x] OpenAI-compatible review calls request reasoning off by default through Vercel AI SDK provider options, and incompatible providers fall back once without failing the review solely because `none` was rejected.
* [x] Settings exposes an explicit review thinking toggle, with copy that it can make review much slower when enabled.
* [x] Provider diagnostics record whether review thinking was enabled and surface that in renderer details.
* [x] Zod/schema failures after provider completion are classified observably as validation/schema failures rather than generic provider errors.
* [x] A real saved-provider workflow check passes with review thinking disabled.
* [x] A real saved-provider workflow check passes with review thinking enabled, or the diagnostics identify a non-code external blocker after attempted adjustment.
* [x] E2E test script exists and reads local `.env` variables for provider base URL, model, key, and thinking mode checks.
* [x] E2E launches or attaches to an actual Electron/Chromium renderer over CDP and drives the app through the renderer/preload boundary.
* [x] E2E implements the full provider -> structured output -> review contract validation path and limits output to sanitized status/diagnostics without printing secrets or raw provider response content.
* [x] Existing review validation tests still pass.
* [x] Focused tests cover the new provider observability behavior.
* [x] `pnpm lint` and `pnpm typecheck` pass.

## Definition of Done

* Tests added or updated for timeout/output budget and observability.
* Lint and typecheck pass.
* No raw provider content is saved unless the existing raw-response storage setting allows it.
* The change is scoped to review provider execution and persisted diagnostics.

## Technical Approach

Adjust the review agent request constants, add an explicit review thinking setting, pass Vercel AI SDK OpenAI provider options from the review generation call, and expand the generated AI metadata captured from the AI SDK result. Persist a sanitized provider diagnostic in review run summary and validation errors so users and developers can identify whether reasoning was enabled, whether the provider exhausted output length, returned no content, timed out, or failed validation.

## Decision

**Context**: Thinking models may legitimately produce long reasoning output, but the app still needs final content that is complete JSON. The user wants this off by default because it is slow and can consume most of the output budget.

**Decision**: Use Vercel AI SDK OpenAI provider options for OpenAI-compatible review calls. Default review thinking to off where supported with `reasoningEffort: 'none'`; if a compatible provider rejects that SDK enum before producing output, retry once without the field and record bounded diagnostics that provider-default behavior was used. When the user enables the toggle, use the SDK's `reasoningEffort: 'medium'`. Keep longer timeout/output budget and improve observability for slow thinking runs.

**Consequences**: Default reviews should be faster and less likely to spend tokens on reasoning where the provider honors the SDK off setting. Some OpenAI-compatible providers may not support `none`; those reviews should still work through the fallback path, but diagnostics must show requested effort, effective/provider-default behavior, and fallback use. Enabled thinking reviews may take longer and cost more tokens, but provider diagnostics should make that visible.

## Out of Scope

* Multiple reasoning effort levels beyond a simple on/off toggle.
* Switching the user's saved model automatically.
* Storing API keys or raw provider body content in diagnostics.
* Redesigning the review schema.

## Technical Notes

* Relevant files:
  * `src/main/services/review/lib/openai-compatible-agent.ts`
  * `src/main/services/ai/generate.ts`
  * `src/main/services/review/procedures/start.ts`
  * `src/shared/types/review.ts`
  * `src/renderer/components/LearningPanel.tsx`
  * `test/review-start-observability.test.ts`
  * `test/ai-generation-service.test.ts`
* `scripts/review-provider-e2e.ts`
  * `test/fixtures/review-provider-e2e.ts`
* Relevant specs:
  * `.trellis/spec/product/review-agent-contract.md`
  * `.trellis/spec/product/privacy-security.md`
  * `.trellis/spec/product/validation-and-testing.md`
  * `.trellis/spec/backend/error-handling.md`
  * `.trellis/spec/backend/logging.md`
  * `.trellis/spec/backend/type-safety.md`
  * `.trellis/spec/shared/code-quality.md`
  * `.trellis/spec/shared/typescript.md`

## E2E Environment

The live provider e2e command is separate from normal unit tests:

```bash
pnpm test:e2e
```

It loads a project-root `.env` file when present and reads these env vars:

* `E2E_OPENAI_COMPATIBLE_API_KEY` - required API key for the live provider.
* `E2E_OPENAI_COMPATIBLE_BASE_URL` - required OpenAI-compatible base URL.
* `E2E_OPENAI_COMPATIBLE_MODEL` - required model name.
* `E2E_OPENAI_COMPATIBLE_INCLUDE_THINKING` - optional boolean (`1`, `true`, `yes`, `on`) to also run the thinking-enabled `reasoningEffort: 'medium'` check.
* `E2E_CDP_PORT` - optional CDP port override for debugging; when absent the script chooses a free port.

When required env vars are absent, `pnpm test:e2e` prints a skipped status with missing env var names only. When env vars are present, `pnpm test:e2e` must connect to a real Electron/Chromium renderer target through CDP and drive the app through the renderer/preload IPC boundary. The e2e output is intentionally limited to validation status and sanitized provider diagnostics; it must not print API keys, Authorization headers, raw provider response bodies, model output JSON, or writing content beyond the fixed sample in `test/fixtures/review-provider-e2e.ts`.

The CDP e2e launcher starts Electron through Forge with `--remote-debugging-port=<port>`, waits for `/json/list`, connects to the app page target's `webSocketDebuggerUrl`, and uses native `Runtime.evaluate` calls against `window.api`. The child process uses a temporary `XDG_CONFIG_HOME` and a random `INKLINE_KEYCHAIN_SERVICE_NAME`, so provider settings/data and the e2e API key do not mutate the developer's normal app database or `Inkline` keychain entry. In Nix-like environments, the launcher best-effort prepends a detected `libsecret-1.so.0` library directory to `LD_LIBRARY_PATH` so Electron's `keytar` dependency can use the OS keychain path. The script best-effort deletes the test keychain entry and removes the temporary config directory during cleanup.
