# Inkline

Inkline is a local-first Electron desktop app for focused English writing practice. It helps learners choose a repeatable writing scenario, write independently, request focused AI feedback, try one self-repair, compare against a reference rewrite, and return later for a small D+1 rewrite practice.

Journal, CET-4 Writing, CET-6 Writing, and Free Writing are equal practice templates inside Inkline. None of those templates is the product identity.

## Status and Scope

| Area             | Current state                                                         |
| ---------------- | --------------------------------------------------------------------- |
| Product stage    | v0.1 desktop app in active development                                |
| App brand        | Inkline; the package name is `inkline`                                |
| Data model       | Local SQLite data under Electron's user data path                     |
| AI providers     | OpenAI-compatible endpoints and Anthropic Claude                      |
| Review flow      | Preview first; learning history updates only after explicit save      |
| Backlog boundary | Remaining v0.2 and backlog work is not documented as current behavior |

Not implemented as current behavior: pattern mastery status, pattern merge/de-dup flows, rewrite-check agents, D+3/D+7 reuse tasks, Drill Center, Anki sync, and import/export jobs.

## Quick Start

```bash
pnpm install
pnpm dev
```

Then open **Settings** in the app, choose a default AI provider/model, save the provider API key, and return to **Today** or **Practice** to write and request feedback.

## What Inkline Does Today

| Surface              | Implemented behavior                                                                                                                                                                           |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First launch         | Branded welcome intro for the writing loop, with replay from Settings                                                                                                                          |
| Today                | Default entry surface with a greeting, current practice prompt, and route into writing                                                                                                         |
| Practice             | Template picker, selected-template workbench, optional goal/topic, starter prompt generation, autosave, independent draft editing, review progress, and pending D+1 rewrite slot               |
| Feedback and Rewrite | Focused review preview, one focus pattern, hint-first self-repair, anchored highlights, reference rewrite, "Notice the gap", stale-review handling, and explicit save boundary                 |
| Notebook             | Saved upgrade opportunities from reviewed drafts, including source phrases and suggested alternatives                                                                                          |
| Progress             | Recurring error patterns from saved reviews, current draft/rewrite status, pattern counts, and recent examples                                                                                 |
| Settings             | Global provider/model configuration, OS-keychain API key status, raw response storage toggle, database/migration status, pi-mono status, reserved AnkiConnect status, and welcome intro replay |

## Writing and Review Flow

- Local SQLite initialization and migrations run at startup.
- Each template has one current draft.
- Starter prompt/topic generation is optional and supports regenerate, retry, and skip behavior.
- Starter generation sends template context and optional user goal/topic, not the user's essay text.
- Review generation uses the selected writing, template context, and bounded learning history after disclosure.
- Review output is Zod-validated before it can be saved.
- A valid saved review has exactly one focus pattern and at least one concrete "What you did well" item.
- Saving a review is the boundary that updates corrections, self-repair attempts, reference rewrites, rewrite tasks, error patterns, and notebook entries.
- Invalid review output does not update long-term learning history.

## AI and Privacy

Inkline is local-first, not local-inference-only.

| Topic            | Behavior                                                                                                                               |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Local data       | Writing attempts, revisions, review runs, corrections, rewrite tasks, error patterns, and notebook entries are stored in local SQLite. |
| Provider calls   | Starter prompt generation and review may send selected context to the configured provider after the relevant disclosure.               |
| Providers        | OpenAI-compatible providers use `@ai-sdk/openai`; Anthropic Claude uses `@ai-sdk/anthropic`.                                           |
| Runtime boundary | Provider calls run from the Electron main process through Vercel AI SDK adapters with Electron `net.fetch`.                            |
| API keys         | Keys are stored through the OS keychain and are never returned to the renderer.                                                        |
| Raw responses    | Raw model responses are disabled by default in production behavior and can be enabled locally in Settings for debugging.               |
| User writing     | Inkline annotates and explains. It does not auto-apply corrections to the draft.                                                       |

The renderer talks to the main process through a narrow preload IPC API. It does not import provider SDKs, database modules, keychain modules, filesystem APIs, or Electron main-process APIs directly.

## Configure AI Providers

1. Open **Settings**.
2. Choose the **Default provider**: OpenAI-compatible or Anthropic Claude.
3. For OpenAI-compatible providers, set the base URL and model. The base URL can point to OpenAI or another compatible endpoint such as `https://api.deepseek.com/v1`.
4. For Anthropic Claude, set the Claude model.
5. Paste the provider API key and save it. Keys are stored through the OS keychain.
6. Leave **Save raw model responses for debugging** off unless you explicitly want raw provider JSON saved locally.

