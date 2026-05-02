# brainstorm: project roadmap

## Goal

Define Inkline's next product roadmap from the current v0.1/v0.2 state so future implementation tasks can be split intentionally instead of pulling backlog items into ad hoc feature work.

## What I Already Know

- The app is currently documented as a v0.1 desktop app in active development.
- Inkline is a local-first Electron app for repeatable English writing practice: choose a template, write independently, request focused review, self-repair one issue, compare against a reference rewrite, save learning history, and return for D+1 rewrite practice.
- The current README says Journal, CET-4 Writing, CET-6 Writing, and Free Writing are equal practice templates, not separate product identities.
- Current implemented surfaces include Today, Practice, Feedback and Rewrite, Notebook, Progress, and Settings.
- Current AI integration supports OpenAI-compatible endpoints and Anthropic Claude through main-process provider calls.
- The product spec says v0.2 should validate whether users learn from recurring patterns and reuse them in new contexts.
- A recent completed task implemented the first learning-assets slice: persistent error patterns, persisted upgrade opportunities, Notebook history, and Progress history.
- Remaining v0.2 work includes pattern mastery status, successful reuse tracking, pattern merge/de-dup flow, rewrite-check agent, rewrite skip/snooze/expire, D+3/D+7 spaced reuse tasks, and apply-correction through revisions.
- Backlog after v0.2 currently includes Drill Center, Anki Sync, import/export jobs, and learning events for practice analytics.
- The existing active backlog task `.trellis/tasks/04-29-v0-2-learning-assets-backlog/prd.md` exists to preserve v0.2 scope without requiring immediate implementation.

## Assumptions

- The roadmap should prioritize product learning and user value, not only technical completeness.
- v0.1 should not be reframed as fully finished until the review loop is validated as useful and repeatable.
- v0.2 should be split into smaller milestones rather than treated as one large implementation task.
- Distribution/release hardening may need to compete with learning-feature depth, because a local desktop app only creates product signal if it is easy to install and run.

## Open Questions

- None. Awaiting final user confirmation of the roadmap and first implementation milestone.

## Requirements (Evolving)

- Produce a roadmap that separates immediate next work, v0.2 completion work, and later backlog.
- Preserve the boundary between implemented behavior and future plans.
- Identify dependencies between roadmap items, especially cross-layer features such as rewrite-check, spaced reuse, and apply-correction revisions.
- Avoid treating Anki, Drill Center, CET scoring, or import/export as default near-term scope unless explicitly prioritized.
- Optimize the next roadmap stage for learning depth by completing the loop from saved review to rewrite-check to reuse/mastery signals.
- Make rewrite-check the first implementation milestone under the learning-loop roadmap.
- Scope the first rewrite-check milestone as evaluator plus persisted feedback UI.
- If rewrite-check fails after the user submits a rewrite, save the user's rewrite text, do not count it as successful learning, and expose a retryable evaluation state.
- Store rewrite-check attempts in a separate `rewrite_checks` table rather than only inline on `rewrite_tasks`.
- If rewrite-check returns `incorrect`, mark the D+1 rewrite task completed but record an unsuccessful learning outcome.
- Treat `partly_correct` as intermediate progress: encouraging UI feedback, but not mastery success or successful reuse.
- Run rewrite-check synchronously during the submit interaction for the first version: save the user's rewrite, show a checking state, then render the persisted check result or retryable failure.
- Long-term north star is a personal writing learning system that leans toward exam/scenario practice: the durable pattern-learning loop is the engine, while CET/scenario tracks are first-class user-facing practice paths.
- CET/scenario should become first-class tracks over the shared writing/review/rewrite/check engine, not separate exam-mode flows.

## Acceptance Criteria (Evolving)

- [x] Roadmap has a clear recommended next milestone.
- [x] Roadmap separates product validation work from implementation backlog.
- [x] Roadmap splits v0.2 into implementable task-sized units.
- [x] Out-of-scope items are explicit for the next milestone.
- [x] The user confirms the roadmap direction before implementation tasks are created.
- [x] Confirmed roadmap is recorded in `.trellis/spec/product/roadmap.md`.
- [x] First rewrite-check milestone is decomposed into worktree-friendly child tasks.

## Definition of Done

