# Research: Electron headless CI approaches

- **Query**: Research practical approaches for running Electron E2E tests in Linux headless environments/CI for this repository. Context: repo uses custom TypeScript scripts (`pnpm test:e2e` and `pnpm test:e2e:live`) that spawn `pnpm exec electron-forge start -- --remote-debugging-port=...` and drive the Electron renderer via Chrome DevTools Protocol. Current mocked UI script already passes `--disable-gpu`, `--window-size=1280,900`, reduced motion, and Linux `--no-sandbox`; live provider script only passes remote debugging port. No Playwright/Cypress and no xvfb wrapper are configured. Compare 2-4 approaches (e.g. `xvfb-run` npm script wrapper, GitHub Actions xvfb service/action, changing launch flags only, switching framework) and map them to this repo.
- **Scope**: mixed
- **Date**: 2026-05-05

## Findings

### Files Found

| File Path | Description |
|---|---|
| `package.json` | Defines `pnpm test:e2e` as `tsx scripts/review-ui-e2e.ts` and `pnpm test:e2e:live` as `tsx scripts/review-provider-e2e.ts`; dependencies include Electron/Forge/Vitest but no Playwright, Cypress, or Xvfb helper package. |
| `scripts/review-ui-e2e.ts` | Deterministic mocked UI E2E launcher and CDP driver. It spawns `pnpm exec electron-forge start -- ...` with remote debugging, `--disable-gpu`, fixed window size, reduced motion, and Linux `--no-sandbox`. |
| `scripts/review-provider-e2e.ts` | Live-provider CDP E2E launcher. It spawns `pnpm exec electron-forge start -- --remote-debugging-port=<port>` without the mocked UI script's extra Electron/Chromium flags. |
| `.github/workflows/ci.yml` | CI quality job installs Linux `libsecret-1-dev`, installs dependencies, and runs formatting/lint/typecheck/unit/harness checks; it does not run E2E commands and has no Xvfb setup. |
| `.github/workflows/app-build.yml` | App build workflow installs Linux native/maker dependencies and runs quality/build jobs; it does not run E2E commands and has no Xvfb setup. |
| `.trellis/spec/product/validation-and-testing.md` | Product testing spec documents `pnpm test:e2e`/`pnpm test:e2e:live` semantics and says E2E-only Electron/Chromium flags belong in the E2E launcher rather than `pnpm dev`. |
| `.trellis/spec/shared/pnpm-electron-setup.md` | Electron/pnpm CI setup spec covering Linux native dependencies (`libsecret-1-dev`, maker tools) and pnpm install/build-script constraints. |
| `.trellis/spec/backend/electron-window-shell.md` | Platform-sensitive Electron window shell constraints; relevant because Linux window behavior should be tested conservatively. |

### Code Patterns

- `package.json:18-19` exposes exactly two E2E commands:

  ```json
  "test:e2e": "tsx scripts/review-ui-e2e.ts",
  "test:e2e:live": "tsx scripts/review-provider-e2e.ts"
  ```

- `scripts/review-ui-e2e.ts:252-259` constructs a repo-owned Electron flag list and passes it after Forge's `--` delimiter:

  ```typescript
  const electronArgs = [
    `--remote-debugging-port=${cdpPort}`,
    '--disable-gpu',
    '--window-size=1280,900',
    '--force-prefers-reduced-motion=reduce',
    ...(process.platform === 'linux' ? ['--no-sandbox'] : []),
  ];
  const child = spawn('pnpm', ['exec', 'electron-forge', 'start', '--', ...electronArgs], {
  ```

  This means a shell-level display wrapper such as `xvfb-run pnpm test:e2e` can sit outside the TypeScript launcher without changing how CDP ports are allocated or how the renderer is driven.

- `scripts/review-provider-e2e.ts:183-204` uses the same child-process pattern and temp config/keychain isolation, but only passes the CDP flag:

  ```typescript
  const child = spawn('pnpm', ['exec', 'electron-forge', 'start', '--', `--remote-debugging-port=${cdpPort}`], {
  ```

  If the live command is run under the same Linux CI display strategy, the display environment is inherited through `childEnv` (`...process.env`) at `scripts/review-provider-e2e.ts:188-192`.

- Both E2E launchers use detached child processes on non-Windows (`scripts/review-ui-e2e.ts:262`, `scripts/review-provider-e2e.ts:202`) and capture bounded recent output for launch diagnostics (`scripts/review-ui-e2e.ts:266-291`, `scripts/review-provider-e2e.ts:206-234`).

- CI workflows currently install Linux native dependencies needed by `keytar`/Electron rebuild (`.github/workflows/ci.yml:28-32`, `.github/workflows/app-build.yml:88-93`) but do not install or start a virtual display before running tests.

- `.trellis/spec/product/validation-and-testing.md:211-218` defines the E2E contract: mocked UI E2E is deterministic, live provider E2E is separate and skips without env vars, and Electron/Chromium flags such as remote debugging, fixed window size, `--disable-gpu`, and Linux `--no-sandbox` must be set by the E2E launcher rather than by `pnpm dev`.

