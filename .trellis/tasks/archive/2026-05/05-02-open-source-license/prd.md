# Add open source license

## Goal

Prepare Inkline for immediate open source publication by replacing the current `UNLICENSED` package metadata with a stronger copyleft open source license.

## Requirements

* License the repository as `GPL-3.0-or-later`.
* Add the standard GPLv3 license text at the repository root.
* Update package metadata so tooling reports the selected SPDX license expression.
* Add a README license section that states the selected license.
* Keep `private: true` in `package.json`; the project is a desktop app and should remain protected from accidental npm publication.

## Acceptance Criteria

* [x] Repository root contains a `LICENSE` file with GPLv3 text.
* [x] `package.json` has `"license": "GPL-3.0-or-later"`.
* [x] README includes a `License` section naming `GPL-3.0-or-later`.
* [x] Formatting remains valid.

## Definition of Done

* Documentation and package metadata are updated consistently.
* Existing app behavior is unchanged.
* A basic repository check confirms the edited files are present and formatted.

## Technical Approach

Apply the standard GNU GPLv3 license text and use the SPDX expression `GPL-3.0-or-later` in package metadata and documentation.

## Decision (ADR-lite)

**Context**: The project is about to be open sourced, and the owner rejected MIT as too permissive.

**Decision**: Use `GPL-3.0-or-later` to require distributed modified versions to remain under GPL terms while keeping the project under a standard open source license.

**Consequences**: The license is stronger than MIT and may reduce compatibility with proprietary reuse. It still allows use, study, modification, redistribution, and commercial activity under GPL terms.

## Out of Scope

* Changing application behavior.
* Publishing or pushing the repository.
* Adding a CLA, contributor covenant, or security policy.
* Changing `private: true`.

## Technical Notes

* `package.json` originally used `"license": "UNLICENSED"` and `"private": true`.
* README describes Inkline as a local-first Electron desktop app.
* Verification passed: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, and `pnpm test`.
* Spec update review: no `.trellis/spec/` update needed because this task did not introduce a reusable implementation convention, API contract, infrastructure integration, or debugging lesson.
