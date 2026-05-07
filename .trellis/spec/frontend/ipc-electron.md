# IPC & Electron Guidelines

> IPC API usage, context isolation, and Electron-specific patterns.

---

## IPC API Guidelines

### Using window.api

The preload script exposes `window.api` for communicating with the main process.

```tsx
// Good - Use window.api for IPC calls
const result = await window.api.auth.login({ email, password });
const session = await window.api.session.restore();

// Bad - Don't use ipcRenderer directly in renderer
import { ipcRenderer } from 'electron'; // Won't work with contextIsolation
```

### Type Safety for IPC

Types should be defined in a shared location and used by both main and renderer processes.

```tsx
// Import types from shared types
import type { LoginInput, AuthResponse, SessionData } from '../shared/types/auth';

// window.api is fully typed via preload.ts
const result: AuthResponse = await window.api.auth.login(data);
```

### Preload API Structure

```typescript
// src/preload.ts
import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from './shared/constants/channels';

contextBridge.exposeInMainWorld('api', {
  auth: {
    login: (data: LoginInput): Promise<AuthResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTH.LOGIN, data),
    register: (data: RegisterInput): Promise<AuthResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTH.REGISTER, data),
    logout: (): Promise<AuthResponse> => ipcRenderer.invoke(IPC_CHANNELS.AUTH.LOGOUT),
  },
  session: {
    get: (): Promise<SessionData> => ipcRenderer.invoke(IPC_CHANNELS.SESSION.GET),
    restore: (): Promise<SessionData> => ipcRenderer.invoke(IPC_CHANNELS.SESSION.RESTORE),
  },
});

// Type declaration for window.api
declare global {
  interface Window {
    api: {
      auth: {
        login: (data: LoginInput) => Promise<AuthResponse>;
        register: (data: RegisterInput) => Promise<AuthResponse>;
        logout: () => Promise<AuthResponse>;
      };
      session: {
        get: () => Promise<SessionData>;
        restore: () => Promise<SessionData>;
      };
    };
  }
}
```

---

## Scenario: Foundation Settings IPC Contract

### 1. Scope / Trigger

- Trigger: Any task that adds or changes the foundation Settings shell, startup status, provider config, provider credential mutation/status, or raw-response storage toggle.
- The renderer displays settings and startup state only through `window.api`; main process owns settings, database location, provider config persistence, and credential/keychain access.

### 2. Signatures

Preload API:

```typescript
type Api = {
  app: {
    getStartupStatus: () => Promise<StartupStatus>;
  };
  settings: {
    get: () => Promise<SettingsSnapshot>;
    setRawResponseStorage: (input: SetRawResponseStorageInput) => Promise<boolean>;
    setProviderConfig: (input: SetProviderConfigInput) => Promise<SettingsSnapshot>;
    setOnboardingIntroVersionSeen: (input: SetOnboardingIntroVersionSeenInput) => Promise<SettingsSnapshot>;
  };
  credentials: {
    getProviderKeyStatus: () => Promise<ProviderKeyStatus>;
    setProviderApiKey: (input: SetProviderApiKeyInput) => Promise<ProviderCredentialMutationResult>;
    deleteProviderApiKey: () => Promise<ProviderCredentialMutationResult>;
  };
};
```

IPC channels:

```typescript
const IPC_CHANNELS = {
  APP: {
    GET_STARTUP_STATUS: 'app:getStartupStatus',
  },
  SETTINGS: {
    GET: 'settings:get',
    SET_RAW_RESPONSE_STORAGE: 'settings:setRawResponseStorage',
    SET_PROVIDER_CONFIG: 'settings:setProviderConfig',
    SET_ONBOARDING_INTRO_VERSION_SEEN: 'settings:setOnboardingIntroVersionSeen',
  },
  CREDENTIALS: {
    GET_PROVIDER_KEY_STATUS: 'credentials:getProviderKeyStatus',
    SET_PROVIDER_API_KEY: 'credentials:setProviderApiKey',
    DELETE_PROVIDER_API_KEY: 'credentials:deleteProviderApiKey',
  },
} as const;
```

### 3. Contracts

`StartupStatus` response fields:

