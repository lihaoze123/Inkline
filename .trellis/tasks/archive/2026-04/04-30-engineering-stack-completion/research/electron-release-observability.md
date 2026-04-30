# Research: Electron Release Observability and Hardening

- **Query**: Research production engineering best practices for Electron Forge apps: security hardening, CSP, fuses, code signing/notarization, auto update, crash/error reporting, and privacy considerations. Compare minimal MVP vs release-ready setup. Map recommendations to this repo: local-first app handling user writing and API keys.
- **Scope**: mixed
- **Date**: 2026-04-30

## Findings

### Files Found

| File Path | Description |
|---|---|
| `package.json:2-18` | App metadata and scripts: Electron Forge start/package/make, private local-first desktop app. |
| `package.json:19-38` | Runtime dependencies include Electron Forge makers, `better-sqlite3`, `electron-store`, `keytar`, AI SDK providers, React. |
| `package.json:40-58` | Dev dependencies include Electron 39, Forge Vite plugin, rebuild tooling, TypeScript/Vite/Vitest/ESLint. |
| `forge.config.ts:8-18` | Forge packager config uses ASAR with native binary unpacking and `extraResource: ['drizzle']`; makers are Squirrel, ZIP, RPM, Deb. |
| `forge.config.ts:19-39` | Forge Vite plugin builds main, preload, and renderer targets. No fuses, signing, notarization, publishers, or update config present. |
| `src/main/index.ts:9-22` | Main `BrowserWindow` configuration enables `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`, with preload path `preload.cjs`. |
| `src/main/index.ts:24-28` | Renderer loads Vite dev URL in development and local `index.html` in packaged mode. |
| `src/preload/index.ts:29-80` | Narrow `contextBridge.exposeInMainWorld('api', api)` preload surface; renderer receives typed IPC methods, not raw Electron/Node APIs. |
| `src/main/ipc/handlers.ts:50-173` | IPC handlers validate request/response payloads with Zod schemas before calling main-process services. |
| `src/main/services/credentials/service.ts:1-76` | API keys are stored in OS keychain via `keytar`; renderer receives status only. |
| `src/main/services/settings/service.ts:34-43` | `electron-store` defaults raw model response storage to `false` and stores provider/model settings outside SQLite. |
| `src/main/services/review/lib/persistence-decision.ts:11-24` | Raw model output is persisted only when `rawResponseStorageEnabled` is true. |
| `src/main/services/ai/provider.ts:1-51` | AI provider calls use Electron `net.fetch` from the main process. |
| `src/renderer/index.html:1-12` | Renderer HTML has no Content-Security-Policy meta tag. |
| `vite.main.config.ts:3-18` | Main bundle outputs CJS and externalizes `electron`, `better-sqlite3`, and `keytar`. |
| `vite.preload.config.ts:3-18` | Preload bundle outputs CJS and externalizes `electron`. |
| `.trellis/spec/product/privacy-security.md:3-171` | Product privacy/security contract: local-first defaults, provider disclosures, raw-response opt-in, OS keychain preference, renderer/main boundary. |
| `.trellis/spec/frontend/ipc-electron.md:411-494` | Electron context isolation guidance: renderer cannot import Electron/Node APIs; native features must flow through IPC. |
| `.trellis/spec/shared/pnpm-electron-setup.md:177-263` | Forge + pnpm/native-module guidance includes an example FusesPlugin setup. |
| `.trellis/spec/backend/logging.md:7-49` | Logging guideline describes structured `electron-log` usage, but the app package currently has no `electron-log` dependency. |

### Code Patterns

#### Existing security-positive patterns

- `src/main/index.ts:16-21` configures the main window with:

```ts
webPreferences: {
  preload: path.join(__dirname, 'preload.cjs'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
},
```

This matches Electron's core renderer hardening guidance: isolate renderer JavaScript, avoid Node.js integration in renderer, and expose only a preload bridge.

- `src/preload/index.ts:29-80` exposes a narrow API object via `contextBridge`, with specific namespaces for `app`, `writing`, `settings`, `credentials`, and `review`. The bridge does not expose `ipcRenderer` itself.

- `src/main/ipc/handlers.ts:50-173` validates IPC inputs and outputs through Zod schemas. Examples include `setProviderApiKeyInputSchema.parse(input)` at `src/main/ipc/handlers.ts:119` and `settingsSnapshotSchema.parse(await getSettingsSnapshot())` at `src/main/ipc/handlers.ts:94`.

- `src/main/services/credentials/service.ts:26-76` keeps provider API keys in OS keychain via `keytar`, returning status objects rather than key values.

