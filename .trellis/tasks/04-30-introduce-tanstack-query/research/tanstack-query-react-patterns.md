# Research: TanStack Query React patterns for local Electron IPC renderer

- **Query**: Research TanStack Query v5 React patterns for migrating a local Electron IPC React renderer from hand-written useState/useEffect async state. Focus on QueryClientProvider setup, query key conventions, query functions wrapping window.api IPC calls, useMutation with invalidateQueries/setQueryData, retry/refetch defaults appropriate for local IPC, and debounced autosave mutation patterns.
- **Scope**: mixed
- **Date**: 2026-04-30

## Findings

### Files Found

| File Path | Description |
|---|---|
| `package.json` | React 19 app; `@tanstack/react-query` is not currently listed in dependencies. |
| `src/renderer/main.tsx` | Renderer root currently renders `<App />` inside `StrictMode`; this is the insertion point for a `QueryClientProvider`. |
| `src/renderer/App.tsx` | Main renderer component currently owns loading, IPC request, autosave, review, settings, and credential state through `useState`, `useEffect`, and callbacks. |
| `src/preload/index.ts` | Typed `window.api` surface wraps Electron `ipcRenderer.invoke` calls and exposes the IPC functions that query/mutation functions would call. |
| `src/renderer/vite-env.d.ts` | Declares `window.api: Api` for renderer TypeScript. |
| `src/main/ipc/handlers.ts` | Registers main-process handlers for app, writing, settings, credentials, and review channels; handlers parse inputs/outputs at the IPC boundary. |
| `.trellis/spec/frontend/hooks.md` | Existing project guidance for React Query query hooks, mutation hooks, invalidation, optimistic `setQueryData`, hook organization, and hook naming. |
| `.trellis/spec/frontend/ipc-electron.md` | Existing project guidance requiring renderer code to use typed `window.api` rather than importing Electron/Node APIs; includes autosave IPC contract notes. |

### Current Code Patterns

#### Root setup location

`src/renderer/main.tsx:12-16` currently renders the app without any query provider:

```tsx
createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

TanStack Query v5 React docs show root setup as creating a `QueryClient`, then wrapping the app in `QueryClientProvider client={queryClient}`. For this project, `src/renderer/main.tsx` is the narrow renderer-only location for that provider.

#### Existing foundation load state

`src/renderer/App.tsx:35-64` manually fetches initial IPC state in an effect and maintains discriminated `LoadState`:

```tsx
const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' });

