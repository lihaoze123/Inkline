# Research: Linux AppImage Maker for Electron Forge

## Question

How should this Electron Forge + pnpm project produce Linux DEB and AppImage artifacts only?

## Findings

* Electron Forge makers generate platform-specific distributables rather than plain package directories.
* Electron Forge's official DEB maker builds `.deb` packages and requires Linux/macOS with `fakeroot` and `dpkg`.
* Electron Forge's official RPM maker builds `.rpm` packages and requires RPM tooling, but the user clarified Linux should be DEB and AppImage only, so RPM should be removed from this task's target output.
* Electron Forge does not list an official AppImage maker in the current maker docs.
* `@reforged/maker-appimage` is a third-party Forge-compatible AppImage maker.
* `@reforged/maker-appimage` is a TypeScript Forge maker and requires the external `mksquashfs` binary.
* On Ubuntu GitHub runners, `mksquashfs` is provided by the `squashfs-tools` package.

## Recommended Implementation

* Remove `@electron-forge/maker-rpm` from `package.json` and `forge.config.ts`.
* Add `@reforged/maker-appimage` to dependencies.
* Import `MakerAppImage` in `forge.config.ts`.
* Configure Linux makers as:
  * `MakerDeb` with the existing icon.
  * `MakerAppImage` with the existing PNG icon and a suitable desktop category.
* Update `.github/workflows/app-build.yml` Linux package install command to include:
  * `libsecret-1-dev` for `keytar`.
  * `fakeroot` and `dpkg` for DEB.
  * `squashfs-tools` for AppImage.
* Drop `rpm` from the Linux package install command.

## Sources

* Electron Forge Makers docs: <https://www.electronforge.io/config/makers>
* Electron Forge DEB maker docs: <https://www.electronforge.io/config/makers/deb>
* ReForged AppImage maker docs: <https://spacingbat3.github.io/ReForged/modules/_reforged_maker-appimage.html>
* ReForged AppImage maker class docs: <https://spacingbat3.github.io/ReForged/classes/_reforged_maker-appimage.MakerAppImage.html>