| Field | Type | Constraint |
| --- | --- | --- |
| `databaseReady` | boolean | Local SQLite file was opened and the app can report its path |
| `databaseLocation` | string | Non-empty app-data SQLite path |
| `migrationsApplied` | boolean | Startup migrations completed successfully |

`SettingsSnapshot` response fields:

| Field | Type | Constraint |
| --- | --- | --- |
| `provider` | string | Non-empty; v0.1 live review uses `OpenAI-compatible` |
| `baseUrl` | string | Non-empty OpenAI-compatible endpoint base; stored in main-process settings, never inferred in renderer |
| `model` | string | Non-empty configured model name |
| `isLocalModel` | boolean | `false` for OpenAI-compatible cloud providers |
| `reviewContextDescription` | string | Explains what review context will be sent |
| `rawResponseStorageEnabled` | boolean | Production default is `false` |
| `onboardingIntroVersionSeen` | number | Non-negative integer; renderer shows first-launch onboarding when this is lower than the current onboarding intro version |
| `databaseLocation` | string | Non-empty app-data SQLite path |
| `piMonoAuthStatus` | `'not-configured' | 'configured'` | Display-only foundation status |
| `providerApiKeyStatus` | `'not-configured' | 'configured' | 'unavailable'` | Derived from main-process keychain service |
| `ankiConnectStatus` | `'reserved'` | Reserved v0.1 Settings row |

`SetRawResponseStorageInput` request fields:

| Field | Type | Constraint |
| --- | --- | --- |
| `enabled` | boolean | Validate in main process with Zod before persistence |

`SetProviderConfigInput` request fields:

| Field | Type | Constraint |
| --- | --- | --- |
| `baseUrl` | string | Trimmed, non-empty OpenAI-compatible base URL |
| `model` | string | Trimmed, non-empty model name |

`SetProviderApiKeyInput` request fields:

| Field | Type | Constraint |
| --- | --- | --- |
| `apiKey` | string | Trimmed, non-empty; write-only input, never returned to renderer |

`SetOnboardingIntroVersionSeenInput` request fields:

| Field | Type | Constraint |
| --- | --- | --- |
| `version` | number | Integer >= 1; main process stores the max of current and requested versions so stale renderer calls cannot downgrade dismissal state |

`ProviderCredentialMutationResult` response fields:

| Field | Type | Constraint |
| --- | --- | --- |
| `success` | boolean | Indicates keychain mutation result |
| `status` | `ProviderKeyStatus \| undefined` | Returned on successful mutation; contains only status/storage |
| `error` | string \| undefined | Human-readable failure; must not include the submitted key |

### 4. Validation & Error Matrix

| Condition | Behavior |
| --- | --- |
| Renderer requests settings | Main returns `settingsSnapshotSchema.parse(...)` output |
| Renderer toggles raw response storage with non-boolean input | Main rejects via Zod parse error |
| Renderer saves blank provider base URL/model | Main rejects via Zod parse error; do not mutate stored config |
| Renderer saves provider API key | Main trims and writes it to OS keychain; response returns only status/storage |
| Renderer deletes provider API key | Main deletes it from OS keychain; response returns only status/storage |
| Renderer dismisses first-launch onboarding | Main validates `{ version }`, stores a monotonic `onboardingIntroVersionSeen`, and returns a fresh `SettingsSnapshot` |
| Renderer sends an invalid onboarding version | Main rejects via Zod parse error; do not mutate stored settings |
| Stale renderer sends a lower onboarding version than already stored | Main keeps the higher stored version and returns a fresh `SettingsSnapshot` |
| Keychain read succeeds with stored password | Return `{ status: 'configured', storage: 'os-keychain' }` |
| Keychain read succeeds with no password | Return `{ status: 'not-configured', storage: 'os-keychain' }` |
| Keychain read throws | Return `{ status: 'unavailable', storage: 'os-keychain' }` |
| Keychain write/delete throws | Return `{ success: false, error }` without echoing the submitted key |
| Migration startup failed after SQLite opens | Startup status reports `databaseReady: true` and `migrationsApplied: false` |
| SQLite startup failed before IPC registration | App cannot provide startup status; surface the launch/startup error instead |

### 5. Good/Base/Bad Cases

