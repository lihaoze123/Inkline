# brainstorm: write README and CHANGELOG

## Goal

Create project documentation for the current english-coach repository: a README for users/developers and a CHANGELOG that records released or notable changes.

## What I already know

* The user asked to write README documentation and "CHANGLOG", interpreted as CHANGELOG.
* The repository is named `english-coach`.
* Current branch is `main` and the working tree was clean at session start.
* No root README or root CHANGELOG currently exists in tracked files.
* `package.json` identifies the app as `english-coach` v0.1.0: "Local-first English journal coach desktop app."
* Runtime stack from `package.json`: Electron Forge + Vite, React 19, TypeScript, SQLite via better-sqlite3 + Drizzle, pnpm.
* Supported scripts: `dev`, `lint`, `typecheck`, `test`, `review:harness`, `build`/`package`, `make`, `postinstall`.
* Current UI implements Today page, journal editor, autosave, review preview/save flow, provider disclosure, D+1 rewrite practice, anchored highlights, stale review handling, and raw response storage status.
* Local database path is `app.getPath('userData')/english-coach.sqlite`.
* Settings currently default provider/model to `Not configured`; raw model response storage defaults off.
* Review implementation currently calls `callPiMonoReviewAgent` by default while tests can inject a review agent.
* Product specs define v0.1 as local-first daily journal review, self-repair, reference rewrite, and one rewrite practice; v0.2/backlog items should not be documented as current capabilities.

## Assumptions (temporary)

* README should document the currently implemented product and developer workflow, not aspirational features.
* CHANGELOG should follow a Keep-a-Changelog-style structure unless the repo already has a convention.
* CHANGELOG should start with `0.1.0` because package version is `0.1.0`.

## Open Questions

* None.

## Requirements (evolving)

* Add a root `README.md`.
* Add a root `CHANGELOG.md`.
* README audience: both end users and developers.
* README should start with product overview/current usage, then cover developer setup, scripts, quality checks, packaging, and project structure.
* README should cover current v0.1 implemented features and local-first/privacy notes.
* README should not include a v0.2/backlog roadmap.
* README should not expand current runtime limitations beyond what is necessary to run/develop the app.
* CHANGELOG should record current v0.1.0 features based on implemented functionality and recent commit history.

## Acceptance Criteria

* [ ] README includes accurate project overview and setup/run instructions derived from the repo.
* [ ] README avoids claiming unsupported or unverified functionality.
* [ ] README covers current v0.1 functionality without adding a roadmap.
* [ ] CHANGELOG has a clear `0.1.0` version entry dated from the current task date.
* [ ] Documentation files are checked for spelling and command accuracy.

## Technical Approach

Create two root documentation files:

* `README.md`: user-facing overview first, then developer prerequisites, install/run/test/package commands, project structure, and privacy/local-data notes.
* `CHANGELOG.md`: concise Keep-a-Changelog-style entry for `0.1.0` based on current implemented features and recent feature commits.

## Decision (ADR-lite)

**Context**: The repo currently has no root README or CHANGELOG, and the user wants documentation for the project.
**Decision**: Write documentation for both users and developers, scoped only to current v0.1 implemented behavior.
**Consequences**: The docs stay accurate and low-maintenance, but they intentionally omit v0.2/backlog roadmap content.

## Definition of Done (team quality bar)

* Tests added/updated (unit/integration where appropriate)
* Lint / typecheck / CI green
* Docs/notes updated if behavior changes
* Rollout/rollback considered if risky

## Out of Scope (explicit)

* Changing product behavior or implementation code.

## Technical Notes

* Task directory: `.trellis/tasks/04-29-write-readme-changelog/`
