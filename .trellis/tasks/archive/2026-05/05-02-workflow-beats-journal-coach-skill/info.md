# Technical Design Notes

## Focused Grill Result

The thread objective is not to clone every old skill mode. The app should become stronger for the core daily workflow by using product advantages the old skill cannot provide: validated AI output, local app state, first-class UI, and atomic persistence.

Recommended and adopted scope for this iteration:

- Implement persistent learning assets first: error patterns, pattern recurrence, and notebook upgrade opportunities.
- Defer Anki, drill center, full rewrite-check grading, CET scoring, and import/export.

Reasoning:

- Existing product spec names Error Patterns, pattern reuse/counts, upgrade opportunities, and dashboard as v0.2 scope.
- Existing `04-29-v0-2-learning-assets-backlog` task lists the same work as the next roadmap area.
- The old skill's strongest real usage in recent journals is the durable archive/lexicon loop, not Anki itself.
- Current app already beats the old skill on writing UX, validation, privacy disclosure, autosave, and D+1 rewrite mechanics.

## Proposed Data Model

Add tables:

- `error_patterns`
  - `id`
  - `pattern_key` unique
  - `category`
  - `rule`
  - `canonical_example`
  - `count`
  - `first_seen_date_key`
  - `last_seen_date_key`
  - `recent_examples_json`
  - `active`
  - `created_at`
  - `updated_at`
- `notebook_entries`
  - `id`
  - `review_run_id`
  - `date_key`
  - `template_id`
  - `source_text`
  - `suggested_text`
  - `reason`
  - `created_at`

Update `corrections.pattern` to store the semantic pattern ID/rule currently available from validated operations. If a schema migration can safely add a dedicated `pattern_id` column without excessive churn, prefer that.

## Persistence Flow

On `saveReviewRun`:

1. Read `review_runs.preview_operations_json`.
2. For each persisted correction:
   - if it has `matchedPatternId`, increment that active pattern;
   - if it has `newPatternSuggestion`, normalize category/rule/canonical example to a pattern key and upsert;
   - attach the resulting semantic ID/rule to the correction row.
3. Persist notebook entries from validated upgrade opportunities.
4. Continue writing self-repair, reference rewrite, and D+1 rewrite task in the existing transaction.

Invalid review output never reaches `saveReviewRun`, so learning assets update only from validated operations.

## Review Input Flow

Replace `selectExistingPatterns()` so it reads active `error_patterns`, excludes spelling, orders by useful recurrence/recency, and respects `V0_1_REVIEW_CAPS.existingPatternsLimit`.

## UI Flow

- Progress page: show recurring patterns sorted by count/recency, plus recent examples.
- Notebook page: show saved upgrade opportunities sorted by newest first.
- Empty states should point back to Practice without implying the app has data it lacks.

## Testing Targets

- Pattern key normalization and upsert/reuse.
- Save review with matched pattern increments count and appends recent example.
- Save review with new pattern suggestion creates one semantic pattern.
- Review input uses persisted patterns.
- Notebook persistence from upgrade opportunities.
- Renderer query or service tests for Progress/Notebook snapshots.