- Good: Renderer calls `window.api.settings.get()` and renders provider/base URL/model/database/raw-response/keychain/pi-mono/Anki status from typed response data.
- Good: Renderer compares `settings.onboardingIntroVersionSeen` to the shared current onboarding intro version and calls `window.api.settings.setOnboardingIntroVersionSeen({ version })` when the intro is skipped or completed.
- Good: Renderer submits a write-only API key through `window.api.credentials.setProviderApiKey({ apiKey })`, clears its local input after success, and only displays key status.
- Base: Keychain is unavailable, so Settings displays `unavailable` and review fails with a configuration error before sending journal content.
- Base: Settings can replay the welcome intro without clearing or lowering `onboardingIntroVersionSeen`.
- Bad: Renderer imports `electron-store`, `keytar`, `fs`, or database modules to compute Settings rows.
- Bad: Renderer stores onboarding dismissal only in component state or localStorage while Settings uses main-process settings for the rest of the app.
- Bad: A lower onboarding version from a stale renderer tab overwrites a higher stored version.
- Bad: Renderer stores, logs, displays, or receives a provider API key after the set operation.
- Bad: Raw response storage defaults to `true` in production or is hidden from Settings.

### 6. Tests Required

- Settings default test:
  - Assert `rawResponseStorageEnabled` is `false` by default.
  - Assert `onboardingIntroVersionSeen` is `0` by default and schema-valid.
  - Assert provider/base URL/model/database/status fields are present and schema-valid.
- Onboarding intro persistence test:
  - Assert `setOnboardingIntroVersionSeen({ version })` persists the requested version.
  - Assert a later call with a lower version cannot downgrade the stored version.
  - Assert the IPC channel returns a schema-valid `SettingsSnapshot`.
- Credential mutation test:
  - Assert set-key input trims a non-empty key.
  - Assert mutation responses never contain `apiKey`.
  - Assert keychain unavailable/write/delete failures return a safe error.
- IPC boundary test or static check:
  - Assert renderer files do not import `electron`, `node:*`, `fs`, `path`, `better-sqlite3`, or `keytar`.
- Dev smoke test:
  - Run `pnpm run dev` long enough to verify Vite bundles and Electron launch.

### 7. Wrong vs Correct

#### Wrong

```tsx
import Store from 'electron-store';
import keytar from 'keytar';

const store = new Store();
const rawResponseStorageEnabled = store.get('rawResponseStorageEnabled');
const apiKey = await keytar.getPassword('Inkline', 'provider-api-key');
```

Renderer code must not access Node/Electron storage or keychain APIs directly.

#### Correct

```tsx
const settings = await window.api.settings.get();
const rawResponseStorageEnabled = settings.rawResponseStorageEnabled;
const result = await window.api.credentials.setProviderApiKey({ apiKey: inputValue });
```

The main process validates and owns settings/keychain access; preload exposes only typed, narrow APIs and never returns the stored API key.

---

## Scenario: Today Journal IPC + Autosave Contract

### 1. Scope / Trigger

- Trigger: Any task that adds or changes Today journal loading, autosave, content revisions, stale review state, or editor-to-main persistence.
- The renderer owns transient editor text only. The main process owns journal identity, revision creation, content hashing, and review stale-state transitions.

### 2. Signatures

Preload API:

```typescript
type Api = {
  journal: {
    getToday: () => Promise<TodayJournalSnapshot>;
    saveToday: (input: SaveTodayJournalInput) => Promise<SaveTodayJournalResult>;
  };
};
```

IPC channels:

```typescript
const IPC_CHANNELS = {
  JOURNAL: {
    GET_TODAY: 'journal:getToday',
    SAVE_TODAY: 'journal:saveToday',
  },
} as const;
```

### 3. Contracts

`SaveTodayJournalInput` request fields:

| Field | Type | Constraint |
| --- | --- | --- |
| `content` | string | Raw editor text from renderer; normalize to LF in the main process before hashing or persistence |

`TodayJournalSnapshot` response fields:

