# Product Roadmap

## North Star

Inkline is a local-first personal writing learning system with strong exam/scenario practice tracks.

The durable pattern-learning loop is the engine:

1. The learner writes in a real scenario.
2. The app reviews the writing with focused, validated feedback.
3. The learner repairs one targeted pattern.
4. Rewrite-check evaluates whether the repair worked.
5. Later practice asks the learner to reuse the same pattern in new contexts.
6. Progress and learning assets stay local, durable, and portable.

Inkline should lean toward practical writing scenarios, including CET-style and goal-specific practice, but it should not become a generic English-learning platform, pure mock-exam simulator, or AI co-writer. The product center remains user-authored writing, targeted feedback, and repeated pattern transfer.

## Track Strategy

CET and scenario practice are first-class tracks over the shared engine.

Tracks may have distinct:

- Entry points.
- Starter prompt policy.
- Review focus.
- Scenario framing.
- Rewrite task prompts.
- Progress framing.

Tracks must reuse the same:

- Writing attempt and revision model.
- Review flow and validation boundary.
- Pattern archive.
- Rewrite tasks.
- Rewrite-check outcomes.
- Mastery and spaced-reuse semantics.

Do not build a parallel CET/exam engine unless a future PRD explicitly prioritizes mock-exam timing, pressure, scoring, and official-rubric simulation.

## Near-Term Sequence

### Milestone 1: Rewrite-Check and Persisted Feedback UI

- Add `rewrite_checks` persistence and shared result types.
- Evaluate the submitted D+1 rewrite against the original sentence, focus pattern, native model sentence, and review context.
- Persist check status, outcome, feedback, provider/model metadata, and validation errors.
- Expose the latest check in rewrite-practice snapshots.
- Update submit UI to show checking, result, and retryable evaluation failure.
- Keep task completion separate from learning success: `completed` task status does not imply `correct` outcome.

First-version scope:

- Use a separate `rewrite_checks` table, not only inline fields on `rewrite_tasks`.
- Run rewrite-check synchronously during submit: save the user's rewrite, show checking, call evaluator, then show the persisted result or retryable failure.
- If evaluation fails, preserve the user rewrite, do not count it as success, and expose retry.
- If outcome is `incorrect`, complete the D+1 task but record unsuccessful learning.
- If outcome is `partly_correct`, show progress but do not count it as mastery success.
- Only `correct` is the strong success signal for mastery progression.

### Milestone 2: Rewrite Task Lifecycle

- Make skip, snooze, and expire behavior explicit in service and UI.
- Keep stale rewrite work from crowding Practice.
- Preserve rewrite-check outcome semantics.

### Milestone 3: Mastery and Successful Reuse Signals

- Use `correct` rewrite-check outcomes as the strong signal for successful reuse.
- Treat `partly_correct` as visible progress but not mastery success.
- Add Progress UI affordances for pattern mastery/status after outcome signals exist.

### Milestone 4: D+3/D+7 Spaced Reuse

- Generate later spaced reuse after rewrite-check semantics are stable.
- Use outcomes to decide whether a later task should test reuse, reinforce a weak pattern, or pause.

## Long-Term Horizons

### Horizon 1: Complete the Learning Loop

Goal: make saved learning assets actionable.

- Rewrite-check and persisted feedback UI.
- Rewrite task lifecycle.
- Mastery and successful reuse signals.
- D+3/D+7 spaced reuse.
- Basic mastery-aware Progress surfaces.

Exit signal: the app can answer "what pattern am I working on, did I repair it, and did I reuse it later?" from local data.

### Horizon 2: Make the Learning System Maintainable

Goal: keep long-term learning assets accurate instead of noisy.

- Pattern merge/de-dup flow.
- Pattern status lifecycle: emerging, focus, practicing, improving, stable, mastered.
- Learning event log for review, rewrite, reuse, skip, snooze, expiry, and mastery transitions.
- Safer apply-correction through explicit user-approved revisions.
- Import/export and local backup for user-owned learning history.

Exit signal: months of writing history remain understandable, portable, and trustworthy.

### Horizon 3: Scenario and Exam Practice Built on Proven Patterns

Goal: make scenario/exam practice a first-class product experience after the pattern/reuse system is stable enough to support it.

- Drill Center for targeted pattern drills.
- CET-specific practice refinements without making Inkline a mock-exam simulator by default.
- Scenario packs for school essays, work updates, applications, travel, and free expression.
- Track-level guidance that changes prompts, review focus, and rewrite tasks while reusing the same learning-history engine.
- Optional new-context generation using the user's active patterns.

Exit signal: scenario and exam tracks feel first-class while still reusing the durable pattern system.

### Horizon 4: External Memory and Ecosystem

Goal: let users carry learning assets into broader study workflows while preserving local-first control.

- Anki Sync for selected patterns or notebook entries.
- Obsidian/Markdown export for learning history.
- Import from legacy `english-journal-coach` assets if still valuable.
- Optional provider/runtime expansion only when it materially improves evaluation, retrieval, or workflow reliability.

Exit signal: Inkline is the source of truth for writing-learning assets while still integrating with existing tools.

### Horizon 5: Productization and Distribution

Goal: make Inkline usable outside the development environment.

- Reliable packaging and installer flows.
- First-run setup that makes provider configuration clear.
- Local diagnostics for database, provider, keychain, and model-output validation.
- Test data reset/export paths for private beta users.
- Documentation that distinguishes implemented behavior from future plans.

Exit signal: external testers can install, configure, use, diagnose, and back up the app without developer intervention.

## Sequencing Rule

Do not start Drill Center, Anki Sync, complex CET scoring, or broad ecosystem integrations until the learning loop produces reliable reuse signals. Scenario and exam tracks may become more visible earlier, but they should remain thin practice paths over the same learning engine until rewrite-check, mastery, and reuse semantics are stable.
