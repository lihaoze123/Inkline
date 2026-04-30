# Research: Testing stack for React + Vite + Electron renderer with Vitest

- **Query**: Research testing stack best practices for React + Vite + Electron renderer projects using Vitest. Compare component tests with React Testing Library/jsdom, browser component tests, and Playwright/Electron E2E smoke testing. Map recommendations to this repo's stage and constraints.
- **Scope**: mixed
- **Date**: 2026-04-30

## Findings

### Files Found

| File Path | Description |
|---|---|
| `package.json` | Current scripts and dependencies: `pnpm test` runs `vitest run`; React 19, Vite 7, Electron 39, Electron Forge Vite plugin, and Vitest are installed. React Testing Library, jsdom/happy-dom, Playwright, and `@vitest/browser` are not installed. |
| `vite.renderer.config.ts` | Renderer Vite config rooted at `src/renderer`, with React and Tailwind plugins and aliases for `@shared` and `@renderer`. |
| `vite.main.config.ts` | Main-process Vite config externalizes `electron`, `better-sqlite3`, and `keytar`. |
| `vite.preload.config.ts` | Preload Vite config externalizes `electron`. |
| `src/renderer/App.tsx` | Main renderer app component; uses React state, TanStack Query hooks, and `window.api` IPC bridge indirectly through query hooks. |
| `src/renderer/vite-env.d.ts` | Declares `window.api: Api`, making renderer component tests need either a typed mock or injection seam for IPC-facing code. |
| `src/renderer/components/*.tsx` | Current renderer component surface: editor, learning panel, template picker, disclosure dialogs, settings drawer, header, autosave status. |
| `src/renderer/query/*.ts` | Renderer data/query layer; existing tests cover cache keys/defaults but not component rendering. |
| `test/*.test.ts` | Existing Vitest test suite is TypeScript unit/integration/contract oriented; no `.tsx` component tests or E2E tests were found outside `node_modules`. |
| `test/renderer-query.test.ts` | Existing renderer-adjacent Vitest tests validate TanStack Query keys, cache updates, retry settings, and focus refetch settings in node-like tests. |
| `.trellis/spec/product/validation-and-testing.md` | Project testing contract: requires `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm review:harness`, and Electron/manual UI validation for frontend/product-flow changes. |
| `.trellis/spec/frontend/ipc-electron.md` | IPC contract includes a required static or boundary test asserting renderer files do not import `electron`, `node:*`, `fs`, `path`, `better-sqlite3`, or `keytar`; also requires dev smoke via `pnpm run dev`. |
| `.trellis/spec/frontend/electron-browser-api-restrictions.md` | States Electron renderer features must be tested in the actual Electron app, not only in a browser dev server, because browser-only checks miss Electron-specific issues. |
| `.trellis/spec/frontend/components.md` | Component conventions emphasize semantic HTML and accessible keyboard behavior, which aligns with user-centric component assertions. |

### Current Repository Testing State

- `package.json:8-17` defines `dev`, `lint`, `typecheck`, `test`, `review:harness`, `build/package/make`, and `postinstall` scripts.
- `package.json:19-58` includes runtime Electron/React/Vite/TanStack/AI/database dependencies and `vitest`, but no DOM/component/E2E test packages:
  - installed package check showed `vitest/package.json 4.1.5` in `node_modules`;
  - `@testing-library/react`, `jsdom`, `happy-dom`, `@vitest/browser`, `playwright`, and `@playwright/test` were not installed.
- Existing test files found under `test/`:
  - `review-contract.test.ts`, `review-persistence-decision.test.ts`, `database.test.ts`, `writing-content.test.ts`, `writing-revisions.test.ts`, `review-save.test.ts`, `rewrite-practice-service.test.ts`, `rewrite-practice.test.ts`, `ai-generation-service.test.ts`, `review-integration.test.ts`, `writing-starter-prompt.test.ts`, `settings.test.ts`, `review-start-observability.test.ts`, `renderer-query.test.ts`.
- Existing test shape is service/contract/integration heavy. `test/renderer-query.test.ts:10-64` is renderer-adjacent but exercises pure query/cache functions rather than mounted React components.
- No `vitest.config.ts`, `playwright.config.*`, `.tsx` tests, `.e2e.*` tests, or Testing Library setup files were found in the repo root/source/test paths inspected.

### Option Comparison

#### 1. Vitest + React Testing Library + jsdom/happy-dom component tests

**What it covers**

