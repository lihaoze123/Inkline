# Old Skill And Journal Comparison

## Source Materials

- Legacy skill: `/home/chumeng/Documents/.obsidian/Notes/.claude/skills/english-journal-coach/SKILL.md`
- Recent journal examples:
  - `/home/chumeng/Documents/.obsidian/Notes/50 Journal/2026-04-28.md`
  - `/home/chumeng/Documents/.obsidian/Notes/50 Journal/2026-04-29.md`
  - `/home/chumeng/Documents/.obsidian/Notes/50 Journal/2026-04-30.md`
  - `/home/chumeng/Documents/.obsidian/Notes/50 Journal/lexicon.md`
  - `/home/chumeng/Documents/.obsidian/Notes/50 Journal/error-patterns.json`
- Current app references:
  - `README.md`
  - `src/main/services/review/lib/input.ts`
  - `src/main/services/review/procedures/save.ts`
  - `src/main/db/schema.ts`
  - `src/renderer/App.tsx`
  - `.trellis/spec/product/mvp-scope.md`
  - `.trellis/spec/product/data-model-contract.md`

## What The Legacy Skill Does Well

- It preserves a durable `error-patterns.json` archive with semantic pattern IDs, categories, rules, counts, first/last seen dates, examples, and current focus state.
- It preserves a durable `lexicon.md` queue with dated upgrade opportunities, including casual journal phrases and `[formal]` CET phrases.
- It appends feedback directly into the journal, so the source writing, corrections, rewrite targets, CET practice, and later rewrite checks stay in one visible daily artifact.
- It creates clear follow-up actions:
  - inline correction annotations,
  - 2-3 reference rewrites,
  - 2 rewrite targets,
  - next-day CET practice,
  - optional summary, drill, rewrite-check, and Anki sync modes.
- Recent concrete usage on `2026-04-28.md` shows real value:
  - recurring counts surfaced for tense, agreement, articles, embedded questions, and spelling,
  - reference rewrites are attached to exact source sentences,
  - upgrade opportunities are saved to `lexicon.md`,
  - next-day rewrite and CET practice blocks are generated.

## Where The Current App Is Already Stronger

- It gives a dedicated writing surface with template-aware scenarios instead of requiring manual Obsidian file conventions.
- Autosave, local SQLite, current draft per template, and stale-review handling reduce manual file-management risk.
- It validates AI output before preview or save, including schema checks, quote anchoring, one focus pattern, answer-hiding, and rewrite-task constraints.
- It has provider disclosure, OS-keychain credential storage, and local-first boundaries.
- It supports a hint-first self-repair step and D+1 rewrite task inside the app, which is less manual than filling Markdown sections.

## Critical Gaps Blocking "Better Than Agent + Skill"

- Long-term pattern persistence is weak. The app currently derives `existingPatterns` from saved correction rows in `src/main/services/review/lib/input.ts`, using correction IDs as pattern IDs. That is not equivalent to the legacy semantic pattern archive.
- Pattern recurrence is not user-visible. `Progress` is a placeholder, so the user cannot see top recurring issues or counts.
- Upgrade opportunities are disabled by prompt contract (`maxUpgradeOpportunities: 0`) and the Notebook page is a placeholder, so the app cannot replace `lexicon.md`.
- Rewrite practice records only store completion text and reveal the native model. There is no rewrite-check feedback comparable to the old skill's Mode 3.
- CET is only a template-aware writing scenario. It does not yet provide CET scores, formal lexicon, native models, or task alternation.
- Anki sync and drill center are intentionally out of scope in current product specs.

## Minimum Iteration That Moves The App Past The Old Daily Workflow

The highest-leverage next step is a persisted learning-assets layer:

- Add first-class error pattern persistence with semantic IDs, dedup keys, counts, first/last seen dates, recent examples, and active state.
- Update saved review persistence so matched and newly suggested patterns update the pattern archive atomically with corrections.
- Use the real pattern archive for future review input instead of mining recent corrections.
- Add a Progress view that shows recurring patterns and today's focus in a compact, actionable way.
- Enable and persist upgrade opportunities into a Notebook view, replacing the legacy `lexicon.md` queue for normal daily review.

This does not need to implement Anki, full drill center, CET scoring, or rewrite-check grading yet. Those are valuable, but the app can become more usable than the old skill for the core daily loop once durable learning assets and visible recurrence exist inside the app.

## Success Criteria For The Thread Goal

The project workflow is stronger than the old skill when a realistic daily user can:

1. Open the app, pick Journal or CET, write, review, and save without managing Markdown sections manually.
2. Get validated feedback that cannot silently corrupt long-term learning state.
3. See recurring error patterns with counts and examples inside the app.
4. Reuse those patterns in future AI reviews.
5. Save and browse upgrade opportunities inside the app.
6. Complete at least one delayed rewrite practice without revealing the model answer first.

At that point, the old skill remains broader for Anki/drills/CET scoring, but the app is more usable and safer for the core practice workflow.
