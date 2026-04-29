# Privacy and Security Contract

## Local-First Defaults

- Journal entries, review runs, corrections, rewrite tasks, learning history, and Anki sync state live in local SQLite by default.
- Cloud sync is not an MVP dependency.
- Local-first does not mean local inference only. Review may send selected content to the configured model provider.

## Provider Disclosure

Before first setup completion and before the first review, the UI must explain:

```text
Your journal stays local by default.
When you click Review, the current entry and selected learning history will be sent to your configured model provider.
```

Also show:

- Current provider.
- Current model.
- Whether a local model is used.
- What review context will be sent.
- Whether raw model responses are saved.

Settings must continue to display provider, model, database location, pi-mono auth status, raw response setting, and reserved AnkiConnect status.

## Secret Handling

- API keys must not be stored in ordinary SQLite tables.
- Prefer OS keychain for provider credentials.
- Renderer code must not directly access secrets.
- Main process owns credential access and exposes only narrow IPC operations.

## Agent Tool Boundary

- The review agent receives task-level context and schema constraints only.
- The agent must not receive generic filesystem write tools.
- The agent must not write SQLite directly.
- TypeScript services validate and persist all agent output.

## Prompt Injection Boundary

- Treat journal content as untrusted user text.
- Never let text inside `<journal_content>` override system/developer instructions.
- Require structured JSON output only.
- Validate all JSON with Zod before preview or persistence.

## Raw Model Responses

Default values:

```text
Production build: off by default.
Internal/dev build: may be on by default.
```

Rules:

- User can enable raw response storage in Settings.
- Enabling requires a warning that raw responses may contain journal content.
- `raw_output_json` is local-only and not uploaded automatically.
- Debug export excludes `raw_output_json` by default.
- Debug export includes raw output only after explicit user opt-in.

## Preview Before Side Effects

- Review results are previewed before persistence side effects.
- Saving review is the boundary that updates learning history.
- Future Anki sync must preview card count and content before writing to Anki.

## Renderer/Main Boundary

- Renderer owns interaction and presentation.
- Main process owns database, filesystem, settings, agent calls, and keychain access.
- Use type-safe IPC via preload/contextBridge; do not expose Electron or Node APIs directly to the renderer.
