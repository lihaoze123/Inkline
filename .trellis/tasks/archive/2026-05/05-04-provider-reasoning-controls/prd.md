# Add Provider-Specific AI SDK Reasoning Controls

## Goal

Make review and rewrite-check provider options use Vercel AI SDK provider-specific reasoning/thinking controls instead of assuming every OpenAI-compatible endpoint accepts `openai.reasoningEffort`. This should address live DeepSeek behavior where disabling review thinking falls back to no explicit setting and the provider still emits reasoning tokens. Also improve the provider settings page so users can select mainstream platforms directly without manually entering a base URL for known providers.

## What I Already Know

* `pnpm run test:e2e:live` against DeepSeek returned `reasoningFallbackUsed: true` after `reasoningRequestedEffort: "none"`, so the current `openai.reasoningEffort: "none"` path is not accepted by that endpoint.
* Review calls build provider options in `src/main/services/review/procedures/start.ts`.
* Rewrite-check calls build provider options in `src/main/services/writing/service.ts`.
* AI SDK calls flow through `src/main/services/ai/generate.ts`, which retries once without `openai.reasoningEffort` when a provider rejects `none`.
* Provider creation currently lives in `src/main/services/ai/provider.ts`.
* Settings currently expose `openai-compatible` and `anthropic` provider IDs. The OpenAI-compatible provider can point at endpoints such as `https://api.deepseek.com/v1`.
* The user wants platform-specific add/select options in the provider settings page, so known platforms do not require base URL input.

## Assumptions

* The first MVP should keep the existing settings UI mostly intact and infer provider-specific options from configured base URL/model when possible.
* DeepSeek should be handled explicitly because it is the failing live provider.
* "Mainstream provider options" means adding structured support for several Vercel AI SDK provider option namespaces and exposing a small set of mainstream provider choices in settings where official AI SDK provider packages exist.

## Requirements

* Research Vercel AI SDK official docs for provider-specific reasoning/thinking settings.
* Replace hard-coded `openai.reasoningEffort` construction with a shared helper that can emit provider-specific options.
* Add platform-specific provider choices to the settings page so users can configure known platforms without entering a base URL.
* Include these provider choices in the MVP: OpenAI, DeepSeek, Anthropic Claude, Google Gemini, xAI Grok, OpenRouter, and Custom OpenAI-compatible.
* Keep a custom OpenAI-compatible option for providers that are not first-class in this MVP.
* Keep review thinking off by default.
* For disabled thinking, avoid sending invalid provider options that trigger fallback and still allow provider-default reasoning.
* Preserve diagnostics for requested/effective reasoning state and fallback behavior.
* Cover review and rewrite-check paths consistently.
* Add or update tests for DeepSeek/openai-compatible fallback and at least a few mainstream provider option variants.

## Acceptance Criteria

* [ ] DeepSeek review calls with thinking disabled no longer send invalid `openai.reasoningEffort: "none"` when official AI SDK docs indicate a provider-specific alternative.
* [ ] Settings expose platform-specific provider choices for selected mainstream providers, with base URL hidden/not required for known providers.
* [ ] Custom OpenAI-compatible settings still allow manual base URL and model entry.
* [ ] Review calls with thinking enabled still request medium reasoning where supported.
* [ ] Rewrite-check calls use the same disabled-thinking option strategy as reviews.
* [ ] Unit tests cover provider-option construction for DeepSeek, OpenAI, Anthropic, and other documented mainstream providers selected for this task.
* [ ] `pnpm lint`, `pnpm typecheck`, and relevant tests pass.

## Definition of Done

* Tests added/updated where behavior changes.
* Lint and typecheck pass.
* Research findings are persisted under `research/`.
* Spec update is considered at finish.

## Out of Scope

* A full provider settings redesign beyond the provider selection/configuration needed here.
* Advanced per-feature provider routing UI.
* Changing prompt content or review contract schemas.
* Solving all model-specific token-budget behavior beyond documented reasoning/thinking provider options.

## Research References

* [`research/vercel-ai-sdk-reasoning-controls.md`](research/vercel-ai-sdk-reasoning-controls.md) — Official AI SDK/provider docs point to first-class provider packages and provider-specific reasoning controls; DeepSeek disables thinking with `providerOptions.deepseek.thinking = { type: "disabled" }`.

## Technical Approach

* Prefer first-class provider IDs for known hosted platforms: `openai`, `deepseek`, `anthropic`, `google`, `xai`, `openrouter`, and `openai-compatible`.
* Add official/provider-documented AI SDK packages where needed: `@ai-sdk/deepseek`, `@ai-sdk/google`, `@ai-sdk/xai`, `@ai-sdk/openai-compatible`, and `@openrouter/ai-sdk-provider`, while preserving existing `@ai-sdk/openai` and `@ai-sdk/anthropic`.
* Expand shared provider schemas, settings snapshots, credential status maps, keychain account mapping, runtime config unions, and provider factory branches for the new provider IDs.
* Settings UI should ask known hosted providers for model and API key only; only Custom OpenAI-compatible should show and require base URL.
* Add a shared provider reasoning-options helper used by review and rewrite-check paths. It should map disabled/enabled review thinking to provider-specific options:
  * DeepSeek: disabled -> `providerOptions.deepseek.thinking = { type: "disabled" }`; enabled -> `providerOptions.deepseek.thinking = { type: "enabled" }`.
  * OpenAI: disabled -> use `none` only where appropriate or a documented minimal setting; enabled -> `medium`.
  * Google/Gemini: disabled -> `thinkingConfig.thinkingBudget = 0` for models that support it; otherwise minimize with documented Gemini 3 controls where feasible.
  * Anthropic/xAI/OpenRouter: avoid inventing unsupported "off" controls; use documented minimize controls where available or no option with clear diagnostics.
  * Custom OpenAI-compatible: keep generic behavior and fallback for provider-dependent `reasoningEffort`.
* Extend diagnostics extraction so requested/effective reasoning state is not derived only from `providerOptions.openai.reasoningEffort`.

## Decision (ADR-lite)

**Context**: The existing settings model has only `openai-compatible` and `anthropic`. DeepSeek currently rides through the OpenAI-compatible path, so disabling thinking sends an invalid OpenAI-style `reasoningEffort: "none"` and then falls back to no explicit thinking control.

**Decision**: Add platform-specific choices as first-class provider IDs: OpenAI, DeepSeek, Anthropic Claude, Google Gemini, xAI Grok, OpenRouter, and Custom OpenAI-compatible.

**Consequences**: This is a broader cross-layer change than a UI preset, but it gives each provider the correct AI SDK package, credential slot, default base URL behavior, and provider-specific reasoning/thinking options. Custom OpenAI-compatible remains available for arbitrary endpoints and local/proxy providers.

## Technical Notes

* Existing failure: DeepSeek rejects `reasoning_effort: none` with an OpenAI-compatible request shape, then the retry removes the reasoning option entirely.
* Current package versions: `ai@^6.0.170`, `@ai-sdk/openai@^3.0.54`, `@ai-sdk/anthropic@^3.0.72`.
* Likely impacted files include `src/main/services/ai/generate.ts`, `src/main/services/ai/provider.ts`, `src/main/services/review/procedures/start.ts`, `src/main/services/writing/service.ts`, and tests under `test/`.
