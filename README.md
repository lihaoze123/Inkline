# Writing Practice

Writing Practice is a local-first desktop app for practicing English through repeatable writing scenarios. It helps a learner choose a practice template, optionally generate a starter prompt/topic, write independently, review the current writing with focused AI feedback, try one self-repair, compare with a reference rewrite, and keep one follow-up D+1 rewrite practice for later.

The current app generalizes the original habit-writing flow into a Practice entry surface with Journal, CET-4 Writing, CET-6 Writing, and Free Writing as same-level templates.

## Current v0.1 features

- Practice page with local app/database status.
- Template picker for Journal, CET-4 Writing, CET-6 Writing, and Free Writing.
- Template-aware writing editor with autosave and one current draft per template.
- Optional AI starter prompt/topic generation, regenerate, retry, and skip behavior.
- Local SQLite storage for writing attempts, revisions, review runs, corrections, self-repair attempts, reference rewrites, and rewrite tasks.
- Review flow for the active writing revision:
  - provider disclosure before the first review,
  - template-aware review context,
  - validated review preview,
  - one focus pattern,
  - hint-first self-repair,
  - top corrections,
  - reference rewrite with "Notice the gap",
  - explicit "Save review and update learning history" action.
- Anchored correction highlighting against the reviewed writing revision.
- Stale review handling when the writing changes after review.
- One D+1 rewrite practice slot in Practice, with submit and skip actions.
- Review contract harness for validating mock review output without depending on live model output.
- Minimal OpenAI-compatible live review adapter configurable with base URL, model, and an OS-keychain API key.

Review execution is wired through the app-side review boundary and validation flow. The default live review path calls an OpenAI-compatible chat completions endpoint and validates the JSON response before showing preview results.

## Privacy and local data

Writing Practice is local-first by default:

- App data is stored in a local SQLite database at Electron's user data path as `english-coach.sqlite`.
- Raw model responses are disabled by default.
- Provider credentials are handled through the OS keychain boundary.
- The renderer does not receive direct filesystem, database, Electron main-process, or credential access.
- Before first starter prompt/topic generation, the app explains that AI will be called without sending user essay content.
- When review is configured, the app shows a disclosure before sending the current writing attempt, template context, and selected learning context to the configured model provider.

## Tech stack

- Electron Forge + Vite
- React 19
- TypeScript
- SQLite through `better-sqlite3`
- Drizzle ORM
- Zod validation
- pnpm

## Prerequisites

- Node.js `>=22.0.0`
- pnpm `>=9.0.0` (`packageManager` is `pnpm@10.23.0`)
- Native build tools required by Electron native modules such as `better-sqlite3` and `keytar`

This project uses a hoisted pnpm layout for Electron/native-module compatibility. The required settings are already committed in `.npmrc`.

## Install

```bash
pnpm install
```

`postinstall` runs `electron-rebuild` so native modules are rebuilt for Electron.

## Run the app in development

```bash
pnpm dev
```

This starts Electron Forge with the Vite-powered main, preload, and renderer builds.

## Configure live review

Live review uses an OpenAI-compatible `/chat/completions` API.

1. Open the app and find **Live review provider** in Settings.
2. Set the provider base URL, for example `https://api.openai.com/v1`.
3. Set the model, for example `gpt-4o-mini` or another model supported by your compatible provider.
4. Paste your provider API key and click **Save API key**. The key is stored in the OS keychain and is never shown back in the renderer.
5. Leave **Save raw model responses for debugging** off unless you explicitly want raw provider JSON saved in local review runs.
6. Choose a practice template, optionally generate a starter prompt/topic, write independently, and click **Review current writing**. The first review shows a disclosure before sending the current writing and bounded learning context to the configured provider.

If the key is missing or the OS keychain is unavailable, Review returns a recoverable configuration error and local writing/autosave behavior is unaffected.

## Quality checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm review:harness
```

Use these before committing documentation-adjacent code changes or review-flow changes.

## Package and make installers

Create a packaged app:

```bash
pnpm package
```

Create platform makers configured by Electron Forge:

```bash
pnpm make
```

The Forge config includes ZIP, DEB, RPM, and Squirrel makers. Packaged builds include the Drizzle migration resources and unpack native binaries from ASAR.

## Project structure

```text
src/
  main/       Electron main process, SQLite, migrations, IPC handlers, services
  preload/    contextBridge API exposed to the renderer
  renderer/   React app and styles
  shared/     shared IPC types, review contract schemas, validation utilities

drizzle/      SQL migrations and migration metadata
scripts/      developer and contract harness scripts
test/         Vitest tests
.trellis/     project workflow, specs, task records, and AI development context
```

## Useful scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the Electron app in development mode. |
| `pnpm lint` | Run ESLint. |
| `pnpm typecheck` | Run TypeScript without emitting files. |
| `pnpm test` | Run the Vitest suite. |
| `pnpm review:harness` | Exercise the review contract harness. |
| `pnpm build` | Package the app through Electron Forge. |
| `pnpm package` | Package the app through Electron Forge. |
| `pnpm make` | Build distributable artifacts through Electron Forge makers. |

## Development notes

- Keep documentation and user-facing claims scoped to implemented v0.1 behavior.
- Review output is preview-only until the user saves it.
- Writing text is the user's work; corrections are annotations and are not auto-applied.
- The writing-practice schema rebuild is a development-stage reset and is not a production-safe migration for old local journal data.
- Invalid review output must not update learning history.
- Documentation in this repository should be written in English.