| Field | Type | Constraint |
| --- | --- | --- |
| `entryId` | string | Non-empty `journal_entries.id` |
| `dateKey` | string | Local date key for today's journal identity |
| `activeRevision` | `JournalRevisionSnapshot \| null` | Current active saved revision, or null before first save |
| `lastAutosaveAt` | `number \| null` | Unix milliseconds from active revision creation time |
| `lastReviewRunId` | `string \| null` | Active saved review pointer; null after stale transition |
| `staleReview` | `StaleReviewSnapshot \| null` | Most recent stale review history signal for UI copy |

`JournalRevisionSnapshot` fields:

| Field | Type | Constraint |
| --- | --- | --- |
| `id` | string | Non-empty `journal_revisions.id` |
| `journalEntryId` | string | Matches `entryId` |
| `content` | string | LF-normalized text; never mutated by corrections |
| `contentHash` | string | SHA-256 of LF-normalized content |
| `createdAt` | number | Unix milliseconds |

### 4. Validation & Error Matrix

| Condition | Behavior |
| --- | --- |
| Renderer loads Today with no journal entry | Main creates or returns today's `journal_entries` identity and returns `activeRevision: null` |
| Renderer saves text with CRLF/CR line endings | Main normalizes to LF before storing and hashing |
| Saved content hash equals active revision hash | Return current snapshot with `saved: false`; do not create a duplicate revision |
| Saved content hash differs | Create a new `journal_revisions` row and update `journal_entries.active_revision_id` |
| Existing `last_review_run_id` points to `review_saved` with different hash | Mark that run `stale`, clear `last_review_run_id` and `reviewed_at`, preserve review history |
| IPC payload or response shape is invalid | Main rejects via Zod parse error at the IPC boundary |

### 5. Good/Base/Bad Cases

- Good: Renderer autosaves through `window.api.journal.saveToday({ content })`; main normalizes, hashes, creates a revision, and returns a timestamp-ms snapshot.
- Base: Empty editor loads today's identity with no active revision and shows a before-writing state.
- Bad: Renderer computes `content_hash`, imports `node:crypto`, or imports database/schema modules.
- Bad: Autosave mutates correction text, review artifacts, or historical revision content.

### 6. Tests Required

- Content utility tests:
  - Assert CRLF and CR normalize to LF.
  - Assert equivalent line endings produce the same content hash.
- Revision contract tests:
  - Assert new content creates an active LF-normalized revision.
  - Assert changed content after a saved review marks the review stale and clears the active review pointer.
- Database contract tests:
  - Assert `journal_entries` and `journal_revisions` exist in migration SQL.
  - Assert timestamp defaults use Unix milliseconds.

### 7. Wrong vs Correct

#### Wrong

```tsx
const hash = crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
await window.api.journal.saveToday({ content, hash });
```

Renderer-side hashing splits the contract and can diverge from persisted LF normalization.

#### Correct

```tsx
await window.api.journal.saveToday({ content });
```

The main process validates, normalizes, hashes, persists a new revision only when needed, and returns the typed snapshot.

---

## Data Refresh Subscription Pattern

All hooks that fetch data from the backend via IPC **should** subscribe to data change events. This ensures UI updates when data changes from external sources (sync, background refresh, etc.).

### Why This Matters

When data changes in the background:

1. New data is written to local database
2. **But UI won't update** unless hooks refetch their data
3. Without subscription, users see stale data until page reload

### Implementation Pattern

```typescript
// Required pattern for data-fetching hooks
import { useDataRefresh } from '../context/DataRefreshContext';

export function useMyData({ workspaceId }: Options) {
  const [data, setData] = useState([]);
  const { onDataRefresh } = useDataRefresh();

  const fetchData = useCallback(async () => {
    const result = await window.api.myData.list({ workspaceId });
    setData(result);
  }, [workspaceId]);

  // Initial fetch
  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // CRITICAL: Subscribe to data refresh events
  useEffect(() => {
    const unsubscribe = onDataRefresh(() => {
      void fetchData(); // Refetch when data refreshes
    });
    return unsubscribe;
  }, [onDataRefresh, fetchData]);

  return { data, refetch: fetchData };
}
```

### Common Mistake: Missing Hook

```tsx
// MyPage.tsx uses TWO data hooks:
const { items } = useItems({ workspaceId }); // Has subscription
const { tree } = useItemTree({ workspaceId }); // ALSO needs subscription!

// UI renders from useItemTree, not useItems!
<TreeView nodes={tree} />;
```

