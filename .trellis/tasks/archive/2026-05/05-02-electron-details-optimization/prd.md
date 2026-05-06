# brainstorm: optimize Electron details

## Goal

Improve Inkline's native desktop shell polish by hiding unnecessary OS chrome and blending the window frame/title area into the existing app surface, without changing the core writing/review product workflow.

## What I already know

* User asked to further optimize Electron details.
* The app uses Electron Forge 7 with Vite for main, preload, and renderer builds.
* `src/main/index.ts` creates a single `BrowserWindow` with `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`.
* The preload API in `src/preload/index.ts` exposes a typed, narrow `window.api` wrapper over IPC channels.
* IPC handlers in `src/main/ipc/handlers.ts` validate inputs and outputs through shared Zod schemas.
* The app packages SQLite migrations and `resources`, and currently copies native module packages manually after packaging.
* GitHub Actions already run quality checks and build Windows, macOS, and Linux distributables.
* User clarified the desired scope: system-specific shell details such as hiding the menu bar / top title area and using a border/frame blending mode.

## Assumptions (temporary)

* "Electron details" for this task means desktop shell appearance: menu bar visibility, title bar visibility, draggable safe area, and native frame/background integration.
* This task should avoid product-facing feature changes unless they are needed to expose or verify Electron behavior.
* A conservative native-titlebar integration is preferred over a fully frameless custom titlebar unless implementation proves Electron's native overlay is insufficient.

## Open Questions

* None.

## Requirements (evolving)

* Preserve the current local-first desktop app architecture.
* Keep renderer access constrained to the existing preload API pattern.
* Keep cross-platform packaging support for Windows, macOS, and Linux.
* Hide the native menu bar on Windows/Linux so it does not consume visible top chrome during normal app use.
* Use platform-specific title bar options so the top title/tab area is visually hidden or blended into the app background while preserving native window controls.
* Keep macOS traffic-light controls available and positioned so they do not collide with app navigation.
* Add/adjust renderer chrome spacing and draggable regions so users can drag the window from the fused top area without making interactive controls draggable.
* Match the window background/titlebar overlay color to the app's existing paper surface to avoid a visible frame mismatch.
* Avoid automatic updates, code signing, notarization, or release artifact changes in this task.

## Acceptance Criteria (evolving)

* [ ] Electron-specific changes are scoped and documented in this PRD before implementation.
* [ ] Windows/Linux native menu bar is hidden or auto-hidden in normal use.
* [ ] macOS uses hidden/inset titlebar behavior with safe traffic-light spacing.
* [ ] Windows/Linux titlebar overlay or frame background blends with the renderer surface where Electron supports it.
* [ ] The top fused area remains draggable while buttons, nav items, inputs, and scrollable content remain interactive.
* [ ] The app still loads in dev and packaged-style builds with the existing preload isolation settings.
* [ ] Any code changes preserve lint, typecheck, and existing test behavior.
* [ ] Packaging/build implications are considered for all affected platforms.

## Definition of Done (team quality bar)

* Tests added/updated where appropriate.
* Lint, typecheck, and relevant project checks pass.
* Docs/notes updated if behavior changes.
* Rollout/rollback considered if risky.

## Out of Scope (explicit)

* Core AI review or writing-practice behavior changes.
* Large UI redesign unrelated to Electron shell behavior.
* Automatic updates, code signing, notarization, or release workflow changes.
* Fully custom window controls unless required by Electron platform constraints.

## Technical Notes

* `package.json` scripts include `dev`, `package`, `make`, `check`, and Electron rebuild postinstall.
* `forge.config.ts` configures icons, extra resources, native module copying, and makers for Squirrel, DMG, deb, and AppImage.
* `src/main/env-setup.ts` adjusts `userData` for dev and infers Linux timezone.
* `src/main/db/client.ts` creates the SQLite database under `app.getPath('userData')`.
* `src/main/db/migrate.ts` uses packaged `process.resourcesPath/drizzle` migrations when packaged.
* No existing main-process handling was found for `setWindowOpenHandler`, `will-navigate`, single-instance lock, graceful close cleanup, or renderer content security policy.
* Electron 39 types support `autoHideMenuBar`, `titleBarStyle`, `titleBarOverlay`, `trafficLightPosition`, macOS `vibrancy`, and Windows `backgroundMaterial`.
* The current renderer root is `<main className="app-chrome ...">` with a fixed sidebar and scrollable content; this is the natural place to add window drag/safe-area styling.

## Technical Approach

Use Electron's native titlebar integration rather than removing the native frame completely:

* Configure `BrowserWindow` with a shared app background color and platform-specific titlebar options.
* On macOS, use a hidden/inset titlebar style with traffic-light spacing aligned to the sidebar.
* On Windows/Linux, hide or auto-hide the menu bar and use a titlebar overlay where Electron supports it.
* In renderer CSS, add a slim draggable top region and top padding variables so hidden native chrome does not collide with content.
* Mark normal app controls as non-draggable so navigation, buttons, inputs, and scrolling remain usable.

## Decision (ADR-lite)

**Context**: The app currently uses the default OS title/menu chrome, which can leave visible native bars that do not match the app's quiet paper UI.

**Decision**: Implement a conservative platform-specific native shell blend: hidden/inset titlebar, hidden menu bar on Windows/Linux, content-colored frame/overlay, and CSS drag-region support.

**Consequences**: This improves native polish with low risk, but it does not yet implement a fully custom titlebar, custom window buttons, auto-updates, signing, or deeper release hardening.
