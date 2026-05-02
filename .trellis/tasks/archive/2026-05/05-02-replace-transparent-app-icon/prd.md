# replace transparent app icon

## Goal

Replace the existing app icon assets with the latest generated Inkline icon, removing only the outer chroma-key background while preserving the rounded-square app icon body.

## Requirements

- Use the latest generated green-background square icon source.
- Remove the flat green background and produce a transparent PNG.
- Preserve the icon as a rounded-square app icon, not a freeform mark.
- Replace the existing project icon assets:
  - `resources/icon.png`
  - `src/renderer/assets/app-icon.png`
  - `resources/icon.ico`

## Acceptance Criteria

- [x] `resources/icon.png` has an alpha channel and transparent outer corners.
- [x] `src/renderer/assets/app-icon.png` is a 256x256 version of the replacement icon.
- [x] `resources/icon.ico` is regenerated from the replacement icon.
- [x] The replacement keeps the rounded-square icon body intact.

## Out of Scope

- Changing app code or icon references.
- Reworking the icon design beyond background extraction and asset replacement.