**Rule**: Trace which hook's data the UI actually renders, not just what "looks related".

---

## Electron Context Isolation Restrictions

This project uses `contextIsolation: true` for security. This means the renderer process is isolated from Node.js and Electron APIs.

### What You CANNOT Do in Renderer

```tsx
// These will NOT work in renderer process:

// 1. File.path from drag-and-drop
const handleDrop = (e: DragEvent) => {
  const file = e.dataTransfer.files[0];
  console.log(file.path); // undefined! Not exposed with contextIsolation
};

// 2. Node.js APIs
import fs from 'fs'; // Error: Module not found
import path from 'path'; // Error: Module not found

// 3. Electron APIs directly
import { dialog } from 'electron'; // Error: Not available in renderer
import { clipboard } from 'electron'; // Error: Not available in renderer
```

### How to Access Native Features

When you need native functionality (file system, dialogs, clipboard, etc.), you MUST:

1. **Create IPC channel** in shared constants
2. **Add IPC handler** in main process
3. **Expose via preload** in preload.ts
4. **Call via window.api** in renderer

```tsx
// Example: Native directory picker

// Step 1: Add channel (src/shared/constants/channels.ts)
export const IPC_CHANNELS = {
  DIALOG: {
    SELECT_DIRECTORY: 'dialog:selectDirectory',
  },
} as const;

// Step 2: Add handler (src/main/ipc/dialog.handler.ts)
import { ipcMain, dialog } from 'electron';
import { IPC_CHANNELS } from '../shared/constants/channels';

ipcMain.handle(IPC_CHANNELS.DIALOG.SELECT_DIRECTORY, async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  return { success: true, path: result.filePaths[0] };
});

// Step 3: Expose in preload (src/preload.ts)
contextBridge.exposeInMainWorld('api', {
  dialog: {
    selectDirectory: (): Promise<{ success: boolean; path?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.DIALOG.SELECT_DIRECTORY),
  },
});

// Step 4: Use in renderer
const result = await window.api.dialog.selectDirectory();
if (result.path) {
  console.log('Selected:', result.path);
}
```

### Common Native Features via IPC

| Feature          | IPC Channel              | API                                   |
| ---------------- | ------------------------ | ------------------------------------- |
| Select directory | `dialog:selectDirectory` | `window.api.dialog.selectDirectory()` |
| Select file      | `dialog:selectFile`      | `window.api.dialog.selectFile()`      |
| Save file        | `dialog:saveFile`        | `window.api.dialog.saveFile()`        |
| Read clipboard   | `clipboard:read`         | `window.api.clipboard.read()`         |
| Write clipboard  | `clipboard:write`        | `window.api.clipboard.write()`        |

### Key Reminder

> **Before implementing any feature that requires file paths, native dialogs, or system APIs:**
>
> 1. Check if `window.api` already has the needed function
> 2. If not, implement the full IPC flow (channel -> handler -> preload -> renderer)
> 3. Never assume browser/Electron APIs work the same way

---

## Desktop Title Bar (macOS traffic lights + draggable regions)

When implementing a custom title bar (like Obsidian/Notion-style **TabBar in the window title bar area**) on macOS, you must coordinate three layers:

1. **Main process**: `BrowserWindow` title bar configuration
2. **Renderer bootstrap**: platform class for CSS targeting
3. **CSS**: explicit draggable / non-draggable regions via `-webkit-app-region`

### 1) Main process: BrowserWindow config (macOS)

- Use `titleBarStyle: "hiddenInset"` on macOS to extend web contents into the title bar.
- Set `trafficLightPosition` so the traffic lights are visually centered in your title bar height.
- Treat the title bar height as a **design constant**: if you change the height, you must re-check `trafficLightPosition`.

```typescript
// src/main.ts
const win = new BrowserWindow({
  titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
  trafficLightPosition: { x: 12, y: 12 }, // Adjust based on your title bar height
  // ...other options
});
```

### 2) Renderer bootstrap: platform class

Add a platform class to `document.documentElement` and use it for CSS offsets:

```typescript
// src/renderer.ts
if (process.platform === 'darwin') {
  document.documentElement.classList.add('platform-mac');
}
```

Use it to add left padding to the title bar so tabs do not overlap the traffic lights:

