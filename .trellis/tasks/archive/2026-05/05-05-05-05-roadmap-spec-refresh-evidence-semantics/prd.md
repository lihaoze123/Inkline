# Roadmap spec refresh and evidence semantics

## Goal

Refresh Inkline's product roadmap and Trellis product specs so the next implementation work is anchored on **Prove Pattern Transfer**: proving that a learner can repair a reviewed focus pattern and later reuse the same pattern correctly in delayed new-context writing tasks. This task is a spec/backlog alignment task only; it should remove stale roadmap signals that still describe rewrite-check as future work and encode the learning-evidence semantics needed before lifecycle, mastery, and D+3/D+7 implementation begins.

## What I Already Know

- The current roadmap still lists `Rewrite-Check and Persisted Feedback UI` as Milestone 1, but the rewrite-check implementation tasks are archived as completed.
- Current code/specs already define durable `rewrite_checks`, latest-check snapshots, retryable evaluator failures, and the separation between rewrite task lifecycle and rewrite-check outcomes.
- The current v0.2 backlog still includes rewrite-check as a future backlog item, which is stale after the completed rewrite-check work.
- The product direction confirmed in discussion is not broad English learning, Drill Center, Anki, CET scoring, or gamified activity tracking; the next axis is proving delayed pattern transfer.
- Strong learning evidence is **delayed new-context correct reuse**, not task completion or immediate D+1 repair alone.
- D+1 is repair; D+3/D+7 are transfer.
- `partly_correct` is progress feedback but does not advance stage or mastery evidence.
- Valid alternative phrasing may be positive learner feedback, but it does not count as target-pattern transfer evidence.
- User-facing Progress should show a pattern evidence chain in plain language, not internal evaluator fields, gamified scores, streaks, or premature `mastered` claims.

## Assumptions

- This task should not modify product code, database migrations, tests, or UI implementation.
- Existing code can remain as-is even if specs describe future fields such as pattern fingerprints or hidden prompt contracts.
- The spec refresh should be precise enough that later implementation agents do not have to reconstruct the design from conversation memory.
- The refreshed specs should distinguish implemented rewrite-check behavior from future lifecycle/mastery/reuse work.

## Open Questions

- None. The spec-refresh task will not create follow-up implementation child task stubs.

## Requirements

- Update `.trellis/spec/product/roadmap.md` to mark rewrite-check as completed/current baseline and move the active near-term focus to lifecycle, evidence semantics, mastery/progress, and D+3/D+7 new-context reuse.
- Update `.trellis/tasks/04-29-v0-2-learning-assets-backlog/prd.md` so rewrite-check is no longer presented as unstarted backlog.
- Encode the **Prove Pattern Transfer** goal: Inkline should prove that a focus pattern can move from repair to delayed transfer.
- Define learning evidence semantics:
  - `completed` task status is not learning success.
  - D+1 `correct` means repaired.
  - D+3 `correct` means transferred once.
  - D+7 `correct` means stable after spaced reuse.
  - `partly_correct` and `incorrect` do not advance spaced stage.
  - Valid alternative phrasing can be encouraged but does not count as target transfer.
- Define lightweight Progress labels:
  - `Needs repair` — no D+1 correct yet.
  - `Repaired once` — D+1 correct, no D+3 correct yet.
  - `Transferred once` — D+3 correct.
  - `Stable after spaced reuse` — D+7 correct.
- Define the pattern fingerprint contract at the spec level:
  - Fingerprint is generated and schema-validated when the focus pattern is saved from review.
  - Later transfer prompt generation and evaluator logic consume the saved fingerprint rather than reinterpreting the pattern ad hoc.
  - Fingerprint should include fields such as `patternType`, `learnerError`, `targetCorrection`, `abstractRule`, `positiveExamples`, `negativeExample`, `transferBoundary`, and `forbiddenLeakageTerms`.
- Define D+3/D+7 new-context task generation rules:
  - Review/save generates only D+1.
  - D+1 `correct` generates D+3.
  - D+3 `correct` generates D+7.
  - Later stages are not batch-generated ahead of evidence.
- Define reuse task modeling:
  - D+1 remains `rewrite_original`.
  - D+3/D+7 use `new_context_reuse` with spaced stage markers.
  - Reuse shares the existing rewrite-task lifecycle rather than creating a separate `reuse_tasks` system.
- Define retry semantics:
  - `partly_correct`/`incorrect` keep the learner in the same phase and allow retry.
  - Retry stays within the same task using multiple `rewrite_checks` attempts.
  - The first version should not generate separate retry/drill tasks.
- Define hidden prompt contract semantics for future D+3/D+7 tasks:
  - Each new-context reuse task stores `targetMeaning`, `allowedHints`, `forbiddenHints`, and `expectedPatternFamily` for generation/evaluation.
  - Visible prompts must not leak target expressions or original-keyword answers.
- Define evaluator semantics:
  - Public outcome remains `correct | partly_correct | incorrect` with concise user-facing feedback.
  - Repair and transfer share the outcome vocabulary but branch in evaluator meaning.
  - Future transfer checks should persist hidden diagnostic fields such as `usedTargetPattern`, `preservedRequiredMeaning`, `naturalInContext`, `containsForbiddenLeakage`, `usedValidAlternative`, and `reasonCode`.
- Define lifecycle semantics before spaced reuse expands the queue:
  - `pending`, `in_progress`, `completed`, `skipped`, `snoozed`, and `expired` describe task lifecycle only.
  - Learning success comes from check outcome and evidence stage, not lifecycle completion.