- Roadmap decisions are captured in this PRD.
- Any technical design notes are captured in `info.md` if needed.
- If this planning task leads to implementation, `implement.jsonl` and `check.jsonl` are curated with the relevant specs before dispatching implement/check agents.
- No code changes are required for this roadmap brainstorm unless the user explicitly asks to implement a selected item.

## Roadmap Draft

### Immediate Next Milestone Options

**Option A: Finish the Learning Loop** (recommended if product value is the priority)

- Add rewrite-check for the user's D+1 rewrite.
- Add successful reuse tracking and pattern mastery status.
- Add D+3/D+7 spaced reuse after a successful or partially successful rewrite.
- Add skip, snooze, and expire behavior for rewrite tasks.
- Defer Anki, Drill Center, full CET scoring, and apply-correction.

**Option B: Release-Ready v0.1/v0.2 App** (recommended if external testing is the priority)

- Focus on packaging reliability, install/run documentation, smoke tests, crash/error diagnostics, and a small external tester workflow.
- Keep learning features mostly as-is while collecting product signal.
- Defer deeper v0.2 learning mechanics until the app can be tested reliably outside the dev environment.

**Option C: Broaden Practice Scenarios** (recommended only if template coverage is the priority)

- Improve Journal/CET/Free Writing prompt assets, template-specific review instructions, and scenario entry UX.
- Keep review caps and learning history behavior stable.
- Defer rewrite-check, mastery, D+3/D+7, Anki, and Drill Center.

## Decision (ADR-lite)

**Context**: The project already has the v0.1 writing/review/save flow and the first persistent learning-assets slice. The main remaining product uncertainty is whether those saved learning assets turn into real practice and reuse, not whether the app can store them.

**Decision**: Prioritize **Option A: Finish the Learning Loop** as the next roadmap axis.

**Consequences**: The next roadmap work should focus on rewrite-check, successful reuse tracking, pattern mastery, spaced reuse, and rewrite task lifecycle states. Release hardening and broader practice-scenario polish remain important, but they should not displace the next learning-loop milestone unless external testing becomes the immediate goal.

## First Implementation Milestone

### Milestone 1: Rewrite-Check First

**Decision**: The first implementation milestone should add rewrite-check before task lifecycle polish or mastery UI.

**Why**: Rewrite-check creates the missing learning signal. Without it, mastery and spaced reuse would be inferred from task completion alone, which is too weak: submitting any rewrite would look like progress even if the original error pattern was not repaired.

**Recommended scope**:

- Evaluate the user's submitted D+1 rewrite against the original sentence, focus pattern, native model sentence, and review context.
- Return a small structured result such as `correct`, `partly_correct`, or `incorrect`, plus concise feedback.
- Persist the rewrite-check result with the rewrite task so later Progress/mastery/spaced-reuse work has a durable signal.
- Show the result in the existing rewrite-practice UI after submit.
- Keep the evaluator annotation-only: it must not replace the user's rewrite or auto-apply corrections.

**Selected first-version scope**: Evaluator plus persisted feedback UI. This milestone should call an evaluator, store the outcome and concise feedback, and render that result after submit. It should not stop at transient in-memory evaluation, because later mastery and spaced-reuse work need durable signals.

**Evaluation failure behavior**: If provider configuration, network, timeout, or invalid model output prevents evaluation, the app should still preserve the user's submitted rewrite text. The task should enter a retryable evaluation-failed or evaluation-pending state rather than being treated as a successful completed learning event. The UI should communicate that the rewrite was saved but could not be checked yet, and should allow retrying the check.

**Persistence decision**: Store rewrite-check attempts in a separate `rewrite_checks` table. Each evaluation should be its own durable record linked to the rewrite task, with enough metadata for retry, audit, provider diagnostics, and later mastery/spaced-reuse calculations. `rewrite_tasks` may expose latest-check derived fields or a latest-check reference if useful for query/UI performance, but the check result history should not exist only as inline columns on `rewrite_tasks`.

**Incorrect outcome behavior**: If rewrite-check returns `incorrect`, the D+1 rewrite task should still become completed because the learner completed one practice attempt. The learning outcome should be recorded as unsuccessful and must not count as mastery or successful reuse. The first milestone should not keep the task open until correct and should not automatically generate a retry task.

