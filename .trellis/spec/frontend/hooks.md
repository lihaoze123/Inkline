# Hook Guidelines

> Patterns for React Query hooks (queries and mutations).

---

## Query Hook Pattern

Use this pattern for data fetching hooks:

```typescript
import { useQuery } from '@tanstack/react-query';

interface UseExampleOptions {
  workspaceId: string;
  enabled?: boolean;
}

export function useExample({ workspaceId, enabled = true }: UseExampleOptions) {
  return useQuery({
    queryKey: ['example', workspaceId],
    queryFn: async () => {
      const result = await window.api.example.list({ workspaceId });
      return result;
    },
    enabled,
  });
}
```

### Key Points

| Rule                                          | Reason                                          |
| --------------------------------------------- | ----------------------------------------------- |
| Include all dependencies in `queryKey`        | Cache invalidation works correctly              |
| Use `enabled` option for conditional fetching | Prevents unnecessary requests                   |
| Return the entire query result                | Consumers can access `isLoading`, `error`, etc. |

---

## Mutation Hook Pattern

Use this pattern for data modification hooks:

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface CreateExampleInput {
  workspaceId: string;
  title: string;
}

export function useCreateExample() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateExampleInput) => {
      const result = await window.api.example.create(data);
      return result;
    },
    onSuccess: (_, variables) => {
      // Invalidate related queries to refetch
      queryClient.invalidateQueries({
        queryKey: ['example', variables.workspaceId],
      });
    },
  });
}
```

### Key Points

| Rule                              | Reason                                           |
| --------------------------------- | ------------------------------------------------ |
| Invalidate queries in `onSuccess` | UI reflects the latest data                      |
| Access `variables` in callbacks   | Use input data for targeted invalidation         |
| Return the entire mutation result | Consumers can access `mutate`, `isPending`, etc. |

---

## Update Mutation Pattern

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface UpdateExampleInput {
  id: string;
  title?: string;
  description?: string;
}

export function useUpdateExample() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateExampleInput) => {
      const result = await window.api.example.update(data);
      return result;
    },
    onSuccess: () => {
      // Invalidate all example queries
      queryClient.invalidateQueries({
        queryKey: ['example'],
      });
    },
  });
}
```

---

## Delete Mutation Pattern

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface DeleteExampleInput {
  id: string;
  workspaceId: string;
}

export function useDeleteExample() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: DeleteExampleInput) => {
      const result = await window.api.example.delete({ id: data.id });
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['example', variables.workspaceId],
      });
    },
  });
}
```

---

## Scenario: Electron IPC Query Cache Contract

### 1. Scope / Trigger

- Trigger: Any renderer task that fetches or mutates persisted/application-owned data through `window.api` and needs loading, error, cache, stale, refetch, or mutation lifecycle handling.
- Use TanStack Query for IPC-backed remote/server-state. Keep transient UI state such as editor drafts, form inputs, dialog visibility, self-repair text, and reveal toggles in React component state.
- Do not use this pattern for push-only IPC event streams unless they also have a queryable snapshot. Event streams may stay as `useEffect` subscriptions and update/invalidate query cache when appropriate.

### 2. Signatures

Renderer query client:

```typescript
export function createRendererQueryClient(): QueryClient;
```

Central query keys:

```typescript
export const queryKeys = {
  app: {
    startupStatus: ['app', 'startup-status'] as const,
  },
  settings: {
    snapshot: ['settings'] as const,
  },
  writing: {
    attempts: ['writing', 'attempt'] as const,
    attempt: (templateId: WritingTemplateId) => ['writing', 'attempt', templateId] as const,
  },
  review: {
    run: (reviewRunId: string) => ['review', 'run', reviewRunId] as const,
    preview: (reviewRunId: string) => ['review', 'preview', reviewRunId] as const,
  },
} as const;
```

Query hook shape:

```typescript
export function useWritingAttempt(options: {
  templateId: WritingTemplateId;
  initialData?: WritingAttemptSnapshot;
}): UseQueryResult<WritingAttemptSnapshot>;
```

Mutation hook shape:

```typescript
export function useSaveWritingAttempt(): UseMutationResult<
  SaveWritingAttemptResult,
  Error,
  SaveWritingAttemptInput
>;

export function useStartReview(): UseMutationResult<
  StartReviewOutput,
  Error,
  StartReviewInput & { templateId: WritingTemplateId }
