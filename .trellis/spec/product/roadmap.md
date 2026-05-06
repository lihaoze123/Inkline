# Product Roadmap

## North Star

Inkline is a local-first personal writing learning system with strong exam/scenario practice tracks.

The durable pattern-learning loop is the engine:

1. The learner writes in a real scenario.
2. The app reviews the writing with focused, validated feedback.
3. The learner repairs one targeted pattern.
4. Rewrite-check evaluates whether the repair worked.
5. Later practice asks the learner to reuse the same pattern in delayed new contexts.
6. Progress explains the evidence chain from repair to transfer.
7. Learning assets stay local, durable, and portable.

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

## Current Baseline

### Completed: Rewrite-Check and Persisted Feedback UI

Rewrite-check is now a baseline learning signal, not the active future milestone.

Implemented baseline behavior:

- `rewrite_checks` persistence and shared result types exist.
- Submitted D+1 rewrites are evaluated against the original sentence, focus pattern, native model sentence, and review context.
- Check status, outcome, feedback, provider/model metadata, validation errors, and retryable failures are persisted.
- Latest checks are exposed in rewrite-practice snapshots.
- Submit UI can show checking, result, retryable evaluation failure, and native-model reveal after submission.
- Task completion is separate from learning success: `completed` rewrite task status does not imply `correct` outcome.

Baseline outcome semantics:

- `correct` is the strong success signal for repair and future reuse.
- `partly_correct` is visible progress but does not advance mastery or spaced stage.
- `incorrect` records an unsuccessful learning outcome without deleting the completed attempt.
- Retry creates additional check attempts and preserves attempt history.

## Active Axis: Prove Pattern Transfer

The next roadmap axis is proving whether a reviewed focus pattern moves from immediate repair to delayed transfer.

Strong learning evidence is not activity volume, task completion, or AI feedback alone. The minimum strong signal is:

```text
delayed new-context task + correct rewrite-check outcome
```

Evidence stages:

| Evidence | Meaning |
| --- | --- |
| Task `completed` | The learner submitted something; this is not learning success. |
| D+1 `correct` | The learner repaired the original sentence once. |
| D+3 `correct` | The learner transferred the pattern once in a delayed new context. |
| D+7 `correct` | The pattern is stable after spaced reuse. |
| `partly_correct` | Progress feedback only; keep the learner in the same phase. |
| `incorrect` | Unsuccessful attempt; keep the learner in the same phase and allow retry. |
| Valid alternative | Natural expression is encouraged, but target-pattern transfer is not shown. |

Progress surfaces should explain this evidence chain in learner-facing language, not through scores, streaks, task counts, or premature `mastered` claims.

Recommended labels:

- `Needs repair` — no D+1 correct yet.
- `Repaired once` — D+1 correct, no D+3 correct yet.
- `Transferred once` — D+3 correct.
- `Stable after spaced reuse` — D+7 correct.

## Near-Term Sequence

### Milestone 2: Rewrite Task Lifecycle

Goal: keep Practice usable and learning evidence truthful as more due tasks appear.

- Make skip, snooze, and expire behavior explicit in service and UI.
- Keep stale rewrite work from crowding Practice.
- Preserve rewrite-check outcome semantics.
- Keep lifecycle status separate from learning success.

First-version lifecycle semantics:

- `pending`: task is due or waiting.
- `in_progress`: learner is working on the task.
- `completed`: learner submitted; this does not imply learning success.
- `skipped`: learner intentionally abandoned this practice opportunity; not success.
- `snoozed`: learner deferred the task by changing `dueAt`; no mastery impact.
- `expired`: task is too stale to keep pushing; not a language failure, but the review window was missed.

### Milestone 3: Evidence Model and Mastery-Aware Progress

Goal: make saved learning assets explainable before generating more spaced work.

- Derive lightweight pattern evidence states from review patterns, rewrite tasks, and rewrite checks.
- Show pattern evidence chain in Progress.
- Avoid full gamified scoring and avoid claiming `mastered`.
- Keep `partly_correct`, `incorrect`, skip, snooze, and expiry visible as learning context without advancing evidence stage.

First-version evidence labels:

```text
Needs repair -> Repaired once -> Transferred once -> Stable after spaced reuse
```

Do not introduce a full `emerging/focus/practicing/improving/stable/mastered` lifecycle until the app has enough delayed transfer data to justify it.

### Milestone 4: Pattern Fingerprints and Transfer Reliability

Goal: prevent transfer prompts and evaluators from reinterpreting a focus pattern differently every time.

