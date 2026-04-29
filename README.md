# English Coach

English Coach is a local-first desktop app for practicing English through daily journaling. It helps a learner write freely first, then review the entry through a focused feedback loop: save the journal, review the current version, try one self-repair, compare with a reference rewrite, and keep one follow-up rewrite practice for later.

The current app is v0.1.0 and focuses on one workflow: today's English journal entry and its review.

## Current v0.1 features

- Today page with local app/database status.
- Daily journal editor with autosave.
- Local SQLite storage for journal entries, revisions, review runs, corrections, self-repair attempts, reference rewrites, and rewrite tasks.
- Review flow for the active journal revision:
  - provider disclosure before the first review,
  - validated review preview,
  - one focus pattern,
  - hint-first self-repair,
  - top corrections,
  - reference rewrite with "Notice the gap",
  - explicit "Save review and update learning history" action.
- Anchored correction highlighting against the reviewed journal revision.
- Stale review handling when the journal changes after review.
- One D+1 rewrite practice slot on Today, with submit and skip actions.
- Review contract harness for validating mock review output without depending on live model output.

Review execution is wired through the app-side review boundary and validation flow. The default live review agent adapter is not configured in this repository, so real model review requires providing a review agent adapter before the Review button can return useful feedback.

## Privacy and local data

English Coach is local-first by default:

- App data is stored in a local SQLite database at Electron's user data path as `english-coach.sqlite`.
- Raw model responses are disabled by default.
- Provider credentials are handled through the OS keychain boundary.
- The renderer does not receive direct filesystem, database, Electron main-process, or credential access.
- When review is configured, the app shows a disclosure before sending the current journal entry and selected learning context to the configured model provider.

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
- Journal text is the user's work; corrections are annotations and are not auto-applied.
- Invalid review output must not update learning history.
- Documentation in this repository should be written in English.