**Partly-correct behavior**: If rewrite-check returns `partly_correct`, the UI may present it as progress, but later mastery and spaced-reuse logic should not count it as successful reuse. Only `correct` should become the strong success signal for mastery progression.

**Submit interaction**: Run rewrite-check synchronously during submit for the first version. The app should save the user's rewrite text, show a checking state, call the evaluator, then render either the persisted check result or a retryable evaluation-failed state. Do not introduce background workers, polling, or manual "Check rewrite" as part of the first milestone.

**Recommended deferrals**:

- Do not generate D+3/D+7 tasks in this first milestone.
- Do not implement pattern mastery UI in this first milestone.
- Do not implement pattern merge/de-dup in this first milestone.
- Do not implement full rewrite queue management beyond preserving current submit/skip behavior.

## Roadmap Sequence

### Milestone 1: Rewrite-Check and Persisted Feedback UI

- Add `rewrite_checks` persistence and shared result types.
- Add an evaluator that checks the submitted D+1 rewrite against original sentence, focus pattern, native model sentence, and review context.
- Persist check status/outcome/feedback and expose the latest check in rewrite-practice snapshots.
- Update the submit UI to show checking, result, and retryable evaluation failure.
- Keep task completion separate from learning success: `completed` task status does not imply `correct` outcome.

#### Parallel Worktree Decomposition

1. `05-02-rewrite-check-contract-persistence` — baseline task. Add `rewrite_checks`, migrations, shared result contracts, and minimal IPC/preload-facing contract shape. Merge this first.
2. `05-02-rewrite-check-evaluator-service` — backend task. Branch from the contract baseline, implement evaluator prompt/service, submit-time persistence, failed-check state, and retry.
3. `05-02-rewrite-check-feedback-ui` — frontend task. Branch from the contract baseline, render checking/result/retry states against the shared contract, and keep UI copy aligned with learning semantics.
4. `05-02-rewrite-check-integration-hardening` — convergence task. Merge backend and frontend slices, resolve shared-contract drift, and run final quality/manual smoke checks.

Recommended worktree order: land task 1 first, develop tasks 2 and 3 in parallel from task 1's commit, then finish with task 4.

### Milestone 2: Rewrite Task Lifecycle

- Make skip, snooze, and expire behavior explicit in service and UI.
- Keep stale rewrite work from crowding Practice.
- Preserve the first milestone's outcome semantics.

### Milestone 3: Mastery and Successful Reuse Signals

- Use `correct` rewrite-check outcomes as the strong signal for successful reuse.
- Treat `partly_correct` as visible progress but not mastery success.
- Add Progress UI affordances for pattern mastery/status only after the outcome signal exists.

### Milestone 4: D+3/D+7 Spaced Reuse

- Generate later spaced reuse only after rewrite-check semantics are stable.
- Use outcomes to decide whether a later task should test reuse, reinforce a weak pattern, or pause.

### Later Backlog

- Pattern merge/de-dup flow.
- Apply correction through explicit revision mechanics.
- Drill Center.
- Anki Sync.
- Import/export jobs.

## Long-Term Roadmap

### North Star

Inkline should become a local-first personal writing learning system with strong exam/scenario practice tracks. The durable pattern-learning loop is the engine: discover recurring patterns from real user writing, practice targeted repair, prove reuse in new contexts, and preserve learning assets that remain useful outside the app.

The product should lean toward practical writing scenarios, including CET-style and goal-specific practice, but should not become a generic English-learning platform, pure mock-exam simulator, or AI co-writer. Its center of gravity should stay on user-authored writing, targeted feedback, and repeated pattern transfer.

**Track strategy**: CET and scenario practice should be first-class tracks over the shared engine. Tracks may have distinct entry points, prompts, review focus, scenario framing, and rewrite tasks, but they should reuse the same writing, review, pattern, rewrite-check, mastery, and spaced-reuse data model. Do not build a parallel exam-mode engine unless a future PRD explicitly prioritizes mock-exam timing, pressure, and scoring.

### Horizon 1: Complete the Learning Loop

Goal: make saved learning assets actionable.

- Rewrite-check and persisted feedback UI.
- Rewrite task lifecycle: skip, snooze, expire.
- Mastery and successful reuse signals.
- D+3/D+7 spaced reuse.
- Basic mastery-aware Progress surfaces.

