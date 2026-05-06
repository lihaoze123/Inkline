# Implement Pattern Fingerprints

## Goal

Implement the first PR #25 Milestone 4 slice: persist schema-validated structured fingerprints for saved focus patterns so later D+3/D+7 prompt generation and transfer evaluation can consume a stable pattern contract instead of reinterpreting a loose rule string.

## Source

- GitHub PR #25: `Refresh roadmap evidence semantics`, merged as `809b080`.
- Completed prerequisites:
  - `2eabcd5` rewrite task lifecycle.
  - `c5a0989` derived pattern evidence Progress.
- Roadmap milestone: `Milestone 4: Pattern Fingerprints and Transfer Reliability`.

## What I Already Know

- Existing `error_patterns` rows store category, rule, canonical example, counts, recency, and active state, but not a structured fingerprint.
- Existing review output schema does not include fingerprint fields.
- Existing review prompt asks for `newPatternSuggestion` with category/rule/canonical example only.
- Existing `saveReviewRun` persists pattern operations before corrections and rewrite tasks.
- Existing `corrections.pattern_id` and `error_patterns` are the durable pattern archive; adding a separate `reuse_tasks` or transfer system is out of scope.
- Product specs define the fingerprint fields and say internals should not be normal learner UI.

## Requirements

- Add a shared Zod schema/type for `PatternFingerprint`.
- Extend review agent output so the validated focus pattern includes a fingerprint.
- Add local SQLite persistence for pattern fingerprints on durable `error_patterns`.
- Store fingerprint JSON only for the saved focus pattern, not every correction.
- Validate fingerprint before preview/save can become durable learning data.
- Keep fingerprint internals hidden from normal renderer Progress/Notebook UI.
- Preserve existing review save idempotency and pattern de-dup behavior.

## Fingerprint Shape

```ts
type PatternFingerprint = {
  patternType: 'grammar' | 'collocation' | 'word_choice' | 'phrase_structure' | 'register' | 'sentence_logic';
  learnerError: string;
  targetCorrection: string;
  abstractRule: string;
  positiveExamples: string[];
  negativeExample: string;
  transferBoundary: string;
  forbiddenLeakageTerms: string[];
};
```

## Product Decisions

- Persist fingerprints as JSON in `error_patterns.fingerprint_json`, nullable for existing rows.
- The review agent supplies the fingerprint in the validated review output for `summary.focusPattern`.
- Save only the fingerprint for the single focus correction chosen by `summary.focusPattern.correctionIndex`.
- New pattern rows are inserted with the focus fingerprint when the new pattern is the focus pattern.
- Matched/reused pattern rows get the focus fingerprint only if their stored fingerprint is currently null.
- Existing non-null fingerprints are not overwritten in this first version; preventing pattern drift is more important than refreshing.
- The fingerprint is not added to `ErrorPatternSnapshot` returned to renderer Progress in this task.

## Validation Rules

- Fingerprint fields must be non-empty and schema-valid.
- `positiveExamples` must contain at least one short reusable example.
- `forbiddenLeakageTerms` must contain at least one term and should include target-expression leakage terms.
- The focus fingerprint must be attached to the focus pattern; non-focus fingerprints are ignored or rejected based on implementation fit.
- Invalid/missing focus fingerprint makes review validation invalid or prevents save from writing learning assets; do not persist partial fingerprint data.

## Acceptance Criteria

- [x] A migration adds fingerprint storage for `error_patterns` and is registered in the Drizzle journal.
- [x] Shared review-contract schemas define and validate `PatternFingerprint`.
- [x] Review prompt requests a fingerprint for the focus pattern only.
- [x] Valid review output with a focus fingerprint passes validation.
- [x] Missing/invalid focus fingerprint fails validation before durable learning assets are written.
- [x] Saving a new focus pattern persists `fingerprint_json`.
- [x] Saving a matched focus pattern fills `fingerprint_json` when missing.
- [x] Saving a matched focus pattern with an existing fingerprint does not overwrite it.
- [x] Renderer-facing Progress/Notebook snapshots do not expose fingerprint internals.
- [x] No D+3/D+7 task generation, hidden prompt contracts, or transfer evaluator diagnostics are implemented.

## Out of Scope

- D+3/D+7 new-context task generation.
- Hidden new-context prompt contracts.
- Transfer evaluator diagnostics/reason codes.
- Fingerprint editing UI or normal learner-facing fingerprint display.
- Backfilling fingerprints for old patterns.
- Pattern merge/de-dup UI.
- A separate pattern-fingerprint table unless implementation finds `error_patterns.fingerprint_json` unsafe.

## Definition of Done

- Implementation follows PR #25 product specs.
- Focused validation, persistence, and migration tests cover fingerprint behavior.
- Existing review contract/save tests remain compatible after fixture updates.
- `pnpm check` passes.
- Spec update judgment is completed after implementation.

## Verification Notes

- Implement/check agents completed the code and fixed public snapshot and non-focus persistence guards.
- Product specs were updated for the durable fingerprint contract and public snapshot strip boundary.
- Final local quality gate is run in Phase 3 before commit.

## Technical Notes

- Likely touchpoints:
  - `src/shared/review-contract/schemas.ts`
  - `src/shared/review-contract/validation.ts`
  - `src/main/services/review/lib/prompt.ts`
  - `src/main/services/learning-assets/service.ts`
  - `src/main/db/schema.ts`
  - `drizzle/0008_pattern_fingerprints.sql`
  - `drizzle/meta/_journal.json`
  - review contract/save/database tests and fixtures.
- Relevant existing specs:
  - `.trellis/spec/product/roadmap.md`
  - `.trellis/spec/product/review-agent-contract.md`
  - `.trellis/spec/product/data-model-contract.md`
  - `.trellis/spec/product/validation-and-testing.md`
