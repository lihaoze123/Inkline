# Implementation Notes

## Recommended Shape

Create a small readiness derivation helper from existing renderer data:

- Input: `StartupStatus` and `SettingsSnapshot`.
- Output: an overall status plus rows for database, migrations, selected provider, model, custom base URL, keychain/API key, and validation boundary.
- Status values should be simple, such as `ready`, `needs_setup`, `unavailable`, and `info`.
- Each row should have a label, value, status, and optional action text.

Suggested rendering:

- Add a visible `Diagnostics` or `Readiness` section in `SettingsPage`.
- Keep the current provider/settings controls unchanged.
- Reuse existing `StatusRow` style or a nearby compact row component.
- Keep the old `Connection status` details only if it still adds lower-level detail.

Suggested checks:

- Database ready: `startup.databaseReady === true`.
- Migrations applied: `startup.migrationsApplied === true`.
- Selected provider: `settings.providerId` or fallback to `openai-compatible`.
- Model configured: selected provider settings have a non-empty model, falling back to legacy `settings.model`.
- Custom base URL: required only for `openai-compatible`; non-empty is enough for the foundation.
- Keychain/API key: selected provider credential status is `configured`; `unavailable` should be a distinct failure from `not-configured`.
- Model-output validation: state that structured validation is active, not that the selected provider has been tested.

## Constraints

- No database schema or migration.
- No new live provider call.
- No new provider/runtime setting.
- No raw response, API key, Authorization header, or unsanitized provider error display.
- No changes to review/rewrite-check behavior, rewrite tasks, pattern evidence, learning events, or starter prompt generation.
- Prefer pure derivation and render tests over a new IPC channel.

## Test Notes

Focused test targets:

- Pure readiness helper:
  - all-ready state returns an overall ready status.
  - missing model returns a setup-needed row.
  - missing `openai-compatible` base URL returns a setup-needed row.
  - missing selected provider key returns a setup-needed row.
  - unavailable keychain returns an unavailable row.
  - database or migration failure returns unavailable rows.

- Renderer:
  - Settings renders the visible diagnostics section.
  - Settings displays next actions for incomplete selected provider state.
  - Settings does not render API key input values, raw provider bodies, or writing content in diagnostics.

## Risk Notes

- A readiness panel can overpromise if it looks like a successful provider smoke test. Copy should say configuration is ready, not that the provider was called.
- Adding a new IPC channel would increase surface area without clear need because Settings already has the required safe snapshot data.
- Showing too many low-level rows can feel like a developer console. Keep the MVP to beta setup blockers and move lower-level facts into secondary details.