```css
.platform-mac .tab-bar {
  padding-left: 80px; /* Space for traffic lights */
}
```

### 3) CSS: drag/no-drag regions (Electron)

Rules:

- Set `-webkit-app-region: drag` on the _outer_ title bar container (e.g., `.tab-bar`).
- Mark **every interactive element** inside it as `-webkit-app-region: no-drag` (buttons, tabs, menus, inputs).
- Avoid visual seams between the active tab and the main content.

```css
/* Title bar is draggable by default */
.tab-bar {
  -webkit-app-region: drag;
  height: 40px;
  display: flex;
  align-items: center;
}

/* Interactive elements must be non-draggable */
.tab-bar button,
.tab-bar .tab-item,
.tab-bar input {
  -webkit-app-region: no-drag;
}
```

---

## Menu Accelerators (Keyboard Shortcuts)

When implementing native keyboard shortcuts like `Cmd+W`, `Cmd+T`, `Cmd+N`, you must use **Electron's Application Menu**, not `globalShortcut` or `before-input-event`.

### Why Menu Accelerators

- macOS respects menu accelerators as the **authoritative source** for keyboard shortcuts
- Using `globalShortcut` can conflict with other apps
- `before-input-event` is low-level and harder to maintain
- Menu accelerators automatically appear in the native menu with correct key symbols

### Implementation Pattern

#### 1. Define IPC Channel

```typescript
// src/shared/constants/channels.ts
export const IPC_CHANNELS = {
  TABS: {
    NEW_TAB: 'tabs:newTab', // Cmd+T
    NEW_DOC: 'tabs:newDoc', // Cmd+N
    CLOSE_ACTIVE: 'tabs:closeActive', // Cmd+W
    REOPEN_CLOSED: 'tabs:reopenClosed', // Shift+Cmd+T
  },
} as const;
```

#### 2. Create Menu with Accelerators

```typescript
// src/main.ts
import { Menu, BrowserWindow, MenuItemConstructorOptions } from 'electron';
import { IPC_CHANNELS } from './shared/constants/channels';

function createApplicationMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Tab',
          accelerator: 'CmdOrCtrl+T',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) {
              win.webContents.send(IPC_CHANNELS.TABS.NEW_TAB);
            }
          },
        },
        {
          label: 'Close Tab',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) {
              win.webContents.send(IPC_CHANNELS.TABS.CLOSE_ACTIVE);
            }
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
```

#### 3. Bridge in Preload

```typescript
// src/preload.ts
contextBridge.exposeInMainWorld('api', {
  tabs: {
    onNewTab: (handler: () => void) => {
      const wrapped = () => handler();
      ipcRenderer.on(IPC_CHANNELS.TABS.NEW_TAB, wrapped);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.TABS.NEW_TAB, wrapped);
    },
    onCloseActiveTab: (handler: () => void) => {
      const wrapped = () => handler();
      ipcRenderer.on(IPC_CHANNELS.TABS.CLOSE_ACTIVE, wrapped);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.TABS.CLOSE_ACTIVE, wrapped);
    },
  },
});
```

#### 4. Subscribe in Renderer

```tsx
// src/renderer/src/App.tsx or TabsContext.tsx
useEffect(() => {
  const unsubscribe = window.api.tabs.onNewTab(() => {
    openNewTab();
  });
  return unsubscribe;
}, [openNewTab]);
```

### Data Flow

```
Main Process (Menu Accelerator)
    | webContents.send(channel)
Preload (ipcRenderer.on)
    | handler callback
Renderer (useEffect subscription)
    | state update
UI Re-render
```

### Key Points

| Rule                                      | Reason                                     |
| ----------------------------------------- | ------------------------------------------ |
| Use `Menu.setApplicationMenu()`           | macOS uses app menu as truth for shortcuts |
| Use `webContents.send()` in click handler | Main -> Renderer communication             |
| Return unsubscribe function in preload    | Prevent memory leaks                       |
| Clean up in useEffect return              | React lifecycle management                 |

### Common Shortcuts Reference

