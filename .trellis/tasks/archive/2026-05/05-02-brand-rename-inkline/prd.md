# Brand rename to Inkline

## Goal

Adopt `Inkline` as the visible product name for the desktop English writing practice app, replacing the current placeholder-style `English Coach`/`Writing Practice` labels in user-facing surfaces.

## What I already know

* The user selected option 1: `Inkline`, with Chinese companion name `墨线`.
* The app currently exposes `English Coach` in the Electron window title, HTML title, main navigation, and onboarding intro.
* The README still describes the product as `Writing Practice`.
* Persistent internal identifiers include `Inkline.sqlite` and the keytar service name `Inkline`.

## Assumptions

* This task changes visible branding and docs only.
* Internal package name, database filename, credential service name, and existing app data paths stay unchanged to avoid unnecessary migration or credential loss.
* The companion Chinese name `墨线` is available for copy/design direction, but the primary in-app product name is `Inkline`.

## Requirements

* Replace visible `English Coach` labels with `Inkline` in the app shell, Electron window title, document title, and onboarding intro.
* Update onboarding entry copy to keep the quiet, focused writing practice tone under the new brand.
* Update README heading and first references from `Writing Practice` to `Inkline`.
* Do not rename internal storage identifiers or runtime service names in this task.

## Acceptance Criteria

* [x] Launch/window/document/user-visible app branding reads `Inkline` instead of `English Coach`.
* [x] README introduces the project as `Inkline`.
* [x] Existing persisted data paths and credential service names are not changed.
* [x] Lint and type-check pass.

## Definition of Done

* Lint / typecheck green for the touched frontend/main files.
* Scope remains limited to product naming and copy.
* No database migration or credential migration is introduced.

## Out of Scope

* Renaming npm package name, app bundle identifiers, database filename, keytar service, or repository path.
* Redesigning the icon or onboarding visuals.
* Adding bilingual UI labels beyond the selected primary brand.

## Technical Notes

* Likely touched files: `src/renderer/index.html`, `src/main/index.ts`, `src/renderer/App.tsx`, `src/renderer/components/OnboardingIntro.tsx`, `README.md`.
* Leave `src/main/db/client.ts` and `src/main/services/credentials/service.ts` unchanged unless a future migration task explicitly covers data/credential migration.
