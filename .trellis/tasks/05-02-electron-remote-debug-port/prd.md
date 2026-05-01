# dev config: electron remote debug port

## Goal

Make the default development app launch Electron with Chromium remote debugging enabled on port 9222.

## Requirements

- Update the project default development start configuration so `pnpm dev` opens Electron's remote debugging port at `9222`.
- Keep the change scoped to development startup behavior.
- Do not alter production build, package, or make behavior.
- Do not edit or revert unrelated renderer changes, including `src/renderer/components/OnboardingIntro.tsx` or existing ink decoration work.

## Acceptance Criteria

- [x] `pnpm dev` passes `--remote-debugging-port=9222` to Electron through the existing Electron Forge dev path.
- [x] Production scripts are unchanged unless required by the repo's existing pattern.
- [x] `pnpm lint` passes.
- [x] `pnpm typecheck` passes.

## Technical Notes

- Existing `package.json` uses `"dev": "electron-forge start"`.
- The likely minimal safe change is to pass Electron args after the Electron Forge separator.