| Shortcut    | Action        | Channel                     |
| ----------- | ------------- | --------------------------- |
| Cmd+N       | New document  | `tabs:newDoc`               |
| Cmd+T       | New tab       | `tabs:newTab`               |
| Cmd+W       | Close tab     | `tabs:closeActive`          |
| Shift+Cmd+T | Reopen closed | `tabs:reopenClosed`         |
| Shift+Cmd+N | New window    | (creates new BrowserWindow) |

---

## Floating Window Pattern (Global Shortcut + Always-on-Top)

When implementing a floating window (like Raycast Notes) that:

- Stays on top of other apps
- Toggles via global shortcut
- Pre-loads for instant open

### Architecture Overview

```
Main Process (floating-window.ts)
+-- createFloatingWindow() - Pre-create hidden window
+-- toggleFloatingWindow() - Show/hide instantly
+-- registerFloatingShortcut() - globalShortcut registration
+-- hover tracking (cursor polling -> IPC)
         | webContents.send()
Preload (preload.ts)
+-- floatingWindow.toggle/show/hide
+-- floatingWindow.onFocused
+-- floatingWindow.onHoverChanged
         | callback
Renderer (FloatingWindowPage.tsx)
+-- useEffect subscriptions
```

### Key Implementation Points

#### 1. Pre-load Window for Instant Open

```typescript
// In main process service
import { BrowserWindow } from 'electron';

let floatingWindow: BrowserWindow | null = null;

export function createFloatingWindow(): BrowserWindow {
  floatingWindow = new BrowserWindow({
    show: false, // Hidden initially
    alwaysOnTop: true, // Float above other apps
    frame: false, // Custom titlebar
    skipTaskbar: true, // Don't show in dock/taskbar
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });

  // Load content immediately so it's ready
  floatingWindow.loadURL(`${MAIN_WINDOW_VITE_URL}#/floating-window`);

  // Don't destroy on close, just hide
  floatingWindow.on('close', (event) => {
    event.preventDefault();
    floatingWindow?.hide();
  });

  return floatingWindow;
}
```

#### 2. Global Shortcut Registration

```typescript
import { globalShortcut, app } from 'electron';

export function registerFloatingShortcut(): boolean {
  return globalShortcut.register('Alt+J', toggleFloatingWindow);
}

// MUST unregister on app quit
app.on('before-quit', () => {
  globalShortcut.unregister('Alt+J');
});

export function toggleFloatingWindow(): void {
  if (!floatingWindow) return;

  if (floatingWindow.isVisible()) {
    floatingWindow.hide();
  } else {
    floatingWindow.show();
    floatingWindow.focus();
    floatingWindow.webContents.send('floating-window:focused');
  }
}
```

#### 3. Cross-Process Hover Detection

When using `-webkit-app-region: drag`, DOM mouse events don't fire. Solution: poll cursor position in main process.

```typescript
// Main process
import { screen } from 'electron';

let hoverInterval: NodeJS.Timeout | null = null;

export function startHoverTracking(): void {
  hoverInterval = setInterval(() => {
    if (!floatingWindow || !floatingWindow.isVisible()) return;

    const cursor = screen.getCursorScreenPoint();
    const bounds = floatingWindow.getBounds();
    const isInside =
      cursor.x >= bounds.x &&
      cursor.x <= bounds.x + bounds.width &&
      cursor.y >= bounds.y &&
      cursor.y <= bounds.y + bounds.height;

    floatingWindow.webContents.send('floating-window:hoverChanged', isInside);
  }, 50);
}
```

```tsx
// Renderer - avoid React re-renders by manipulating DOM directly
const containerRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  const container = containerRef.current;
  const unsubscribe = window.api.floatingWindow.onHoverChanged((isHovered) => {
    container?.classList.toggle('floating-window--hovered', isHovered);
  });
  return unsubscribe;
}, []);
```

### IPC Channels

| Channel                        | Direction | Purpose                        |
| ------------------------------ | --------- | ------------------------------ |
| `floating-window:toggle`       | R->M      | Toggle visibility              |
| `floating-window:show`         | R->M      | Show window                    |
| `floating-window:hide`         | R->M      | Hide window                    |
| `floating-window:focused`      | M->R      | Window just shown, focus input |
| `floating-window:hoverChanged` | M->R      | Cursor inside/outside window   |

---

**Language**: All documentation must be written in **English**.
