# Support model selection beyond free text

## Goal

Make the Settings model control easier to use by clearly representing provider-specific model ID entry while preserving arbitrary model IDs for direct providers whose model routes change frequently or are user-defined.

## What I already know

- The current Settings provider flow renders only the selected provider's settings.
- The current Model control in `src/renderer/components/SettingsPage.tsx` is a plain text input.
- Provider IDs are `openai`, `deepseek`, `anthropic`, `google`, `xai`, `openrouter`, and `openai-compatible`.
- The main-process settings service stores model IDs as strings and already trims/persists arbitrary model values.
- Default model IDs already exist in `src/main/services/settings/service.ts` and the renderer receives saved values through `SettingsSnapshot`.

## Requirements

- Replace the bare model field with a provider-aware model ID control.
- Do not hardcode provider model catalogs in renderer code; AI SDK direct provider docs accept model IDs as strings and do not expose runtime direct-provider model discovery.
- Preserve arbitrary model entry for every provider so users are not blocked by stale built-in lists.
- Treat saved arbitrary models as editable values rather than dropping or overwriting them.
- Keep provider switching behavior unchanged: hidden provider model inputs remain preserved in renderer state.
- Do not change API key handling; keys remain write-only and key inputs continue to clear only after successful key save.
- Do not add renderer access to provider SDKs, keychain, Electron Store, filesystem, or network model discovery.

## Acceptance Criteria

- [ ] Settings renders a provider-aware model ID control for the selected provider.
- [ ] Editing the model ID updates the same model value that Save provider persists.
- [ ] Arbitrary custom model values remain visible and editable for every provider.
- [ ] Saved model IDs that are not known to the app remain visible rather than being dropped or overwritten.
- [ ] OpenAI-compatible and OpenRouter keep arbitrary model support.
- [ ] Existing selected-provider-only provider panel behavior remains covered by tests.
- [ ] Render tests cover provider-specific model rendering and arbitrary-model preservation without hardcoded model-name assertions.
- [ ] Deterministic UI e2e sets the mock OpenAI-compatible model through the model input.

## Definition of Done

- Format, lint, typecheck, unit/render tests, and deterministic e2e pass.
- No raw API key is displayed, logged, stored in renderer beyond local input, or returned from the main process.
- No new provider/network dependency is introduced for fetching model lists.

## Technical Approach

Render a provider-aware model ID input in the Settings renderer component with helper copy explaining the AI SDK contract: direct providers use string model IDs and do not expose a runtime model catalog. The input continues to call `onProviderModelChange(providerId, value)`, so `App.tsx` and main-process settings persistence do not need semantic changes. If selection UI is introduced later, it must be driven by non-hardcoded data already available from settings/state, or by a separately designed provider integration.

## Decision (ADR-lite)

**Context**: A dropdown-only model selector would make common choices easier but would fail whenever providers release new model IDs or users route through OpenRouter/custom OpenAI-compatible endpoints. AI SDK docs show direct provider usage as `provider('model-id')`, and OpenAI-compatible type examples preserve free-form strings with `(string & {})`. The docs do not provide a runtime model-list API for direct provider packages such as `@ai-sdk/openai` or `@ai-sdk/anthropic`. AI Gateway does expose `gateway.getAvailableModels()`, but those discovered IDs are gateway/global-provider-specific and the app currently stores direct provider IDs and keys.

**Decision**: Keep model entry as an arbitrary string in a provider-aware Settings control. Do not hardcode direct-provider model catalogs, and do not add unsolicited AI Gateway discovery/integration in this task.

**Consequences**: The UI remains honest about provider model IDs while preserving the current arbitrary-string storage contract. Live model discovery can be designed later as a gateway-specific or provider-specific feature without migrating existing direct-provider settings.

## Out of Scope

- Live provider model discovery.
- Vercel AI Gateway integration or use of `gateway.getAvailableModels()` for the existing direct-provider settings flow.
- Validating model availability against provider APIs.
- Changing main-process settings schema or existing persisted model values.
- Adding provider-specific runtime controls beyond the existing thinking/reasoning behavior.

## Technical Notes

- `src/renderer/components/SettingsPage.tsx` owns the visible Model row.
- `src/renderer/App.tsx` owns `providerModelInputs` and already persists model strings through `setProviderConfigMutation`.
- `src/main/services/settings/service.ts` trims and stores arbitrary model strings per provider.
- `scripts/review-ui-e2e.ts` currently fills `openai-compatible-model-input`; this remains the deterministic path for mock provider setup.