useEffect(() => {
  let cancelled = false;

  async function loadFoundationState(): Promise<void> {
    try {
      const [writing, settings, startup] = await Promise.all([
        window.api.writing.getCurrentAttempt(),
        window.api.settings.get(),
        window.api.app.getStartupStatus(),
      ]);

      if (!cancelled) {
        setLoadState({ status: 'ready', writing, settings, startup });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load application state.';
      if (!cancelled) {
        setLoadState({ status: 'error', message });
      }
    }
  }

  void loadFoundationState();

  return () => {
    cancelled = true;
  };
}, []);
```

The corresponding IPC query functions are `window.api.writing.getCurrentAttempt()`, `window.api.settings.get()`, and `window.api.app.getStartupStatus()` from `src/preload/index.ts:29-55`.

#### Existing selected-template query pattern

`src/renderer/App.tsx:155-170` manually loads a writing attempt by template ID and then resets several local UI states:

```tsx
const selectTemplate = useCallback(async (templateId: WritingTemplateId): Promise<void> => {
  const nextWriting = await window.api.writing.getWritingAttempt({ templateId });
  setSelectedTemplateId(templateId);
  setWriting(nextWriting);
  setContent(nextWriting.activeRevision?.content ?? '');
  setUserGoal(nextWriting.userGoal ?? '');
  lastSavedContentRef.current = nextWriting.activeRevision?.content ?? '';
  setReviewPreview(null);
  setLatestReviewRun(null);
  setReviewState('idle');
  setReviewError(null);
  setCompletedRewritePractice(null);
  setRewritePracticeInput('');
  setStarterPromptError(null);
  setStarterPromptState('idle');
}, []);
```

This maps naturally to a query keyed by the selected `templateId`, with local editor fields remaining separate transient state.

#### Existing debounced autosave pattern

`src/renderer/App.tsx:172-203` implements autosave with a mutation-like callback and a `setTimeout` effect:

```tsx
const saveContent = useCallback(async (nextContent: string): Promise<void> => {
  setSaveState('saving');
  setSaveError(null);

  try {
    const savedWriting = await window.api.writing.saveWritingAttempt({ templateId: selectedTemplateId, content: nextContent, userGoal });
    lastSavedContentRef.current = savedWriting.activeRevision?.content ?? nextContent;
    setWriting(savedWriting);
    if (savedWriting.staleReview) {
      setReviewPreview(null);
      setLatestReviewRun(null);
    }
    setSaveState('saved');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Autosave failed.';
    setSaveError(message);
    setSaveState('error');
  }
}, [selectedTemplateId, userGoal]);

useEffect(() => {
  if (content === lastSavedContentRef.current) {
    return;
  }

  setSaveState('idle');
  const timeoutId = window.setTimeout(() => {
    void saveContent(content);
  }, AUTOSAVE_DELAY_MS);

  return () => window.clearTimeout(timeoutId);
}, [content, saveContent, userGoal]);
```

The existing delay constant is `AUTOSAVE_DELAY_MS = 900` at `src/renderer/App.tsx:23`.

#### Existing mutation-like IPC calls

`src/renderer/App.tsx` contains several imperative calls that update local cached snapshots after success:

| Lines | Operation | Current cache/state effect |
|---|---|---|
| `262-274` | Save current writing before review with `window.api.writing.saveWritingAttempt(...)` | Updates `lastSavedContentRef`, `writing`, and save state, then starts review. |
| `276-296` | Generate starter prompt with `window.api.writing.generateStarterPrompt(...)` | Updates `writing`, `userGoal`, prompt state, and disclosure/error state. |
| `309-330` | Save review with `window.api.review.save(...)` | Updates `writing` and review state. |
| `332-351` | Complete rewrite practice with `window.api.writing.completeRewritePractice(...)` | Updates `writing`, completed practice state, rewrite input, and error state. |
| `353-369` | Skip rewrite practice with `window.api.writing.skipRewritePractice(...)` | Updates `writing`, completed practice state, rewrite input, and error state. |
| `377-457` | Settings and credential mutations | Update `appSettings`, inputs, and messages; credential mutations refetch settings via `window.api.settings.get()`. |

These are the primary locations where `useMutation` callbacks would either write returned snapshots directly with `queryClient.setQueryData(...)` or mark dependent queries stale with `queryClient.invalidateQueries(...)`.

#### IPC boundary and query functions

`src/preload/index.ts:29-80` exposes typed IPC methods under `window.api`. Query/mutation functions in renderer hooks can wrap these directly, for example:

```tsx
queryFn: () => window.api.writing.getWritingAttempt({ templateId })
mutationFn: (input) => window.api.writing.saveWritingAttempt(input)
```

The renderer type declaration is already present in `src/renderer/vite-env.d.ts:5-9`:

```ts
declare global {
  interface Window {
    api: Api;
  }
}
```

`src/main/ipc/handlers.ts:50-173` shows that main-process handlers already parse inputs and outputs with shared schemas before returning IPC results. This means query functions can treat `window.api.*` return values as typed snapshots and let thrown IPC errors surface to TanStack Query error states.

### Project Spec Patterns

#### React Query hook guidance

`.trellis/spec/frontend/hooks.md:7-29` gives the project query hook pattern:

```ts
return useQuery({
  queryKey: ['example', workspaceId],
  queryFn: async () => {
    const result = await window.api.example.list({ workspaceId });
    return result;
  },
  enabled,
});
```

Key points from `.trellis/spec/frontend/hooks.md:31-38`:

| Rule | Reason |
|---|---|
| Include all dependencies in `queryKey` | Cache invalidation works correctly |
| Use `enabled` option for conditional fetching | Prevents unnecessary requests |
| Return the entire query result | Consumers can access `isLoading`, `error`, etc. |

`.trellis/spec/frontend/hooks.md:41-78` gives the project mutation pattern: `useMutation`, get a `queryClient` with `useQueryClient()`, perform the `window.api` call in `mutationFn`, and invalidate related queries in `onSuccess` using variables for targeted invalidation.

`.trellis/spec/frontend/hooks.md:81-107` shows broad invalidation for updates with `queryClient.invalidateQueries({ queryKey: ['example'] })`.

`.trellis/spec/frontend/hooks.md:244-284` documents optimistic updates with `onMutate`, `cancelQueries`, `getQueryData`, `setQueryData`, rollback in `onError`, and invalidate in `onSettled`.

#### IPC renderer constraints

`.trellis/spec/frontend/ipc-electron.md:8-19` requires renderer code to use `window.api` and not import `ipcRenderer` directly:

```tsx
// Good - Use window.api for IPC calls
const result = await window.api.auth.login({ email, password });
const session = await window.api.session.restore();

// Bad - Don't use ipcRenderer directly in renderer
import { ipcRenderer } from 'electron'; // Won't work with contextIsolation
```

`.trellis/spec/frontend/ipc-electron.md:21-31` says IPC types should be defined in a shared location and used by both main and renderer processes.

`.trellis/spec/frontend/ipc-electron.md:240-246` states the renderer owns transient editor text only, while the main process owns journal/writing identity, revision creation, content hashing, and stale-review transitions. The analogous current code uses writing attempts rather than the older journal naming in the spec.

`.trellis/spec/frontend/ipc-electron.md:311-316` identifies autosave via `window.api.journal.saveToday({ content })` as the good pattern and says renderer code must not compute hashes or import database/crypto modules. For the current codebase, the corresponding API is `window.api.writing.saveWritingAttempt({ templateId, content, userGoal })`.

### TanStack Query v5 React Patterns

#### QueryClientProvider setup

External reference: [TanStack Query React Quick Start](https://tanstack.com/query/latest/docs/framework/react/quick-start) — shows the three core concepts: create a `QueryClient`, provide it with `QueryClientProvider`, and use `useQuery` / `useMutation`.

The v5 React provider setup pattern is:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
```

For local Electron IPC, provider setup belongs in the renderer root (`src/renderer/main.tsx`) rather than preload or main process code.

#### Query key conventions

External reference: [TanStack Query Query Keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys) — query keys must be arrays at the top level; they can be simple or include variables/objects; keys are hashed deterministically; any variable used by the query function that changes should be included in the key.

Applicable query key shapes for this codebase:

| Data | Possible key shape | Query function dependency |
|---|---|---|
| Startup status | `['app', 'startupStatus']` | none |
| Settings snapshot | `['settings']` | none |
| Provider key status | `['credentials', 'providerKeyStatus']` | none or provider ID if split by provider |
| Current/default writing attempt | `['writing', 'currentAttempt']` | none |
| Writing attempt by template | `['writing', 'attempt', { templateId }]` | `templateId` |
| Review preview | `['review', 'preview', { reviewRunId }]` | `reviewRunId`; use `enabled` only when ID exists |

The object segment form (`{ templateId }`) is compatible with TanStack Query’s deterministic key hashing and keeps room for future key parameters.

#### Query functions wrapping `window.api` IPC

Query functions can be thin wrappers around `window.api`, matching project spec guidance:

```tsx
useQuery({
  queryKey: ['writing', 'attempt', { templateId }],
  queryFn: () => window.api.writing.getWritingAttempt({ templateId }),
});

useQuery({
  queryKey: ['settings'],
  queryFn: () => window.api.settings.get(),
});

useQuery({
  queryKey: ['app', 'startupStatus'],
  queryFn: () => window.api.app.getStartupStatus(),
});
```

For multiple independent initial loads, either keep separate queries and compose their loading/error states, or use one combined foundation query whose `queryFn` does the existing `Promise.all`. Separate query keys give more targeted invalidation for settings vs writing vs startup status.

#### Mutations, invalidation, and direct cache updates

External references:

- [TanStack Query Invalidations from Mutations](https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations) — when a mutation succeeds, related queries can be invalidated in `onSuccess` with `queryClient.invalidateQueries(...)`.
- [TanStack Query Updates from Mutation Responses](https://tanstack.com/query/latest/docs/framework/react/guides/updates-from-mutation-responses) — when a mutation returns the updated object, update existing query cache with `queryClient.setQueryData(...)` instead of refetching.
- [TanStack Query Optimistic Updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates) — for UI-before-server-response, use `onMutate`, cancel queries, snapshot previous data, call `setQueryData`, rollback in `onError`, and invalidate in `onSettled`.

Patterns that match current IPC return shapes:

```tsx
const queryClient = useQueryClient();

const saveWritingMutation = useMutation({
  mutationFn: window.api.writing.saveWritingAttempt,
  onSuccess: (savedWriting, variables) => {
    queryClient.setQueryData(['writing', 'attempt', { templateId: variables.templateId }], savedWriting);
    queryClient.setQueryData(['writing', 'currentAttempt'], savedWriting);
    if (savedWriting.staleReview) {
      queryClient.invalidateQueries({ queryKey: ['review'] });
    }
  },
});
```

Settings mutations return updated settings snapshots in `src/preload/index.ts:52-55`; those can write directly to `['settings']`:

```tsx
const setProviderConfigMutation = useMutation({
  mutationFn: window.api.settings.setProviderConfig,
  onSuccess: (settings) => {
    queryClient.setQueryData(['settings'], settings);
  },
});
```

Credential mutations return credential mutation results, and current code then calls `window.api.settings.get()` (`src/renderer/App.tsx:430-447`). With Query, the equivalent can invalidate `['settings']` and any credential-status key after success:

```tsx
onSuccess: (result) => {
  if (result.success) {
    queryClient.invalidateQueries({ queryKey: ['settings'] });
    queryClient.invalidateQueries({ queryKey: ['credentials'] });
  }
}
```

#### Retry/refetch defaults for local IPC

External reference: [TanStack Query Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults) — important defaults include: cached query data is stale by default; stale queries refetch automatically when new instances mount, the window refocuses, or the network reconnects; failed queries silently retry 3 times with exponential backoff before surfacing an error; inactive queries remain cached for 5 minutes by default; structural sharing is enabled by default for JSON-compatible values.

For local Electron IPC calls, the relevant default behaviors to account for are:

| Default | TanStack Query behavior | Local IPC implication |
|---|---|---|
| `retry: 3` | Failed queries retry before reporting error | Validation/configuration/local persistence errors may otherwise repeat three times before UI error. |
| `refetchOnWindowFocus: true` for stale queries | Stale queries refetch when app window regains focus | Local IPC snapshots may refetch on focus even when no remote network is involved. |
| `refetchOnReconnect: true` for stale queries | Stale queries refetch on reconnect | Less relevant to local IPC unless queries wrap network-dependent main-process actions. |
| stale by default | Data is considered stale immediately unless `staleTime` is set | Mount/focus/refetch behavior is more active unless stale time is configured. |
| `gcTime` default 5 minutes | Inactive cache retained before garbage collection | Works for switching components/templates, but not persistent storage. |

A local IPC-oriented `QueryClient` default can make these behaviors explicit:

```tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: Infinity,
    },
    mutations: {
      retry: false,
    },
  },
});
```

Alternative per-query overrides remain available for IPC calls that are intentionally network-backed through the main process, such as AI review/start or starter prompt generation.

#### Debounced autosave mutation pattern

The current autosave is a debounced effect over local editor `content` plus `userGoal` (`src/renderer/App.tsx:192-203`). With Query, keep transient editor text as local React state and use a `useMutation` for the persistence operation. The debouncing still belongs around `mutation.mutate(...)`, not inside the `queryFn`.

A shape that preserves the current 900 ms behavior:

```tsx
const autosaveMutation = useMutation({
  mutationFn: window.api.writing.saveWritingAttempt,
  onSuccess: (savedWriting, variables) => {
    lastSavedContentRef.current = savedWriting.activeRevision?.content ?? variables.content;
    queryClient.setQueryData(['writing', 'attempt', { templateId: variables.templateId }], savedWriting);
    queryClient.setQueryData(['writing', 'currentAttempt'], savedWriting);
    if (savedWriting.staleReview) {
      queryClient.invalidateQueries({ queryKey: ['review'] });
    }
  },
});

useEffect(() => {
  if (content === lastSavedContentRef.current) {
    return;
  }

  const timeoutId = window.setTimeout(() => {
    autosaveMutation.mutate({ templateId: selectedTemplateId, content, userGoal });
  }, AUTOSAVE_DELAY_MS);

  return () => window.clearTimeout(timeoutId);
}, [autosaveMutation, content, selectedTemplateId, userGoal]);
```

For autosave status UI, TanStack Query exposes mutation status fields (`isPending`, `isError`, `error`, `isSuccess`, `submittedAt`, variables). If the app needs a stable “saved” status and last saved content comparison, the current `lastSavedContentRef` pattern remains useful alongside the mutation cache.

For overlapping autosaves, v5 mutation state can identify pending variables, but mutation responses may arrive out of order if multiple saves are in flight. The current debounce clears only not-yet-fired timers; it does not cancel an already-started IPC save. If autosave ordering matters, code paths should account for submitted content/template when applying returned snapshots.

### Related Specs

| Spec | Description |
|---|---|
| `.trellis/spec/frontend/hooks.md` | React Query hook and mutation guidance, including invalidation and optimistic updates. |
| `.trellis/spec/frontend/ipc-electron.md` | Renderer IPC boundary rules and autosave contract principles. |
| `.trellis/spec/frontend/index.md` | Frontend overview listing React Query as optional state tooling and IPC as a must-read pattern. |
| `.trellis/spec/backend/api-module.md` | Backend guidance that IPC handlers are thin wrappers around procedures. |
| `.trellis/spec/big-question/ipc-handler-registration.md` | IPC registration checklist for when new handlers are added or calls fail. |

### External References

- [TanStack Query React Quick Start](https://tanstack.com/query/latest/docs/framework/react/quick-start) — `QueryClient`, `QueryClientProvider`, `useQuery`, and `useMutation` root concepts for React.
- [TanStack Query Query Keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys) — array query keys, deterministic hashing, and including query-function variables in keys.
- [TanStack Query Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults) — default stale behavior, focus/reconnect refetches, retry count, cache garbage collection, and structural sharing.
- [TanStack Query Invalidations from Mutations](https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations) — invalidating related queries in mutation success callbacks.
- [TanStack Query Updates from Mutation Responses](https://tanstack.com/query/latest/docs/framework/react/guides/updates-from-mutation-responses) — using returned mutation data with `setQueryData` instead of refetching.
- [TanStack Query Optimistic Updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates) — optimistic cache update and rollback pattern.
- [TanStack Query Disabling/Pausing Queries](https://tanstack.com/query/latest/docs/framework/react/guides/disabling-queries) — using `enabled` for conditional queries such as review preview by `reviewRunId`.

## Caveats / Not Found

- `@tanstack/react-query` is not currently present in `package.json`; this research did not modify dependencies.
- No existing `QueryClient`, `QueryClientProvider`, `useQuery`, or `useMutation` usage was found in the codebase outside documentation specs.
- The active Trellis task command returned no current task, but the user provided the exact research output path; the research directory was created there.
- External docs were fetched from the public TanStack site; no Context7 tool was available in this tool environment despite the MCP reminder.