Exit signal: the app can answer "what pattern am I working on, did I repair it, and did I reuse it later?" from local data.

### Horizon 2: Make the Learning System Maintainable

Goal: keep long-term learning assets accurate instead of letting them become noisy.

- Pattern merge/de-dup flow.
- Pattern status lifecycle: emerging, focus, practicing, improving, stable, mastered.
- Learning event log for review, rewrite, reuse, skip, snooze, expiry, and mastery transitions.
- Safer apply-correction through explicit user-approved revisions.
- Import/export and local backup for user-owned learning history.

Exit signal: months of writing history remain understandable, portable, and trustworthy.

### Horizon 3: Scenario and Exam Practice Built on Proven Patterns

Goal: make scenario/exam practice a first-class product experience after the pattern/reuse system is stable enough to support it.

- Drill Center for targeted pattern drills.
- CET-specific practice refinements without turning Inkline into a mock-exam simulator by default.
- Scenario packs or richer template assets for common writing goals such as school essays, work updates, applications, travel, and free expression.
- Track-level guidance that changes prompts, review focus, and rewrite tasks while reusing the same learning-history engine.
- Optional new-context generation using the user's active patterns.
- Distinct track entry points and progress framing for CET/scenario work without separate scoring or timer mechanics by default.

Exit signal: scenario and exam tracks feel like first-class practice paths while still reusing the same durable pattern system instead of becoming separate feature islands.

### Horizon 4: External Memory and Ecosystem

Goal: let users carry learning assets into their broader study workflow while preserving local-first control.

- Anki Sync for selected patterns or notebook entries.
- Obsidian/Markdown export for learning history.
- Import from legacy `english-journal-coach` assets if still valuable.
- Optional provider/runtime expansion only when it materially improves evaluation, retrieval, or workflow reliability.

Exit signal: Inkline can be the source of truth for writing-learning assets while still integrating with the user's existing tools.

### Horizon 5: Productization and Distribution

Goal: make Inkline usable by people outside the dev environment.

- Reliable packaging and installer flows.
- First-run setup that makes provider configuration clear.
- Local diagnostics for database, provider, keychain, and model-output validation.
- Test data reset/export paths for private beta users.
- Documentation that distinguishes implemented behavior from future plans.

Exit signal: external testers can install, configure, use, diagnose, and back up the app without developer intervention.

### Long-Term Sequencing Rule

Do not start Drill Center, Anki Sync, complex CET scoring, or broad ecosystem integrations until the learning loop produces reliable reuse signals. Scenario and exam tracks may become more visible earlier, but they should remain thin practice paths over the same learning engine until rewrite-check, mastery, and reuse semantics are stable.

## Expansion Sweep

### Future Evolution

- The learning loop could become a real spaced-practice system: review identifies a pattern, rewrite-check evaluates repair, and later prompts test reuse in new contexts.
- Release/distribution work could become the foundation for collecting real feedback from external testers rather than only local development validation.

### Related Scenarios

- Rewrite-check, mastery, and spaced reuse should share one interpretation of "successful reuse" so Progress does not diverge from Practice.
- CET template work should stay consistent with the product rule that CET is one practice template, not a mock-exam simulator.

### Failure and Edge Cases

- Rewrite-check must avoid rewriting for the user; it should evaluate and explain the user's attempt.
- Spaced tasks need explicit skip/snooze/expire states to avoid cluttering Practice with stale obligations.
- Pattern merge/de-dup can affect historical counts and examples, so it should not be bundled into the first rewrite-check milestone unless necessary.

## Out of Scope (Current Roadmap Brainstorm)

- Implementing code changes directly.
- Creating a full release plan without first choosing the roadmap axis.
- Anki Sync, Drill Center, import/export, and precise CET scoring as default next-step work.

## Technical Notes

- Current status source: `README.md`.
- Product scope source: `.trellis/spec/product/mvp-scope.md`.
- Existing v0.2 backlog source: `.trellis/tasks/04-29-v0-2-learning-assets-backlog/prd.md`.
- Recent learning-assets implementation source: `.trellis/tasks/archive/2026-05/05-02-workflow-beats-journal-coach-skill/prd.md` and `info.md`.
- Durable roadmap record: `.trellis/spec/product/roadmap.md`.
