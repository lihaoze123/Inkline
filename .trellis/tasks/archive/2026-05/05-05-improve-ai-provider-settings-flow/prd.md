# Improve AI provider settings flow

## Goal

Make AI provider settings follow the user's mental model: first choose the active provider, then show only the settings relevant to that provider. The current page renders every provider's configuration at once, which makes the flow noisy and confusing.

## Requirements

* Merge the provider selector and provider configuration into one primary AI provider section.
* Selecting a provider immediately updates the global default provider.
* The settings page shows only the selected/default provider's configuration.
* Hidden providers' saved model/base URL/API key state remains intact and is not deleted by switching providers.
* Providers without an API key can still be selected; the current provider section must show its key status clearly so first-time setup is possible.
* The status summary shows only the current provider's API key status instead of listing every provider.
* Review behavior settings remain a separate global section and do not move into provider-specific configuration.
* Use one Save button for the visible provider section.
* The unified Save button saves the selected provider's model/base URL settings and, when the API key input is non-empty, saves that API key.
* Leaving the API key input blank on Save preserves any existing saved key.
* Deleting an API key remains an explicit Delete key action.
* After saving a non-empty API key, clear the sensitive input and rely on key status text to show that the key is configured.

## Acceptance Criteria

* [ ] Choosing a provider from the settings page immediately persists it as the default provider.
* [ ] Only the selected/default provider's model/API key fields are rendered.
* [ ] The OpenAI-compatible provider still shows Base URL; hosted providers do not.
* [ ] Switching away from a provider and back preserves its existing input/model state and stored credentials.
* [ ] Saving with a blank API key updates model/base URL settings without deleting the existing key.
* [ ] Saving with a non-empty API key saves both provider settings and the key, then clears the key input.
* [ ] Delete key still works only when the selected provider has a configured key.
* [ ] Status summary reports default provider, default model, and current provider key status only.
* [ ] Review behavior toggles remain visible and behave as before.
* [ ] Relevant tests/checks pass.

## Definition of Done

* Tests added or updated where behavior is covered today.
* Lint/typecheck/test commands relevant to the changed files pass.
* The settings UI is manually verified in the browser/Electron UI if feasible.
* No credentials are exposed back into renderer state after saving.

## Technical Approach

Update `SettingsPage` so it derives the selected provider from `aiModelSettings.defaultProviderId`/legacy fallback and renders a single `ProviderSettingsSection` for that provider instead of mapping over all providers. Keep the existing per-provider input maps in `App` so hidden provider edits and saved defaults remain provider-scoped. Replace the separate settings/API-key buttons in the visible provider section with a unified save callback that saves provider config first and saves the API key only when the visible key input is non-empty.

## Decision (ADR-lite)

**Context**: Rendering all AI providers at once makes first-time setup noisy and does not match the desired flow of choosing one provider before configuring it.

**Decision**: Use a selected-provider-only settings section. Provider choice remains the global default provider and takes effect immediately. Hidden provider configuration is retained. API key deletion remains explicit.

**Consequences**: The page becomes simpler and safer for normal setup. Managing multiple providers is still possible by switching the selector, but users no longer see all provider panels or all provider key statuses at once.

## Out of Scope

* Feature-specific model overrides UI.
* Per-provider Review behavior controls.
* Clearing hidden providers' saved settings or credentials on provider switch.
* Reworking runtime provider selection outside the settings UI flow.
* Adding new provider types.

## Technical Notes

* Main UI file: `src/renderer/components/SettingsPage.tsx`.
* Renderer state/handlers: `src/renderer/App.tsx`.
* Settings UI props contract: `src/renderer/components/types.ts`.
* Selected provider persistence already exists through `settings.setDefaultProvider` and `aiModelSettings.defaultProviderId`.
* Provider settings are stored per provider; OpenAI-compatible is the only provider with Base URL.
* API keys are stored through OS keychain and are never returned to the renderer.
* Relevant specs are referenced by `implement.jsonl` and `check.jsonl`.