>;

export function useSettingsSnapshot(initialData?: SettingsSnapshot): UseQueryResult<SettingsSnapshot>;
export function useSetProviderConfig(): UseMutationResult<SettingsSnapshot, Error, SetProviderConfigInput>;
```

### 3. Contracts

- `QueryClientProvider` must wrap the renderer app before any component calls `useQuery`, `useMutation`, or `useQueryClient`.
- Query functions call the typed preload API only, e.g. `window.api.writing.getWritingAttempt({ templateId })`. Renderer query hooks must not import Electron, Node APIs, database modules, or main-process services.
- Query keys must include every input that changes returned data. For example, writing attempt data is keyed by `templateId`, while review preview data is keyed by `reviewRunId`.
- Settings are a singleton snapshot keyed by `queryKeys.settings.snapshot`; successful settings/config mutations should update that cache when they return a fresh snapshot, and credential mutations should invalidate it when the snapshot must be refetched.
- Template-scoped writing snapshots may also contain app-global derived fields such as `pendingRewritePractice`. Mutations that complete or skip rewrite practice must update that field across all cached `queryKeys.writing.attempts` entries, not only the template associated with the returned writing snapshot.
- Local IPC query defaults should be conservative:
  - `retry: false`
  - `refetchOnWindowFocus: false`
  - short `staleTime` is allowed to avoid duplicate IPC calls during initial mount/refetch churn.
- Successful mutations must update the relevant cache with `setQueryData` when the response contains the fresh snapshot, or call `invalidateQueries` when the mutation changes data that needs a refetch.
- Autosave mutations update cache after persistence succeeds, but editor draft text remains local state so failed saves do not erase unsaved user input.

### 4. Validation & Error Matrix

| Condition | Behavior |
| --- | --- |
| Foundation IPC query is pending | Show initial loading UI only until first data is available. |
| Foundation IPC query throws | Surface the error message in the app-level error UI. |
| Local IPC query fails because configuration is missing | Do not retry repeatedly; show the returned error/configuration state. |
| Mutation succeeds and returns a fresh snapshot | `setQueryData(queryKeys.<domain>..., snapshot)` updates the cache. |
| Mutation succeeds but affects related data not returned in response | `invalidateQueries({ queryKey })` refetches the affected cache entries. |
| Review start emits progress events while also returning snapshots | Keep progress events in local React state; cache the final run/preview snapshots by `reviewRunId`. |
| Provider credential mutation succeeds but does not return a full settings snapshot | Invalidate `queryKeys.settings.snapshot` so credential status refetches. |
| Rewrite-practice completion/skip returns a writing snapshot for a different template than the active editor | Update `pendingRewritePractice` across all cached writing attempts using the `queryKeys.writing.attempts` prefix. |
| Autosave mutation fails | Keep local draft state unchanged and show autosave error state. |
| Query key omits an input such as `templateId` or `reviewRunId` | This is invalid because cache entries can bleed across templates/entities/runs. |

### 5. Good/Base/Bad Cases

- Good: `useWritingAttempt({ templateId })` calls `window.api.writing.getWritingAttempt({ templateId })`, keys by `['writing', 'attempt', templateId]`, and autosave writes the returned snapshot into that same cache key.
- Good: `completeRewritePractice` writes the returned template snapshot to its specific key and propagates the returned global `pendingRewritePractice` value to every cached `['writing', 'attempt', *]` entry.
- Good: settings/provider mutations that return `SettingsSnapshot` update `queryKeys.settings.snapshot`; credential-only mutations invalidate that singleton settings key.
- Base: A review-start mutation invalidates the active writing-attempt query after review state changes because the mutation flow does not directly own every derived field, while the progress event stream remains local state.
- Bad: A component stores IPC snapshots in `useState` and manually tracks loading/error/saved state when a query/mutation hook would provide the same lifecycle.
- Bad: A query key like `['writing', 'attempt']` is reused for Journal, CET-4, CET-6, and Free Writing.
- Bad: Completing a due rewrite task only updates the returned task's template cache, leaving the active template's Progress summary stuck on `Waiting`.
- Bad: An autosave failure replaces the editor's local draft with stale cached content.

### 6. Tests Required

- Query client configuration test:
  - Assert local IPC defaults disable query retry and window-focus refetch.
  - Assert any chosen `staleTime` is intentional and stable.
- Query key contract test:
  - Assert entity-specific keys include all identity inputs such as `templateId`.
- Mutation cache update test where practical:
  - Assert a successful mutation writes the returned snapshot to the expected query key or invalidates the expected key.
  - Assert rewrite-practice complete/skip updates `pendingRewritePractice` across multiple cached writing-attempt keys.
- Manual Electron smoke:
  - Launch the app through Electron, not only browser Vite, and verify initial load plus the changed query/mutation path.

### 7. Wrong vs Correct

#### Wrong

```tsx
const [writing, setWriting] = useState<WritingAttemptSnapshot | null>(null);
const [isLoading, setIsLoading] = useState(true);