- `src/main/services/settings/service.ts:34-43` sets `rawResponseStorageEnabled: false` by default, matching `.trellis/spec/product/privacy-security.md:143-158`.

- `src/main/services/review/lib/persistence-decision.ts:22` conditionally persists raw provider output only if `params.rawResponseStorageEnabled` is true.

#### Release-readiness gaps found in repository mapping

These are factual gaps from repository search, not implementation review:

- CSP: `src/renderer/index.html:1-12` contains no CSP meta tag, and no searched file contains `Content-Security-Policy` or `CSP` in app source.
- Electron fuses: `forge.config.ts:19-39` has no `FusesPlugin` entry; package dependencies do not include `@electron-forge/plugin-fuses` or `@electron/fuses`.
- Code signing/notarization: `forge.config.ts:8-18` has no `osxSign`, `osxNotarize`, Windows certificate, or maker signing fields.
- Auto update/publishing: `forge.config.ts:18` configures makers only; no Forge publisher, `update-electron-app`, or `autoUpdater` usage was found.
- Crash/error reporting: app source search found no `crashReporter`, Sentry, `electron-log`, `uncaughtException`, or `unhandledRejection` setup. `.trellis/spec/backend/logging.md:7-49` describes a logging pattern but the package lacks `electron-log`.
- Permission/navigation controls: app source search found no `setPermissionRequestHandler`, `will-navigate`, `setWindowOpenHandler`, or `shell.openExternal` handling. Current app loads only own Vite URL/local HTML in `src/main/index.ts:24-28`.
- Privacy policy/export/deletion surface: product spec covers disclosure and local storage boundaries, but repository search did not identify a user-facing privacy policy document, telemetry consent screen, log redaction policy, or crash-report opt-in implementation.

### Best-Practice Matrix: Minimal MVP vs Release-Ready

| Area | Minimal MVP baseline | Release-ready setup | Repo mapping |
|---|---|---|---|
| Renderer isolation | `contextIsolation: true`, `nodeIntegration: false`, preload bridge only, schema-validated IPC. | Keep isolation, enable sandbox, avoid remote module, validate all IPC, block unexpected navigation/window opens, restrict permissions, never expose raw `ipcRenderer`. | Baseline mostly present in `src/main/index.ts:16-21`, `src/preload/index.ts:29-80`, `src/main/ipc/handlers.ts:50-173`; navigation/permission controls not found. |
| CSP | For MVP, a restrictive meta CSP for packaged renderer with no inline/eval allowances beyond what dev mode needs. | Environment-specific CSP: dev allows Vite websocket/dev script requirements; packaged build uses `default-src 'self'`, narrow `script-src`, `style-src`, `img-src`, `connect-src` only as needed. | No CSP in `src/renderer/index.html:1-12`. AI provider network calls occur in main via `src/main/services/ai/provider.ts:19`, so renderer `connect-src` can stay narrow unless UI loads external assets. |
| Electron fuses | Not mandatory for an internal-only prototype, but can be added once packaging is stable. | Use Forge FusesPlugin to disable RunAsNode, NODE_OPTIONS, CLI inspect args; enable cookie encryption and ASAR integrity; decide `OnlyLoadAppFromAsar` based on native unpacking needs. | No fuses currently. Existing ASAR unpacking for native modules in `forge.config.ts:9-14`; `.trellis/spec/shared/pnpm-electron-setup.md:249-257` notes `OnlyLoadAppFromAsar: false` when unpacked native files are needed. |
| ASAR/native modules | Package app with ASAR and unpack native `.node`/DLL files. | Keep ASAR, minimize packaged files, verify native modules are rebuilt and available, add package smoke tests per platform. | ASAR unpack and rebuild are present in `forge.config.ts:9-17`; Vite externalizes native modules in `vite.main.config.ts:10-12`. |
| Code signing | Optional for local dev/internal unsigned builds. | macOS Developer ID signing plus notarization; Windows Authenticode signing; Linux package metadata/signing as distribution channel requires. Secrets come from CI environment variables. | No signing config found. Makers include mac ZIP and Windows Squirrel in `forge.config.ts:18`. |
| Auto update | Can omit for MVP and publish manual downloads. | Use Forge publishers plus an updater compatible with the chosen target; sign updates; stage rollout; verify update metadata integrity; provide user-facing update state/errors. | No publisher/update code found. Squirrel maker is present, which aligns with Electron autoUpdater support on Windows/macOS, but no update server/feed is configured. |
| Crash/error reporting | Local console/error handling can be enough for a private MVP if no telemetry leaves the machine. | Start `crashReporter` early only with clear consent/privacy posture; collect main/renderer errors; redact writing/API keys; send minimal diagnostics; include app/version/platform and crash IDs; provide opt-out/delete policy. | No crash reporter or structured logger found. This app handles writing content and API keys, so telemetry should avoid raw essays, prompts, model outputs, and credentials by default. |
| Privacy/data handling | Local-first DB, OS keychain, disclosures before provider calls, raw provider output off by default. | Privacy notice, explicit telemetry/crash consent, log redaction, data export/delete behavior, provider data-boundary copy, documented storage locations, secure update/signing chain. | Strong product-level privacy contracts exist in `.trellis/spec/product/privacy-security.md:3-171`; code uses keytar and raw-response opt-in. Release privacy docs/telemetry consent not found. |
| Secrets | Store API keys outside SQLite and never return them to renderer. | Also redact secrets from logs/crash reports, avoid including keys in exception messages, audit IPC responses and dumps. | `keytar` pattern exists in `src/main/services/credentials/service.ts:26-76`; no logging/crash redaction layer found. |
| CI/release verification | Manual `pnpm run lint`, `typecheck`, `test`, `package`, `make`. | Matrix builds on macOS/Windows/Linux, notarization/signing in protected CI, package smoke tests, update smoke tests, artifact checks, dependency/vulnerability checks. | Scripts exist in `package.json:8-18`; no CI files were included in the files found by this focused search. |