- Generate and schema-validate a structured pattern fingerprint when the focus pattern is saved from review.
- Reuse the fingerprint for D+3/D+7 prompt generation and transfer evaluation.
- Include a transfer boundary that states what counts as the same pattern and what does not.
- Store hidden prompt contracts for new-context tasks so prompts can be evaluated for leakage and target fit.
- Persist hidden transfer-evaluator checks/reason codes for diagnostics without exposing them as normal learner UI.

Fingerprint fields should include:

```text
patternType
learnerError
targetCorrection
abstractRule
positiveExamples
negativeExample
transferBoundary
forbiddenLeakageTerms
```

Hidden new-context prompt contracts should include:

```text
targetMeaning
allowedHints
forbiddenHints
expectedPatternFamily
```

Transfer evaluator internals may include:

```text
usedTargetPattern
preservedRequiredMeaning
naturalInContext
containsForbiddenLeakage
usedValidAlternative
reasonCode
```

Public learner feedback should remain simple: `correct | partly_correct | incorrect` plus concise explanation and next step.

### Milestone 5: D+3/D+7 New-Context Reuse

Goal: test delayed transfer without turning the product into mechanical drills.

- Review/save generates only the D+1 original-repair task.
- Generate D+3 only after D+1 rewrite-check returns `correct`.
- Generate D+7 only after D+3 new-context reuse returns `correct`.
- Do not batch-create future spaced tasks at review-save time.
- Represent D+3/D+7 as `rewrite_tasks.kind = 'new_context_reuse'` with `spacedStage = 'D+3' | 'D+7'`.
- Keep D+1 original repair as `rewrite_original`.
- Reuse the same rewrite-task lifecycle and rewrite-check outcome vocabulary.
- Branch evaluator semantics by task kind/stage: D+1 checks repair; D+3/D+7 checks transfer.
- Consume the saved pattern fingerprint and hidden prompt contract rather than reinterpreting the focus pattern ad hoc.

New-context reuse tasks should be short writing tasks in a new scenario. They must not ask the learner to rewrite the original sentence, mechanically fill a blank, or copy a leaked target expression.

## Long-Term Horizons

### Horizon 1: Complete the Learning Loop

Goal: make saved learning assets actionable and trustworthy.

- Rewrite task lifecycle.
- Evidence model and mastery-aware Progress.
- Pattern fingerprints and hidden transfer contracts.
- D+3/D+7 new-context reuse.
- Basic recovery/retry semantics for `partly_correct` and `incorrect` attempts.

Exit signal: the app can answer "what pattern am I working on, did I repair it, did I transfer it once, and did it stay stable after spaced reuse?" from local data.

### Horizon 2: Make the Learning System Maintainable

Goal: keep long-term learning assets accurate instead of noisy.

- Pattern merge/de-dup flow.
- Richer pattern status lifecycle after enough transfer evidence exists.
- Learning event log for review, rewrite, reuse, skip, snooze, expiry, retry, and mastery transitions.
- Safer apply-correction through explicit user-approved revisions.
- Import/export and local backup for user-owned learning history.

Exit signal: months of writing history remain understandable, portable, and trustworthy.

### Horizon 3: Scenario and Exam Practice Built on Proven Patterns

Goal: make scenario/exam practice a first-class product experience after the pattern/reuse system is stable enough to support it.

- Drill Center for targeted pattern drills.
  - Foundation implemented: a Drills page lists active patterns, evidence, and the current matching pending rewrite practice from existing learning assets.
  - Later expansion needs a separate PRD before adding on-demand drill generation, scenario packs, or evidence-affecting drill creation.
- CET-specific practice refinements without making Inkline a mock-exam simulator by default.
  - Foundation implemented: CET-4 and CET-6 render lightweight Practice guidance over the shared writing engine.
  - Later expansion needs a separate PRD before adding timed mode, word-count pressure, official scoring/rubrics, or mock-exam flow.
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

A thin beta-readiness baseline may run alongside the learning-evidence roadmap when it enables real user feedback, but it should not displace the repair-to-transfer proof path unless external testing becomes the explicit immediate goal.

Exit signal: external testers can install, configure, use, diagnose, and back up the app without developer intervention.

## Sequencing Rule

Do not expand Drill Center beyond its existing foundation, start Anki Sync, add complex CET scoring, broad ecosystem integrations, full learning event logs, or gamified mastery surfaces until the learning loop produces reliable delayed transfer signals. Scenario and exam tracks may become more visible earlier, but they should remain thin practice paths over the same writing/review/rewrite/check engine until lifecycle, evidence, and reuse semantics are stable.
