# Fix Nix Run Database Unavailable

## Goal

Fix the packaged Nix flake app so `nix run github:lihaoze123/Inkline` starts Inkline with a usable production database and packaged migrations instead of falling back to the development user data path.

## What I already know

* The user reported: `Inkline could not open Database unavailable: /home/chumeng/.config/Inkline/dev/Inkline.sqlite` when running `nix run github:lihaoze123/Inkline`.
* The Nix wrapper launches nixpkgs Electron against the packaged `resources/app.asar` rather than Electron Forge's downloaded executable.
* `src/main/env-setup.ts` appends `/dev` to Electron `userData` whenever `app.isPackaged` is false.
* `src/main/migrate.ts` uses `app.isPackaged` to choose packaged migrations from `process.resourcesPath/drizzle` vs development migrations from `process.cwd()/drizzle`.
* The reported `/dev/Inkline.sqlite` path means the Nix-wrapped app is being treated as a development runtime by `app.isPackaged`.
* `src/main/db/client.ts` stores the database at `path.join(app.getPath('userData'), 'Inkline.sqlite')` and creates the parent directory.

## Assumptions

* The root issue is runtime classification, not SQLite file creation itself: the app should not use `/dev` or `process.cwd()/drizzle` for the flake package.
* Electron may report `app.isPackaged === false` when nixpkgs Electron is used as the host executable with an app.asar argument.
* A small explicit runtime override from the Nix wrapper is acceptable because it only applies to the flake package output.

## Open Questions

* None for MVP.

## Requirements

* `nix run` from the flake package must treat Inkline as a packaged runtime.
* Packaged Nix runtime must use the normal Electron user data path, not the development `/dev` subdirectory.
* Packaged Nix runtime must load migrations from packaged resources, not from the current working directory.
* Existing Electron Forge packaged behavior must remain unchanged.
* Development behavior must remain unchanged: `pnpm dev` should still use the dev user data directory.

## Acceptance Criteria

* [ ] `nix build .#packages.x86_64-linux.default` succeeds.
* [ ] `nix run`/wrapper smoke test no longer reports `Database unavailable: .../dev/Inkline.sqlite`.
* [ ] Packaged runtime classification is covered by unit tests or equivalent regression checks.
* [ ] `pnpm check` passes.
* [ ] `nix flake check` passes.

## Definition of Done

* Bug fix is committed separately from the original Nix flake packaging commit.
* PR branch is updated after validation.
* Docs/spec updates are added only if the runtime override becomes a reusable packaging convention.

## Out of Scope

* Changing database schema or migrations.
* Migrating existing development database files from `/dev` to production paths.
* Reworking the Nix package architecture beyond the minimum runtime classification fix.

## Technical Notes

* Files inspected: `src/main/env-setup.ts`, `src/main/index.ts`, `src/main/db/client.ts`, `src/main/db/migrate.ts`, `src/renderer/query/foundation.ts`.
* Likely fix path: add an explicit packaged-runtime helper and have the Nix wrapper set an environment variable consumed before `userData` and migration path decisions.
