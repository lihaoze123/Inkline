# Technical Notes

## Current Rewrite-Practice Shape

- `src/main/db/schema.ts` already has `rewrite_tasks` with `kind`, `spaced_stage`, `status`, `user_rewrite_text`, `due_at`, `completed_at`, and `skipped_at`.
- `rewrite_tasks.status` already includes `pending`, `in_progress`, `completed`, `skipped`, `snoozed`, and `expired`, but current service behavior only completes and skips.
- `src/main/services/writing/service.ts` `completeRewritePractice` validates non-empty user text, then marks the task `completed` and stores `userRewriteText`.
- Current completion does not call an AI evaluator and does not persist correctness, feedback, confidence, or reuse outcome.
- `src/shared/types/writing.ts` exposes rewrite practice snapshots but has no rewrite-check result shape yet.
- The first rewrite-check implementation will likely touch shared types, schema/migration, main-process AI service flow, IPC/service result shape, renderer mutation handling, and rewrite-practice UI.

## Planning Implication

The first implementation milestone should create a durable rewrite-check signal before building mastery, D+3/D+7 spaced reuse, or advanced task lifecycle behavior. Otherwise later learning metrics would have to infer success from mere completion.

## Selected Milestone Shape

- First milestone scope is evaluator plus persisted feedback UI.
- A durable rewrite-check result should include at least an outcome (`correct`, `partly_correct`, `incorrect`) and concise feedback.
- The result must be stored with the rewrite task or in a directly related table so future Progress/mastery/spaced-reuse work can query it without reparsing provider output.
- The existing submit path should still save the user's rewrite text.
- If evaluation fails after submission, the saved user rewrite should remain durable, should not count as successful learning, and should expose a retryable evaluation state.
- Store rewrite-check attempts in a separate `rewrite_checks` table.
- Suggested `rewrite_checks` fields: `id`, `rewrite_task_id`, `status`, `outcome`, `feedback`, `provider`, `model`, `raw_output_json` or validated-output trace according to privacy settings, `validation_errors_json`, `created_at`, and `completed_at`.
- `rewrite_tasks` may keep a latest-check reference or derived status if query ergonomics require it, but historical attempts should live in `rewrite_checks`.
- If the latest successful check outcome is `incorrect`, the D+1 rewrite task should be completed but the learning outcome should remain unsuccessful.
- First milestone should not require repeated rewriting until correct and should not auto-create retry tasks.
- If the latest successful check outcome is `partly_correct`, the UI can acknowledge progress, but future mastery/spaced-reuse logic should not treat it as successful reuse.
- Only `correct` is the strong success signal for mastery progression.
- First version should run rewrite-check synchronously during submit: save the rewrite, show checking, call evaluator, then show the persisted result or retryable failure.
- Do not add background workers, polling, or manual-only check flow in the first milestone.

## Suggested First Milestone Work Breakdown

1. Schema and shared contract:
   - Add `rewrite_checks`.
   - Add shared result schemas/types for status, outcome, feedback, and latest-check snapshot.
   - Add migration tests.
2. Main-process evaluator:
   - Reuse provider configuration and validation patterns from review generation.
   - Save user rewrite before model evaluation.
   - Persist check attempt status, result, validation errors, and provider/model metadata.
   - Return retryable failure when configuration/network/model validation fails.
3. IPC and renderer:
   - Extend rewrite-practice submit result to include latest check.
   - Render checking, checked, partly-correct, incorrect, and retryable failure states.
   - Keep corrections as annotations only; never auto-rewrite the user's text.

## Parallel Worktree Split

- `05-02-rewrite-check-contract-persistence`: first baseline branch. Owns schema, migration, shared writing contracts, channel/API shape, and contract tests. It should avoid evaluator and renderer behavior beyond nullable/latest-check exposure.
- `05-02-rewrite-check-evaluator-service`: backend branch from the baseline. Owns AI evaluator prompt/service, submit-time check attempt persistence, failure diagnostics, retry endpoint, and service/IPC tests.
- `05-02-rewrite-check-feedback-ui`: frontend branch from the baseline. Owns React Query mutation state, App/LearningPanel props, checking/result/retry UI, and renderer tests with mocked API responses.
- `05-02-rewrite-check-integration-hardening`: final convergence branch. Owns merge conflict resolution, shared contract drift fixes, full quality gates, and manual smoke verification.

Expected conflict hotspots: `src/shared/types/writing.ts`, `src/shared/constants/channels.ts`, `src/preload/index.ts`, `src/main/services/writing/service.ts`, `src/renderer/App.tsx`, and `src/renderer/components/LearningPanel.tsx`.

## Long-Term Architecture Implications

- A future learning event log is likely useful before advanced analytics, mastery transitions, Drill Center, or Anki Sync. It would prevent later features from inferring user progress from scattered task/status fields.
- Pattern merge/de-dup and apply-correction revisions are data-integrity work, not merely UI polish. They should happen before heavy dashboarding or external sync.
- External integrations should consume stable learning assets, not raw review output. Anki/Markdown export should wait until rewrite-check and mastery semantics are stable.
- Long-term product positioning is "personal writing learning system, biased toward scenario/exam practice." This means CET/scenario tracks should be metadata, prompt/review policy, and UI organization over the same writing/review/rewrite/check engine, not separate one-off flows.
- Avoid building a parallel CET engine unless later PRDs explicitly require mock-exam timing, scoring, or official-rubric simulation.
- First-class tracks should likely be represented as track/template metadata plus prompt/review/rewrite policy, not separate tables that fork the core attempt/review/rewrite flow.
- Track-specific progress should aggregate from shared learning events and pattern outcomes so the same pattern can appear across Journal, CET, and scenario practice.
