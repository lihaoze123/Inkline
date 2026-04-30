# Introduce TanStack Query

## Goal

Introduce TanStack Query in the renderer to replace the highest-churn hand-written async/server-state handling with a mature query/mutation/cache layer, starting from a small but useful migration slice rather than a broad rewrite.

## What I already know

* The user wants to introduce TanStack Query after identifying renderer async/server-state management as the most obvious wheel reinvention.
* `package.json` does not currently include `@tanstack/react-query`.
* `src/renderer/App.tsx` currently hand-rolls initial loading/error state, writing attempt state, autosave mutation state, review mutation state, settings mutation state, and stale review cleanup.
* The app uses Electron IPC through `window.api`, so query functions will wrap local async IPC calls rather than HTTP fetches.
* Existing quality scripts are `pnpm lint`, `pnpm typecheck`, and `pnpm test`.

## Assumptions (temporary)

* We should avoid a large feature rewrite and preserve the current UI/UX behavior.
* TanStack Query should manage remote/server-state from IPC, while local draft input state can remain local React state.
* Local IPC errors should surface directly; retries and window-focus refetching should likely be conservative or disabled by default.

## Open Questions

* Confirm the exact Phase 1 implementation boundary.

## Requirements (evolving)

* Add TanStack Query to the renderer app.
* Configure a `QueryClientProvider` near the renderer root.
* Define stable query keys for migrated IPC resources.
* Use a phased migration path that can eventually fully replace hand-written async/server-state handling in `App.tsx`.
* Phase 1 should establish the architecture and migrate a useful vertical slice, without attempting a broad rewrite in one diff.
* Preserve current behavior for writing practice, review, and settings unless explicitly included in the current phase.

## Acceptance Criteria

* [x] `@tanstack/react-query` is installed and used in renderer code.
* [x] The app is wrapped in `QueryClientProvider` with defaults appropriate for local IPC.
* [x] Migrated queries use stable query keys rather than ad hoc effects.
* [x] Migrated mutations update or invalidate the relevant cache.
* [x] Phase boundaries for the remaining migration are recorded in the PRD.
* [x] Current user-visible behavior remains equivalent for the migrated slice.
* [x] `pnpm lint`, `pnpm typecheck`, and relevant tests pass.

## Definition of Done (team quality bar)

* Tests added/updated where appropriate.
* Lint / typecheck / test scripts are green.
* Behavior changes are documented in the task PRD or journal if needed.
* Rollback is straightforward: the migration is scoped and avoids unrelated rewrites.

## Out of Scope (explicit)

* Replacing Electron IPC itself with tRPC/electron-trpc.
* Rewriting all forms with React Hook Form.
* Reworking the review progress event stream into a state machine.
* Changing AI provider behavior or review contract behavior.

## Research References

* [`research/tanstack-query-react-patterns.md`](research/tanstack-query-react-patterns.md) — TanStack Query v5 patterns for React renderer apps using local Electron IPC async functions.

## Technical Notes

* Implemented Phase 1 in `src/renderer/main.tsx`, `src/renderer/query/*`, and `src/renderer/App.tsx`.
* Added `test/renderer-query.test.ts` to lock the local IPC QueryClient defaults and stable foundation query keys.
* `pnpm typecheck`, `pnpm lint`, and `pnpm test` pass; `pnpm dev` launched Vite/Electron successfully.
* TanStack Query v5 docs recommend `QueryClientProvider`, object-form `useQuery`, `useMutation`, and invalidating related query keys after successful mutations.
* For local IPC, recommended defaults are likely `retry: false` and `refetchOnWindowFocus: false`, because failures are local/application errors rather than transient network failures.
* Query keys should be colocated or centralized, e.g. `['writing', 'attempt', templateId]`, `['settings']`, `['startup-status']`, `['review', 'preview', reviewRunId]`.
* Current hotspots:
  * `src/renderer/App.tsx:34-64` initial foundation load effect.
  * `src/renderer/App.tsx:96-130` broad local state ownership.
  * `src/renderer/App.tsx:172-203` autosave state/effect.
  * `src/renderer/App.tsx:205+` review start/preview refresh flow.
  * `src/renderer/App.tsx:377+` settings/provider mutation flow.

## Migration Direction

The user chose a phased migration that should eventually fully move async/server-state handling to TanStack Query.

### Phase 1: Foundation + writing autosave vertical slice (current task, recommended)

* Add dependency, `QueryClientProvider`, query key helpers, and migrate initial foundation load (`writing`, `settings`, `startup`) to TanStack Query.
* Migrate current writing attempt query and autosave mutation to TanStack Query.
* Keep draft `content`/`userGoal` as local UI state, but let successful saves update writing cache and invalidate stale review state where needed.
* Preserve existing debounce timing and saved/error status behavior.

### Phase 2: Review data flow

* Migrate template switching and review preview fetching to query-key-driven data flow.
* Convert review start/save/rewrite mutations to `useMutation` where feasible.
* Keep progress event stream local unless/until it becomes a formal task lifecycle model.

### Phase 3: Settings/provider mutations

* Migrate settings/provider config/API key mutations to `useMutation`.
* Invalidate or update the settings cache after successful mutations.
* Optionally pair with a future React Hook Form migration.

### Phase 4: Cleanup

* Remove obsolete manual loading/error/mutation state from `App.tsx`.
* Split query/mutation hooks into renderer feature modules if `App.tsx` remains too large.

## Expansion Sweep

### Future evolution

* Query keys can become the contract for later IPC router/tRPC migration.
* Mutations can later support optimistic updates or more granular invalidation if review/settings flows grow.

### Related scenarios

* Template switching should eventually be a query-key change rather than manual state reset.
* Review preview freshness should eventually derive from cached writing/review data rather than scattered manual resets.

### Failure & edge cases

* Autosave failures must keep user text in the editor and expose the same error/saved status semantics.
* Local IPC queries should not repeatedly retry failures that require user configuration, such as missing API keys.