### External References

- [Electron Security Tutorial](https://www.electronjs.org/docs/latest/tutorial/security) — Primary Electron checklist for secure defaults: only load secure content, disable Node integration for remote content, enable context isolation, validate IPC sender/origin, avoid exposing Electron APIs, block unexpected navigation/new windows, define CSP.
- [Electron Content Security Policy section](https://www.electronjs.org/docs/latest/tutorial/security#content-security-policy) — Electron recommends a CSP to reduce XSS impact; packaged apps commonly use a stricter policy than dev builds.
- [Electron Fuses Tutorial](https://www.electronjs.org/docs/latest/tutorial/fuses) — Describes build-time feature switches such as disabling `ELECTRON_RUN_AS_NODE`, `NODE_OPTIONS`, debug arguments, and enforcing ASAR integrity.
- [Electron Forge FusesPlugin](https://www.electronforge.io/config/plugins/fuses) — Forge plugin wrapper for `@electron/fuses`; relevant because this repo already uses Electron Forge.
- [Electron Forge Code Signing](https://www.electronforge.io/guides/code-signing) — Entry point for release signing requirements across platforms.
- [Electron Forge macOS Signing](https://www.electronforge.io/guides/code-signing/code-signing-macos) — Forge guidance for Developer ID signing and notarization for macOS distribution.
- [Electron Forge Windows Signing](https://www.electronforge.io/guides/code-signing/code-signing-windows) — Forge guidance for Authenticode signing and Windows certificate configuration.
- [Electron Forge Publishers](https://www.electronforge.io/config/publishers) — Forge publishing layer for release artifacts/update distribution.
- [Electron autoUpdater API](https://www.electronjs.org/docs/latest/api/auto-updater) — Electron update API; on Windows/macOS it is designed around Squirrel-compatible update feeds.
- [Electron crashReporter API](https://www.electronjs.org/docs/latest/api/crash-reporter) — Electron crash collection API; must be initialized early in the main process if used and should be aligned with privacy/consent policy.

### Related Specs

- `.trellis/spec/product/privacy-security.md` — Defines local-first storage, provider disclosures, raw response default-off behavior, OS keychain preference, prompt injection boundary, and renderer/main boundary.
- `.trellis/spec/frontend/ipc-electron.md` — Defines `window.api` IPC usage, context isolation restrictions, and the rule that renderer code must not import Electron/Node/storage/keychain APIs.
- `.trellis/spec/shared/pnpm-electron-setup.md` — Defines Forge/Vite CJS setup, native module packaging, ASAR unpacking, and example fuses configuration for apps with unpacked native modules.
- `.trellis/spec/backend/logging.md` — Defines desired structured logging pattern and native-module packaging notes.
- `.trellis/spec/product/mvp-scope.md` — Establishes v0.1 as a local-first AI writing practice MVP with provider disclosures and review flow, which frames the MVP vs release-ready split.

## Caveats / Not Found

- External references were checked against official Electron/Electron Forge documentation URLs available on 2026-04-30; detailed page text was not vendored into this research file.
- No active Trellis current task was set by `.trellis/scripts/task.py current --source`, but the user supplied an explicit research output path, which was used.
- Search was limited to repository files outside `node_modules`, `.git`, build outputs, and focused source/spec/config paths.
- No code changes outside this research markdown were made.
