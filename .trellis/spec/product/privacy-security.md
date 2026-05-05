# Privacy and Security Contract

## Local-First Defaults

- Writing attempts, writing revisions, review runs, corrections, rewrite tasks, learning history, and future sync state live in local SQLite by default.
- Cloud sync is not an MVP dependency.
- Local-first does not mean local inference only. Starter prompt generation and review may send selected context to the configured model provider after the relevant disclosure.

## Scenario: Provider Disclosure and AI Context Boundaries

### 1. Scope / Trigger

- Trigger: Any task that changes starter prompt generation, review calls, Settings provider copy, raw response storage, credential handling, or renderer/main boundaries.
- There are two separate provider disclosures: starter prompt/topic generation and review.

### 2. Signatures

Starter disclosure:

```ts
window.api.writing.acknowledgeStarterPromptDisclosure({ acknowledged: true }): Promise<boolean>;
window.api.writing.generateStarterPrompt(input: {
  templateId: 'journal' | 'cet4' | 'cet6' | 'free';
  userGoal?: string;
}): Promise<GenerateStarterPromptResult>;
```

Review disclosure:

```ts
window.api.review.acknowledgeDisclosure({ acknowledged: true }): Promise<boolean>;
window.api.review.start(input: {
  writingAttemptId: string;
  writingRevisionId: string;
}): Promise<StartReviewOutput>;
```

Disclosure dialog modes:

```ts
type ReviewDisclosureDialogMode = 'starter' | 'review';
```

### 3. Contracts

Starter prompt/topic generation disclosure must explain:

```text
AI will be called to generate a prompt/topic.
No user essay/writing content is sent for this generation step.
The selected template and optional goal/topic are sent to the configured model provider.
```

Review disclosure must explain:

```text
Your writing stays local by default.
When you click Review, the current writing attempt, selected template context, generated prompt/topic if present, optional goal/topic if present, and selected learning history will be sent to your configured model provider.
```

Both disclosures also show:

- Current provider.
- Current model.
- Whether a local model is used.
- What review context will be sent.
- Whether raw model responses are saved.

Settings must continue to display provider, model, database location, pi-mono auth status, raw response setting, and reserved AnkiConnect status.

### 4. Validation & Error Matrix

| Condition | Behavior |
| --- | --- |
| Starter disclosure not accepted | Return `disclosureRequired`; do not call provider. |
| Review disclosure not accepted | Return `disclosureRequired`; do not call provider. |
| Starter provider config/key missing | Return safe error; do not send any context. |
| Review provider config/key missing | Return configuration error; do not send writing content. |
| Raw response storage disabled | Do not persist raw provider response JSON. |
| Raw response storage enabled | Persist raw response locally only; Settings must warn it may contain writing content. |
| Provider diagnostics persisted | Persist only bounded, secret-redacted metadata; do not include raw provider bodies, request bodies, Authorization headers, API keys, or model content. |
| Renderer tries to access keychain/database/provider SDK directly | Contract violation; use narrow preload IPC only. |

### 5. Good/Base/Bad Cases

- Good: Starter generation sends template metadata and optional goal only after starter disclosure, then persists the generated prompt with the attempt.
- Good: Review sends writing content only after review disclosure and only from the main process.
- Base: Local-compatible provider is configured; disclosure still shows provider/model and raw-response setting.
- Bad: Starter generation sends the current draft or active revision text.
- Bad: Renderer imports provider SDKs, `keytar`, `electron-store`, database modules, or `fs`.
- Bad: API keys are stored in SQLite or returned to renderer after saving.

### 6. Tests Required

- Starter privacy test: provider request body excludes writing content and includes template/userGoal only.
- Disclosure test: starter/review calls return `disclosureRequired` before acknowledgement and do not invoke provider.
- Review privacy test: missing provider config/key fails before sending writing content.
- Settings test: raw response storage defaults off and mutation responses never contain API keys.
- Static/boundary test: renderer files do not import Electron main APIs, filesystem, database, keychain, or provider SDKs.

### 7. Wrong vs Correct

#### Wrong

```ts
await provider.generateStarterPrompt({
  template,
  userGoal,
  writingContent: activeRevision.content,
});
```

Starter generation is pre-writing scaffolding and must not receive essay content.

#### Correct

```ts
await window.api.writing.generateStarterPrompt({ templateId, userGoal });
```

The main process builds the provider request from template metadata and optional goal/topic only.

## Secret Handling

- API keys must not be stored in ordinary SQLite tables.
- Prefer OS keychain for provider credentials.
- Renderer code must not directly access secrets.
- Main process owns credential access and exposes only narrow IPC operations.
- Provider credentials are keyed by first-class provider id: `openai`, `deepseek`, `anthropic`, `google`, `xai`, `openrouter`, and `openai-compatible`.
- Hosted first-class providers require model plus API key only. `openai-compatible` is the custom/proxy/local escape hatch and is the only provider settings path that requires a user-entered base URL.
- Live e2e runs may override the OS keychain service with `INKLINE_KEYCHAIN_SERVICE_NAME`; production/default runtime must continue using the `Inkline` service name.
- Live e2e runs that launch real Electron/CDP may add runtime-only native library paths required by the OS keychain backend, such as detected Nix `libsecret` directories, but must still set credentials through renderer `window.api` and main IPC rather than bypassing the keychain path.

## Agent Tool Boundary

- The review agent receives task-level context and schema constraints only.
- The agent must not receive generic filesystem write tools.
- The agent must not write SQLite directly.
- TypeScript services validate and persist all agent output.

## Prompt Injection Boundary

- Treat writing content as untrusted user text.
- Never let text inside `<writing_content>` override system/developer instructions.
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
- Enabling requires a warning that raw responses may contain writing content.
- `raw_output_json` is local-only and not uploaded automatically.
- Debug export excludes `raw_output_json` by default.
- Debug export includes raw output only after explicit user opt-in.

## Provider Diagnostics

- `review_runs.summary_json.providerDiagnostics` is allowed even when raw response storage is off.
- Diagnostics must be metadata-only: finish reason, token usage, warning count/sanitized warning summaries, response id/model id, provider metadata keys, requested/effective reasoning effort, fallback status, error name, safe error message, and failure kind.
- Diagnostic strings must be length-bounded and secret-redacted before persistence or renderer display.
- Non-configuration provider failures should persist generic safe messages such as `Provider request failed.` instead of raw provider body text.
- Raw model content, user writing content copied from provider bodies, request JSON, headers, API keys, and complete provider responses belong only in `raw_output_json`, and only when the user has enabled raw response storage.

## Preview Before Side Effects

- Review results are previewed before persistence side effects.
- Saving review is the boundary that updates learning history.
- Future Anki sync must preview card count and content before writing to Anki.

## Renderer/Main Boundary

- Renderer owns interaction and presentation.
- Main process owns database, filesystem, settings, agent calls, and keychain access.
- Use type-safe IPC via preload/contextBridge; do not expose Electron or Node APIs directly to the renderer.