useEffect(() => {
  let cancelled = false;

  async function loadWriting(): Promise<void> {
    setIsLoading(true);
    const nextWriting = await window.api.writing.getWritingAttempt({ templateId });
    if (!cancelled) {
      setWriting(nextWriting);
      setIsLoading(false);
    }
  }

  void loadWriting();
  return () => {
    cancelled = true;
  };
}, [templateId]);
```

Manual IPC state repeats query lifecycle logic and is easy to make stale or inconsistent.

#### Correct

```tsx
export function useWritingAttempt({ templateId }: { templateId: WritingTemplateId }) {
  return useQuery({
    queryKey: queryKeys.writing.attempt(templateId),
    queryFn: () => window.api.writing.getWritingAttempt({ templateId }),
  });
}
```

The query key owns cache identity, TanStack Query owns loading/error/refetch state, and component state can stay focused on transient UI input.

---

## Custom Hook with IPC (Non-React-Query)

For simpler cases or when React Query is not used:

```typescript
import { useState, useEffect, useCallback } from 'react';

interface UseDataOptions {
  workspaceId: string;
}

interface DataItem {
  id: string;
  title: string;
}

export function useData({ workspaceId }: UseDataOptions) {
  const [data, setData] = useState<DataItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await window.api.data.list({ workspaceId });
      setData(result.items);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  // Initial fetch
  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
  };
}
```

### With Data Refresh Subscription

See [ipc-electron.md](./ipc-electron.md) for the complete pattern:

```typescript
export function useData({ workspaceId }: UseDataOptions) {
  // ... state and fetchData ...

  const { onDataRefresh } = useDataRefresh();

  // Initial fetch
  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // CRITICAL: Subscribe to data refresh events
  useEffect(() => {
    const unsubscribe = onDataRefresh(() => {
      void fetchData();
    });
    return unsubscribe;
  }, [onDataRefresh, fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}
```

---

## Hook Organization

```
modules/
├── example/
│   ├── hooks/
│   │   ├── index.ts          # Re-exports all hooks
│   │   ├── useExample.ts     # Query hook
│   │   ├── useCreateExample.ts
│   │   ├── useUpdateExample.ts
│   │   └── useDeleteExample.ts
│   └── ...
```

**Re-export pattern**:

```typescript
// modules/example/hooks/index.ts
export { useExample } from './useExample';
export { useCreateExample } from './useCreateExample';
export { useUpdateExample } from './useUpdateExample';
export { useDeleteExample } from './useDeleteExample';
```

---

## Optimistic Updates (Advanced)

For better UX, update the UI immediately before the server responds:

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useUpdateExample() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateExampleInput) => {
      return await window.api.example.update(data);
    },
    onMutate: async (newData) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['example'] });

      // Snapshot previous value
      const previousData = queryClient.getQueryData(['example']);

      // Optimistically update
      queryClient.setQueryData(['example'], (old: DataItem[]) =>
        old.map((item) => (item.id === newData.id ? { ...item, ...newData } : item))
      );

      // Return context with previous data
      return { previousData };
    },
    onError: (err, newData, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(['example'], context.previousData);
      }
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['example'] });
    },
  });
}
```

---

## Hook Naming Conventions

| Pattern             | Usage                                    |
| ------------------- | ---------------------------------------- |
| `use{Entity}`       | Query hook for fetching entity           |
| `use{Entity}List`   | Query hook for fetching list of entities |
| `useCreate{Entity}` | Mutation hook for creating               |
| `useUpdate{Entity}` | Mutation hook for updating               |
| `useDelete{Entity}` | Mutation hook for deleting               |
| `use{Feature}`      | Custom hook for specific feature logic   |

---

**Language**: All documentation must be written in **English**.
