# Rewrite-check contract and persistence

## Goal

Create the stable persistence and shared contract baseline for rewrite-check so backend evaluator and renderer feedback work can proceed in separate worktrees without repeatedly changing the same schemas.

## Dependency / Worktree Plan

- This is the baseline task and should land before the evaluator-service and feedback-UI tasks branch for implementation.
- Suggested branch/worktree name: `rewrite-check-contract-persistence`.
- After this lands, create backend and frontend worktrees from the baseline commit, not from the pre-contract `main`.

## Requirements

- Add a durable `rewrite_checks` store linked to `rewrite_tasks`.
- Represent each evaluation attempt as its own record rather than overwriting the rewrite task.
- Support attempt status values for at least pending/in-progress, completed, and failed/retryable evaluation states.
- Support outcome values `correct`, `partly_correct`, and `incorrect` only for completed checks.
- Store concise feedback and enough diagnostics metadata for retry/debugging, including provider/model and validation/error details where appropriate.
- Add shared writing contracts for latest rewrite-check snapshots, check outcomes, check status, completion result payloads, and retry input/result payloads.
- Extend IPC/channel/preload-facing contracts only enough to let later worktrees compile against the same shape.
- Keep existing rewrite completion behavior functionally unchanged in this baseline except for exposing nullable/latest check fields when available.

## Acceptance Criteria

- [ ] `rewrite_checks` exists in Drizzle schema and SQL migrations, with migration journal updates.
- [ ] `rewrite_checks` records are linked to `rewrite_tasks` with appropriate referential integrity.
- [ ] Shared Zod/type contracts expose rewrite-check status, outcome, feedback, latest-check snapshot, and retry shapes.
- [ ] Existing rewrite-practice completion and skip tests still pass without requiring an evaluator.
- [ ] Contract/schema tests cover valid and invalid check states, including outcome only being meaningful on completed checks.
- [ ] `pnpm check` passes, or any remaining failure is documented as unrelated.

## Definition of Done

- Tests added/updated for schema and shared contracts.
- Lint/typecheck/quality gate run.
- No evaluator prompt, model call, or UI result rendering is implemented in this task.

## Technical Approach

- Prefer `src/shared/types/writing.ts` for app-facing rewrite-check contracts.
- Prefer `src/main/db/schema.ts` plus a new Drizzle migration for persistence.
- Keep `rewrite_tasks.status` semantics focused on task lifecycle; use `rewrite_checks.status/outcome` for learning evaluation state.
- Do not introduce a separate model setting for rewrite-check in this baseline.

## Out of Scope

- Calling an AI provider.
- Implementing retry behavior beyond shared contracts/channel shape.
- Rendering checking/result/failure UI.
- Mastery, successful reuse, D+3/D+7 spaced tasks, lifecycle polish, or pattern de-duplication.

## Technical Notes

- Current rewrite completion lives in `src/main/services/writing/service.ts`.
- Current shared rewrite contracts live in `src/shared/types/writing.ts`.
- Current IPC channel constants live in `src/shared/constants/channels.ts`.
- Current database schema lives in `src/main/db/schema.ts`; migration tests are sensitive to Drizzle journal updates.