- Preserve explicit out-of-scope boundaries for Drill Center, Anki, CET scoring, broad ecosystem integration, full learning event log, and gamified progress until reliable transfer evidence exists.
- Do not create follow-up implementation child task stubs in this task; create lifecycle, mastery evidence, and D+3/D+7 reuse tasks only after the refreshed specs are complete and reviewed.

## Acceptance Criteria

- [ ] Product roadmap no longer presents rewrite-check as the active unimplemented first milestone.
- [ ] Product roadmap names the next axis as proving repair-to-transfer learning evidence.
- [ ] v0.2 backlog no longer misleads future work by listing completed rewrite-check as unstarted backlog.
- [ ] Specs define D+1 repair, D+3 transferred once, and D+7 stable after spaced reuse.
- [ ] Specs explicitly separate task lifecycle from learning success.
- [ ] Specs define pattern fingerprint, transfer boundary, hidden prompt contract, retry, evaluator internal checks, and Progress evidence-chain semantics at the product-contract level.
- [ ] Specs keep future Drill Center, Anki, CET scoring, full event log, and gamified Progress out of the next learning-evidence slice.
- [ ] No business code, migrations, UI files, or runtime tests are changed by this task.

## Definition of Done

- Relevant product specs/backlog docs are updated and internally consistent.
- The roadmap and backlog clearly distinguish completed rewrite-check work from future lifecycle/mastery/reuse work.
- The design decisions from the discussion are captured in durable Trellis specs rather than only conversation memory.
- A final review checks for stale wording such as rewrite-check being both completed and future backlog.
- No child implementation tasks are created in this task; follow-up implementation task creation waits until after this spec refresh is complete.

## Technical Approach

This is a documentation/spec alignment task. The main work is to update the Trellis product-contract documents so implementation agents can later follow exact semantics without redoing roadmap discussion.

Likely files:

- `.trellis/spec/product/roadmap.md`
- `.trellis/tasks/04-29-v0-2-learning-assets-backlog/prd.md`
- `.trellis/spec/product/learning-flow.md`
- `.trellis/spec/product/data-model-contract.md`
- Possibly `.trellis/spec/product/index.md` if the spec index needs a new pointer to the refreshed learning-evidence contract.

## Decision (ADR-lite)

**Context**: The project already implemented rewrite-check persistence, evaluator attempts, retryable failures, and feedback UI. The remaining product uncertainty is whether saved focus patterns become durable, delayed transfer ability rather than activity records.

**Decision**: Refresh specs around **Prove Pattern Transfer** before implementing lifecycle, mastery, or D+3/D+7 tasks. Treat delayed new-context `correct` outcomes as strong learning evidence; keep task lifecycle, evaluator outcome, and mastery/evidence state separate.

**Consequences**: The next implementation work will be slower than simply adding more tasks or gamified progress, but the data semantics will remain honest. Drill Center, Anki, CET scoring, full learning event logs, and broad productization stay deferred until the repair-to-transfer evidence chain is reliable.

## Expansion Sweep

### Future evolution

- Pattern fingerprints can later support pattern merge/de-dup, targeted drills, Anki export, and scenario packs, but this task should only define the contract.
- A full append-only learning event log may become useful after long-term skip/snooze/expire and repeated retry behavior exists, but it is not required for the first evidence chain.

### Related scenarios

- Rewrite lifecycle work must remain consistent with existing rewrite-check retry semantics and latest-check snapshots.
- Progress surfaces should remain consistent with Practice semantics: `completed` does not imply `correct`, and `correct` does not always mean stable.

### Failure and edge cases

- New-context prompts can leak target expressions or be too open; specs should require hidden prompt contracts and leakage checks.
- Users can write valid alternative expressions; specs should allow positive feedback without advancing target-pattern transfer evidence.
- `partly_correct` and `incorrect` need retry/recovery semantics so the evidence chain does not simply dead-end.

## Out of Scope

- Implementing code changes, database migrations, UI, service logic, or tests.
- Creating D+3/D+7 tasks in product code.
- Implementing pattern fingerprint persistence.
- Implementing lifecycle actions such as snooze/expire.
- Implementing mastery/progress UI.
- Implementing Drill Center, Anki Sync, CET scoring, broad ecosystem integrations, gamified scores/streaks, or a full `learning_events` system.
- Creating follow-up Trellis child implementation task stubs.

## Quality Check Notes

- Curated `implement.jsonl` and `check.jsonl`; `task.py validate` reports 8 entries in each file.
- `git diff --check` passes.
- Stale rewrite-check wording search passes for `v0.1 can defer rewrite-check`, `rewrite-check agent`, old near-term path wording, and old Milestone 1 rewrite-check phrasing.
- Independent `trellis-check` reviewed the spec refresh and fixed small consistency gaps around `incorrect`, review-save generating only D+1, and same-task retry semantics.
- `pnpm format:check` could not run because this worktree does not have `node_modules` installed; no dependency installation was performed for this doc-only task.

## Technical Notes

- Worktree: `/home/chumeng/Documents/Frontend/inkline-roadmap-spec-refresh` on branch `roadmap-spec-refresh-evidence-semantics`.
- Task directory: `.trellis/tasks/05-05-05-05-roadmap-spec-refresh-evidence-semantics`.
- Current roadmap source inspected: `.trellis/spec/product/roadmap.md`.
- Current backlog source inspected: `.trellis/tasks/04-29-v0-2-learning-assets-backlog/prd.md`.
- Existing rewrite-check contract inspected: `.trellis/spec/product/learning-flow.md` and `.trellis/spec/product/data-model-contract.md`.
- Existing schema already has `rewrite_tasks.kind` values for `rewrite_original`, `new_context_reuse`, and `pattern_detection`, and a `spaced_stage` field; implementation is out of scope here.
