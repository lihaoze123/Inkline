# Replace Placeholder App Icon

## Goal

Replace the default Electron placeholder icon with a project-owned English Coach app icon.

## What I Already Know

- The app is an Electron Forge desktop app named `Inkline`.
- `forge.config.ts` currently has no `packagerConfig.icon`, so packaged builds fall back to the Electron default icon.
- `src/main/index.ts` creates the main `BrowserWindow` without an icon, so Linux/dev windows can also show the default icon.
- A generated icon image is available at `/home/chumeng/.codex/generated_images/019de474-33a5-78a1-8edf-f415f04c4c75/ig_0ce9d5f66db2b9140169f4db07ae70819b925959461caf5a21.png`.

## Requirements

- Add the generated app icon to a repo-owned resource location.
- Produce practical icon formats for Electron packaging and runtime use:
  - PNG source for Linux/dev/runtime use, with transparent outer background/corners so it does not render as a white square.
  - ICO for Windows packaging and Squirrel installer icon use.
  - ICNS for macOS packaging when available from local tooling.
- Configure Electron Forge so packaged apps use the repo-owned icon instead of the placeholder.
- Configure Linux package makers so the desktop entry uses the repo-owned icon.
- Configure the main `BrowserWindow` to use the PNG icon on Linux/dev where Electron needs a runtime window icon.
- Keep the generated source image under `$CODEX_HOME/generated_images` intact; copy into the project instead of moving it.

## Acceptance Criteria

- [ ] App icon assets exist in the repository under a clear resources path.
- [ ] `resources/icon.png` has an alpha channel and transparent outer background/corners.
- [ ] `forge.config.ts` points packager/makers to the new icon assets.
- [ ] `src/main/index.ts` uses the PNG icon for the BrowserWindow on non-macOS platforms.
- [ ] `pnpm lint` passes.
- [ ] `pnpm typecheck` passes.

## Out of Scope

- Redesigning in-app navigation icons.
- Changing product branding text or UI copy.
- Publishing installers or signing/notarizing packages.

## Technical Notes

- Image generation used the built-in `image_gen` tool with a logo-brand prompt for an English writing practice coach.
- The generated image is raster, not transparent, and is suitable as a rounded-square desktop app icon.
- Local tooling includes ImageMagick, which can create PNG and ICO derivatives. ICNS generation may depend on available ImageMagick support or platform tools.