If provider settings, API keys, or keychain access are unavailable, AI calls return recoverable configuration errors. Local writing and autosave remain available.

## Requirements

| Requirement    | Version                                                                    |
| -------------- | -------------------------------------------------------------------------- |
| Node.js        | `>=22.0.0`                                                                 |
| pnpm           | `>=9.0.0`; repository package manager is `pnpm@10.23.0`                    |
| Native tooling | Required for Electron native modules such as `better-sqlite3` and `keytar` |

The repository commits a hoisted pnpm layout in `.npmrc` for Electron/native-module compatibility. `postinstall` runs `electron-rebuild`.

## Scripts

| Command               | Purpose                                                              |
| --------------------- | -------------------------------------------------------------------- |
| `pnpm dev`            | Start the Electron app in development mode.                          |
| `pnpm format`         | Format the repository with Prettier.                                 |
| `pnpm format:check`   | Check repository formatting with Prettier.                           |
| `pnpm lint`           | Run ESLint.                                                          |
| `pnpm typecheck`      | Run TypeScript without emitting files.                               |
| `pnpm test`           | Run the Vitest suite.                                                |
| `pnpm review:harness` | Exercise the review contract harness.                                |
| `pnpm check`          | Run format, lint, typecheck, tests, and the review contract harness. |
| `pnpm build`          | Package the app through Electron Forge.                              |
| `pnpm package`        | Package the app through Electron Forge.                              |
| `pnpm make`           | Build distributable artifacts through Electron Forge makers.         |

## Stack

| Layer                | Tools                                                       |
| -------------------- | ----------------------------------------------------------- |
| Desktop shell        | Electron Forge, Vite                                        |
| UI                   | React 19, Tailwind CSS, daisyUI                             |
| Renderer async state | TanStack Query                                              |
| Main-process AI      | Vercel AI SDK, OpenAI-compatible adapter, Anthropic adapter |
| Storage              | SQLite, `better-sqlite3`, Drizzle ORM                       |
| Validation           | Zod, review contract harness                                |
| Language and quality | TypeScript, ESLint, Prettier, Vitest, pnpm                  |

## Project Structure

```text
src/
  main/
    db/                  SQLite client, schema, and migration runner
    ipc/                 Main-process IPC handlers
    services/
      ai/                AI SDK provider model creation and generation helpers
      credentials/       OS-keychain credential service
      learning-assets/   Error pattern and notebook persistence
      review/            Review orchestration types and flow support
      settings/          Provider, privacy, onboarding, and status settings
      writing/           Writing attempts, starter prompts, and rewrite practice
  preload/               contextBridge API exposed to the renderer
  renderer/
    assets/              App icon and ink landscape visual assets
    components/          Today, Practice, Feedback, Notebook, Progress, Settings UI pieces
    query/               TanStack Query clients, keys, queries, mutations, and cache updates
    App.tsx              App shell, navigation, and main surface composition
    styles.css           Renderer styling
  shared/
    constants/           IPC channel constants
    review-contract/     Schemas, anchoring, validation, and harness helpers
    types/               Shared IPC and domain snapshots
    writing/             Template/content utilities

drizzle/                 SQL migrations and migration metadata
resources/               Packaged app icon resources
scripts/                 Developer and contract harness scripts
test/                    Vitest tests
.trellis/                Project workflow, specs, task records, and AI development context
```

## Packaging

```bash
pnpm package
pnpm make
```

`pnpm package` creates a packaged app through Electron Forge. `pnpm make` creates platform maker artifacts configured in the Forge setup, including the Windows NSIS installer plus platform package makers.

Packaged builds include Drizzle migration resources, app resources, native module copies for `better-sqlite3`, `bindings`, `file-uri-to-path`, and `keytar`, plus app icon resources from `resources/icon.png` and `resources/icon.ico`.

## Development Notes

- Keep documentation and user-facing claims scoped to implemented behavior.
- Review output is preview-only until the user saves it.
- Saving review is the boundary that updates pattern counts, rewrite practice, and notebook history.
- Writing text remains the user's work; corrections are annotations and are not auto-applied.
- The writing-practice schema rebuild is a development-stage reset and is not a production-safe migration for old local journal data.
- Production builds do not save raw model responses by default.
- Documentation in this repository should be written in English.

## License

Inkline is licensed under `GPL-3.0-or-later`. See [LICENSE](LICENSE) for details.