### Approach Comparison Mapped to This Repo

| Approach | What it changes | Fit with current scripts | Notes from external docs |
|---|---|---|---|
| `xvfb-run` shell wrapper around E2E command | CI/package script invokes `xvfb-run -a pnpm test:e2e` and optionally `xvfb-run -a pnpm test:e2e:live` when live env vars are present. Requires `xvfb` apt package on Linux runners. | High fit. The TypeScript launchers already inherit `process.env`, so `DISPLAY` from `xvfb-run` reaches `electron-forge start` and Electron. CDP port allocation remains inside the existing scripts. | Electron's headless CI docs state Chromium/Electron require a display driver, Xvfb provides an in-memory X11 display, and Chromium automatically looks for `$DISPLAY`; prepending a command with `xvfb-maybe` is given as the automation pattern. |
| GitHub Actions Xvfb action/service wrapper | Workflow step uses an action such as `coactions/setup-xvfb@v1` / `GabrielBB/xvfb-action@v1` with `run: pnpm test:e2e`, or a workflow-managed Xvfb display service. | Medium/high fit for GitHub Actions only. It keeps `package.json` unchanged and scopes the display setup to workflow YAML. Existing `.github/workflows/*.yml` already have Linux apt install steps where Xvfb dependencies or action step could be placed before an E2E step. | The action READMEs describe installing Xvfb, running the supplied test command with it, cleaning up the Xvfb process, and no-op behavior on non-Linux matrix runners. |
| Launch flags only, no virtual display | Add/synchronize Electron/Chromium flags such as `--disable-gpu`, `--window-size`, reduced motion, and `--no-sandbox` to all launchers, including live provider. | Partial fit. The mocked UI launcher already has these flags; the live launcher does not. This can normalize renderer behavior but does not by itself provide an X11/Wayland display. | Electron's headless CI docs explicitly say Electron/Chromium fails to launch if it cannot find a display driver; they describe Xvfb as the required virtual display. Flags can complement Xvfb but are not documented there as a replacement for `$DISPLAY`. |
| Switch to Playwright Electron (or Cypress-style framework) | Add a browser automation framework and rewrite or wrap E2E flow around its Electron launch/renderer APIs. | Larger change. Current tests already use CDP directly and no Playwright/Cypress dependencies exist in `package.json`. Playwright could launch Electron and expose `electronApp`/windows, but it would duplicate or replace repo-owned `CdpClient`/DOM driver logic. | Playwright's Electron API documents `electron.launch(options)`, including `args`, `executablePath`, `cwd`, and Electron support versions; it still launches a real Electron app, so Linux CI display requirements remain a separate concern unless the runner/tooling supplies one. |

### External References

- [Electron: Testing on Headless CI Systems](https://www.electronjs.org/docs/latest/tutorial/testing-on-headless-ci) — States Electron/Chromium requires a display driver, recommends Xvfb for headless Linux, explains Chromium uses `$DISPLAY`, and shows `xvfb-maybe electron-mocha ./test/*.js` as an example wrapper.
- [Electron: Command Line Switches](https://www.electronjs.org/docs/latest/api/command-line-switches) — Documents Electron command-line switches and shows `remote-debugging-port` as an Electron CLI/command-line switch, matching the repo's CDP launch shape.
- [coactions/setup-xvfb README](https://github.com/coactions/setup-xvfb) — GitHub Action that installs Xvfb, runs a provided command, cleans up, and no-ops on non-Linux runners.
- [GabrielBB/xvfb-action README](https://github.com/GabrielBB/xvfb-action) — Similar GitHub Actions wrapper for running a test command under Xvfb.
- [Playwright Electron API](https://playwright.dev/docs/api/class-electron) — Documents `electron.launch(options)`, `args`, `executablePath`, and related Electron automation capabilities for a framework-switch comparison.

### Related Specs

- `.trellis/spec/product/validation-and-testing.md` — Defines deterministic mocked UI E2E vs live-provider E2E, launcher-owned E2E flags, and privacy constraints for diagnostics.
- `.trellis/spec/shared/pnpm-electron-setup.md` — Defines Electron/pnpm CI install requirements, including `libsecret-1-dev` for Linux native rebuilds and reproducible `pnpm install --frozen-lockfile` behavior.
- `.trellis/spec/backend/electron-window-shell.md` — Defines Linux window-shell conservatism and platform-sensitive BrowserWindow behavior.

## Caveats / Not Found

- No committed Xvfb wrapper, `xvfb-run`, `xvfb-maybe`, or GitHub Actions Xvfb action usage was found in `package.json`, `.github/workflows`, `scripts/`, or `.trellis/spec` search results.
- No Playwright or Cypress dependency or configuration was found in `package.json`.
- External research used current public documentation pages/READMEs fetched on 2026-05-05; exact GitHub Action versions should be checked against the repository's dependency/security policy before adopting an action.
- The live-provider E2E depends on external provider credentials and is specified to skip cleanly when env vars are absent; mapping it into CI has a separate secrets/trigger policy dimension beyond display setup.
