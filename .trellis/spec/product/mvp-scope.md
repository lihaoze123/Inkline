# MVP Scope Contract

## Product Goal

Build a local-first desktop writing coach for Chinese native speakers who practice English through daily journaling. The product should convert journal feedback into a low-friction learning loop: write, review, self-repair, compare, save, and reuse later.

The app is not a general English-learning platform. It serves one core scenario: the user writes an English journal entry and receives actionable feedback from an agent.

## v0.1 Goal

v0.1 validates whether review results are clear, useful, and low-friction enough for daily use.

### v0.1 Includes

- Local database initialization.
- Journal editor.
- Autosave.
- Review current journal.
- Correction list.
- Original-text highlighting through annotations.
- Saved review runs.
- Exactly one focus pattern per review.
- Hint-first self-repair for the focus correction.
- At least one `What you did well` item.
- One reference rewrite.
- `Notice the gap` for the reference rewrite.
- One rewrite practice generated from the review.
- Provider privacy disclosure before the first review.
- Review contract test harness.

### v0.1 Hard Caps

```text
maxCorrections: 5
maxReferenceRewrites: 1
maxRewriteTasks: 1
maxUpgradeOpportunities: 0
maxWhatWentWell: 2
maxInputExamples: 2
existingPatternsLimit: 30
```

Implement validation and UI assuming these caps. Do not hide extra v0.1 agent output silently unless the task explicitly defines truncation behavior.

### v0.1 Out of Scope

- Independent Error Patterns page.
- Complete long-term pattern statistics dashboard.
- Upgrade opportunities and lexicon entries.
- Multiple rewrite practices.
- Complete rewrite queue.
- Anki sync.
- CET practice.
- Drill center.
- Apply correction.
- CEFR scoring, multidimensional essay grading, or complex dashboard.

## v0.2 Goal

v0.2 validates whether users learn from recurring patterns and reuse them in new contexts.

### v0.2 Adds

- Error Patterns page.
- Pattern reuse, counts, recurring marks, and mastery status.
- Successful reuse tracking.
- Pattern merge/de-dup flow.
- Rewrite-check agent.
- Rewrite skip, snooze, and expire.
- D+3 and D+7 spaced reuse tasks.
- Upgrade opportunities.
- Basic learning dashboard.
- Apply correction through a revision mechanism.

## Backlog After v0.2

- Drill Center.
- CET Practice.
- Anki Sync.
- Import/export jobs.
- Learning events for practice analytics.

## Scope Rule

When a v0.1 task touches a v0.2 concept, preserve the data shape only if the PRD requires it. Do not build UI, workflows, or statistics for v0.2 concepts during v0.1.