- Fast component rendering tests in a simulated DOM, using Vite/Vitest transform pipeline.
- User-centric assertions for accessible text, roles, labels, form state, empty/loading/error states, and callback behavior.
- Good fit for components that can be driven through props or mocked `window.api`/query hooks.

**Best-practice role**

- Use as the default automated component-test layer for renderer UI logic that does not require Chromium/Electron-native behavior.
- Prefer React Testing Library-style tests that query visible UI semantics instead of component internals, matching `.trellis/spec/frontend/components.md` semantic HTML guidance.
- Keep IPC and native modules behind mocks/fakes. Renderer code declares `window.api` in `src/renderer/vite-env.d.ts:3-8`; mounted tests need a setup file that provides a typed `window.api` fake for components/hooks that reach IPC.
- Use `jsdom` when compatibility with broader DOM APIs matters; `happy-dom` can be faster but may diverge on web platform details. Either is still not a real browser or Electron renderer.

**Gaps / caveats**

- Does not prove Electron context isolation/preload integration works.
- Does not catch Chromium layout/CSS/rendering differences, native dialog limitations, or Electron-specific browser API behavior.
- Needs added dependencies and Vitest environment configuration because this repo currently has only Vitest installed.

**Mapped to this repo**

- Useful next automated coverage layer for `src/renderer/components/*.tsx` and state branches in `src/renderer/App.tsx` once dependencies/config are added.
- Strong first candidates: `PracticeTemplatePicker`, `AutosaveStatus`, disclosure dialogs, `SettingsDrawer` field/status rendering, and loading/error states in `App`.
- Keep existing service/contract tests as-is; add component tests for user-visible renderer states that are currently only manually covered by `.trellis/spec/product/validation-and-testing.md`.

#### 2. Vitest Browser Mode / browser component tests

**What it covers**

- Component tests executed in a real browser context instead of a DOM emulator.
- Better coverage for browser APIs, event behavior, CSS/layout-sensitive interactions, and behavior that jsdom/happy-dom cannot faithfully model.
- Vitest Browser Mode documentation exists and positions it as a browser-backed test mode; it requires browser provider packages/configuration beyond plain Vitest.

**Best-practice role**

- Use selectively for components whose correctness depends on real browser behavior: focus management, keyboard interaction, layout/scroll behavior, CSS-driven visibility, selection/input edge cases, and dialogs/modals.
- Treat as a supplement to jsdom component tests, not a replacement for all unit/component tests, because it is heavier and adds browser-provider setup.

**Gaps / caveats**

- Still not the packaged Electron app and not the Electron preload/main process boundary.
- Browser mode can reveal browser-level issues, but `.trellis/spec/frontend/electron-browser-api-restrictions.md:257-266` explicitly says browser testing may miss Electron-specific issues and development should test in Electron.
- Adds complexity: browser provider installation/configuration and likely CI browser dependencies.

**Mapped to this repo**

- Not the first layer to add while the repo has no component-test infrastructure at all.
- Best reserved for later targeted coverage of known browser-realism risks: editor/input behavior, modal focus/keyboard behavior, scroll/overflow behavior in `LearningPanel`/editor layouts, or CSS interactions involving Tailwind/daisyUI.
- Should not be considered a substitute for Electron launch smoke because this repo has explicit Electron API restrictions and IPC boundary contracts.

#### 3. Playwright/Electron E2E smoke testing

**What it covers**

- Launches the real Electron application, validating main process startup, preload bridge, renderer bundle, Vite/Electron Forge integration, native module loading, and basic user-visible startup state.
- Can exercise a thin golden path: app opens, initial practice screen appears, settings drawer opens, template picker/editor basic interaction works, no renderer crash.

**Best-practice role**

- Use as a small smoke suite, not as the main place for exhaustive UI permutations.
- Electron documentation says Electron does not maintain its own testing solution, but its automated testing guide covers ways to run end-to-end tests for Electron apps; Playwright and WebDriverIO-style Electron automation are common choices.
- Keep the smoke stable and minimal because Electron E2E is slower and more environment-sensitive than Vitest tests.

**Gaps / caveats**

- Requires additional dependencies and environment handling. `playwright`/`@playwright/test` are not installed.
- Headless Linux/Electron CI can need display dependencies or an X virtual framebuffer depending on environment.
- Full product golden-path validation may still require human/manual checks when AI/provider credentials, keychain, native permissions, or graphics interaction are involved.

**Mapped to this repo**

