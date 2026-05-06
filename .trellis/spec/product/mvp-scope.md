# MVP Scope Contract

## Product Goal

Build a local-first desktop AI writing practice app for Chinese native speakers who practice English through repeatable writing scenarios. The product loop is: choose a practice template, optionally generate a starter prompt/topic, write independently, review with focused AI feedback, self-repair, compare with a reference rewrite, save learning history, and complete a D+1 rewrite practice later.

The app is not a generic English-learning platform, a mock-exam simulator, or an AI co-writer. Journal, CET-4 Writing, CET-6 Writing, and Free Writing are same-level practice templates inside the broader Inkline product.

## v0.1 Goal

v0.1 validates whether template-aware writing practice plus focused review results are clear, useful, and low-friction enough for repeat use.

### v0.1 Includes

- Local database initialization.
- Practice entry surface.
- Template picker with Journal, CET-4 Writing, CET-6 Writing, and Free Writing.
- Writing editor.
- One current draft per template.
- Optional AI starter prompt/topic generation for every template.
- One-time provider disclosure before first starter prompt/topic generation.
- Regenerate, retry, and skip generation behavior.
- Optional user goal/topic persisted with the writing attempt.
- Autosave.
- Review current writing revision with template-aware context.
- Correction list.
- Original-text highlighting through annotations.
- Saved review runs.
- Exactly one focus pattern per review.
- Hint-first self-repair for the focus correction.
- At least one `What you did well` item.
- One reference rewrite.
- `Notice the gap` for the reference rewrite.
- One D+1 rewrite practice generated from the review.
- Provider privacy disclosure before the first review.
- Review contract test harness.

### Current Review Caps

```text
maxCorrections: 5
maxReferenceRewrites: 1
maxRewriteTasks: 1
maxUpgradeOpportunities: 3
maxWhatWentWell: 2
maxInputExamples: 2
existingPatternsLimit: 30
```

Implement validation and UI assuming these caps. Do not hide extra agent output silently unless the task explicitly defines truncation behavior.

### v0.1 Out of Scope

- User-created or editable templates.
- In-editor AI co-writing.
- Live writing suggestions.
- Heavy analytics dashboards.
- Mock-exam mode.
- Timers.
- Word-count pressure.
- Precise CET scores.
- Independent Error Patterns page.
- Complete long-term pattern statistics dashboard.
- User-managed lexicon editing.
- Multiple rewrite practices.
- Complete rewrite queue.
- Anki sync.
- Drill center.
- Apply correction.
- CEFR scoring, multidimensional essay grading, or complex dashboard.

## v0.2 Goal

v0.2 validates whether users learn from recurring patterns and reuse them in new contexts.

### Implemented Learning-Assets Slice

- Persistent error patterns with reuse, counts, first/last seen dates, recent examples, and active state.
- Saved corrections link to semantic pattern IDs when validation can derive one.
- Review input reuses active non-spelling patterns from the persistent archive.
- Upgrade opportunities are allowed by cap, validated against source writing, and persisted as Notebook entries.
- Notebook and Progress pages read real local learning history.
- Durable rewrite-check attempts evaluate submitted D+1 rewrites and persist `correct`, `partly_correct`, or `incorrect` outcomes with retryable failure states.
- Manual pattern merge/de-dup flow keeps source traceability and rolls source evidence into the target.

### Remaining v0.2 Adds

- Rewrite lifecycle semantics for skip, snooze, expire, and retry recovery.
- Pattern evidence status based on repair and delayed transfer, not task completion.
- D+3 and D+7 delayed new-context reuse tasks.
- Pattern fingerprints and transfer boundaries for reliable reuse generation/evaluation.
- Hidden new-context prompt contracts and transfer evaluator diagnostic checks.
- Apply correction through a revision mechanism.

## Backlog After v0.2

See [roadmap.md](./roadmap.md) for the product sequencing rule and long-term horizons.

- Drill Center.
- Anki Sync.
- Import/export jobs.
- Learning events for practice analytics.

## Scope Rule

When a v0.1 task touches a v0.2 concept, preserve the data shape only if the PRD requires it. Do not build UI, workflows, or statistics for v0.2 concepts during v0.1.
