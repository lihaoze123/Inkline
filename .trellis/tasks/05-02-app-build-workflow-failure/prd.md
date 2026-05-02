# Debug App Build Workflow Failure

## Goal

Fix the GitHub Actions App Build workflow failure from run `25245022408` so Windows, macOS, and Linux Electron Forge makers can produce distributable artifacts.

## What I Already Know

* The user reported a build failure and linked <https://github.com/lihaoze123/Inkline/actions/runs/25245022408>.
* The run was `workflow_dispatch` on `main` at commit `c8208a212ac420d5ee643e21e8f4dadb94734d4a`.
* The `quality` job passed.
* The `Build macOS` job passed.
* The `Build Windows` job failed during `pnpm make` while making the Squirrel distributable.
* Windows failure message: `Authors is required.`
* The `Build Linux` job failed during `pnpm make` while making the RPM distributable.
* Linux failure message: `License field must be present in package: (main package)`.
* The user clarified that build outputs should be platform-specific installer/package formats, not just simple packaged app directories.
* The user clarified that Linux should output DEB and AppImage only.
* The user clarified that release-triggered builds should attach generated packages to the GitHub Release, not only upload temporary Actions artifacts.

## Assumptions

* The fix should keep the existing workflow trigger/matrix shape while changing Linux maker output from RPM/DEB to DEB/AppImage.
* Because the package is private, `UNLICENSED` is the safest npm-compatible license value unless the project later chooses an OSS license.
* The author field can use the GitHub repository owner/user as package metadata for maker requirements.
* Release asset upload can use the GitHub CLI available on hosted runners with `GITHUB_TOKEN`.

## Open Questions

* None.

## Requirements

* Add package metadata required by platform makers.
* Remove the Linux RPM maker from this task's build output.
* Add Linux AppImage maker support.
* Ensure Linux CI installs AppImage maker system dependencies.
* Ensure Linux artifacts include DEB and AppImage outputs only for Linux.
* When triggered by a published GitHub Release, upload generated platform packages to that release as release assets.
* Keep Actions artifacts for workflow-dispatch/manual build downloads and debugging.
* Preserve the existing App Build workflow triggers and matrix behavior.
* Record the CI failure root cause and Linux AppImage maker constraints in Trellis context/specs so future packaging tasks check maker-required package metadata and system dependencies.

## Acceptance Criteria

* [ ] `package.json` includes an `author` value usable by Squirrel/NuGet.
* [ ] `package.json` includes package metadata needed by configured makers.
* [ ] `forge.config.ts` no longer configures the RPM maker.
* [ ] `forge.config.ts` configures DEB and AppImage for Linux.
* [ ] `.github/workflows/app-build.yml` installs Linux dependencies needed for DEB and AppImage creation.
* [ ] `.github/workflows/app-build.yml` grants the minimum release asset upload permission needed for release-triggered runs.
* [ ] Release-triggered build jobs upload generated files under `out/make/**` to the triggering GitHub Release.
* [ ] Manual workflow-dispatch builds still upload Actions artifacts.
* [ ] Local formatting/lint/typecheck checks pass.
* [ ] A packaging smoke or the closest available local validation is run and reported.
* [ ] Trellis packaging docs mention maker-required package metadata and AppImage system dependency requirements.

## Definition of Done

* Code/config changes committed.
* Checks run and reported.
* Task archived after the fix is pushed.

## Out of Scope

* Changing app distribution license policy beyond the private-package `UNLICENSED` metadata needed to build.
* Signing, notarization, creating releases, or auto-update setup.

## Technical Notes

* `package.json` currently lacks `author` and `license`.
* Squirrel/NuGet reads package metadata and fails without authors.
* RPM packaging requires a license field.
* Electron Forge official makers cover DEB and RPM; AppImage support is handled by a third-party Forge maker.
* `@reforged/maker-appimage` requires `mksquashfs`, available from Ubuntu's `squashfs-tools` package.
* `gh release upload` needs `contents: write` and the target release tag from `github.event.release.tag_name`.