- Aligns strongly with existing project contracts:
  - `.trellis/spec/product/validation-and-testing.md:111-117` lists `pnpm dev` among validation commands.
  - `.trellis/spec/product/validation-and-testing.md:133-137` requires lint/typecheck/tests and says frontend/product-flow changes need dev-app launch and manual UI verification when a graphical environment is available.
  - `.trellis/spec/frontend/ipc-electron.md:209-212` calls for IPC boundary/static checks and a dev smoke test long enough to verify Vite bundles and Electron launch.
  - `.trellis/spec/frontend/electron-browser-api-restrictions.md:257-266` says to test in Electron, not only browser.
- A small Electron E2E smoke is the only compared option that directly automates this repo's Electron-launch contract.

### Recommended Layering for This Repo's Stage and Constraints

| Layer | Use now? | Purpose | Notes for this repo |
|---|---:|---|---|
| Existing Vitest unit/integration/contract tests | Already present | Main process/services/shared schemas/query cache contracts | Preserve current `pnpm test` role. |
| Vitest + React Testing Library + jsdom | Yes, first component-test addition | Fast automated renderer component coverage | Add for stable UI states and accessibility semantics; mock `window.api`/query hooks. |
| Vitest Browser Mode component tests | Later / selective | Real-browser component behavior | Add only for focus/layout/input/scroll cases where DOM emulation is insufficient. |
| Playwright/Electron E2E smoke | Yes, small smoke layer when adding E2E infra | Automate Electron launch/preload/renderer integration | Keep minimal; complements, not replaces, manual UI verification. |

Practical interpretation:

1. For broad renderer confidence, the most economical first step is Vitest + React Testing Library + jsdom component tests because the repo already uses Vitest and Vite, and current gaps are mounted component behavior.
2. For Electron-specific confidence, add a small Playwright/Electron smoke suite because repo specs already require Electron launch/manual UI checks and because browser/jsdom tests do not validate preload/main/native integration.
3. Defer Vitest Browser Mode until a specific component needs real browser fidelity. It is valuable but less directly aligned with the current missing layers than jsdom component tests plus Electron smoke.
4. Keep manual verification language from the specs: automated component/E2E smoke can reduce risk, but full frontend/product-flow changes still need Electron/manual golden-path validation when possible, and limitations must be reported explicitly.

### External References

- [Vitest Browser Mode Guide](https://vitest.dev/guide/browser/) — browser-backed Vitest test mode for running tests in a real browser context; relevant for comparing browser component tests with DOM emulation.
- [Vitest Test Environment Guide](https://vitest.dev/guide/environment.html) — documents Vitest test environments such as `node`, `jsdom`, and `happy-dom`; relevant for component-test environment selection.
- [React Testing Library Introduction](https://testing-library.com/docs/react-testing-library/intro/) — React Testing Library builds on DOM Testing Library with APIs for React components and emphasizes tests that avoid implementation details.
- [Electron Automated Testing](https://www.electronjs.org/docs/latest/tutorial/automated-testing) — Electron's testing guide notes Electron does not maintain its own testing solution but describes E2E automation approaches for Electron apps.
- [Playwright Electron support](https://playwright.dev/docs/api/class-electronapplication) — Playwright exposes Electron application automation APIs; useful for smoke testing Electron startup and renderer windows.

### Related Specs

- `.trellis/spec/product/validation-and-testing.md` — project validation contract and manual UI verification requirements.
- `.trellis/spec/frontend/ipc-electron.md` — IPC boundary testing and dev smoke requirements.
- `.trellis/spec/frontend/electron-browser-api-restrictions.md` — Electron/browser API caveats and requirement to test in Electron.
- `.trellis/spec/frontend/components.md` — semantic HTML/accessibility component patterns that fit Testing Library assertions.
- `.trellis/spec/backend/directory-structure.md` — test directory structure guidance including setup/helpers/mocks and Electron mocks.

## Caveats / Not Found

- The repository currently has no `vitest.config.ts`; Vitest is likely running with defaults and TypeScript/Vite auto behavior.
- No React Testing Library, jsdom/happy-dom, Playwright, or Vitest Browser Mode packages were installed at inspection time.
- No mounted renderer component tests or Electron E2E smoke tests were found outside `node_modules`.
- External documentation snippets were fetched from public docs pages; exact package APIs should be rechecked against installed versions when implementation begins.
- This research describes testing-stack options and repo fit only; it does not modify code or add dependencies.
