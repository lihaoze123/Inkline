# Research: Current Writing Workflow

- **Query**: Inspect the repo for current journal/writing/practice flows, prompt assets, skill/workflow references, and any CET-related implementation or docs for broadening from journal-centered writing to broader writing practice including CET writing practice.
- **Scope**: internal
- **Date**: 2026-04-30

## Findings

### Files Found

| File Path | Description |
|---|---|
| `README.md` | Product overview states the current app is v0.1.0 and focuses on one workflow: today's English journal entry and review. Lists daily journal editor, review flow, and one D+1 rewrite practice slot. |
| `CHANGELOG.md` | v0.1.0 changelog confirms Today journal flow, review preview/save flow, stale review handling, and D+1 rewrite practice. |
| `src/renderer/App.tsx` | Today page state orchestration: journal content/autosave, review start/save, rewrite practice submit/skip, and renderer composition. |
| `src/renderer/components/JournalEditorCard.tsx` | User-facing journal editor copy and textarea for today's English journal. |
| `src/renderer/components/LearningPanel.tsx` | Right-side learning panel states for before writing, after writing, review preview, scheduled practice card, and due D+1 rewrite practice card. |
| `src/renderer/components/TodayHeader.tsx` | Header copy frames the app as a focused journal space. |
| `src/renderer/components/SettingsDrawer.tsx` | Settings copy says review sends the current entry and bounded learning context to the provider. |
| `src/renderer/components/ReviewDisclosureDialog.tsx` | First-review disclosure says the journal stays local by default. |
| `src/preload/index.ts` | Exposes `window.api.journal.*` methods for Today snapshot, save, complete rewrite practice, and skip rewrite practice. |
| `src/shared/constants/channels.ts` | IPC channel names for journal get/save and rewrite practice complete/skip. |
| `src/shared/types/journal.ts` | Zod schemas/types for Today journal snapshots and D+1 rewrite practice snapshots. |
| `src/shared/journal/content.ts` | Journal content normalization, hashing, and local date helpers. |
| `src/main/services/journal/service.ts` | Main journal service: creates today's entry, saves revisions, marks stale review, selects one due D+1 rewrite practice, completes/skips rewrite practice. |
| `src/main/db/schema.ts` | SQLite/Drizzle tables for journal entries/revisions, review runs, corrections, self-repair attempts, reference rewrites, and rewrite tasks. |
| `drizzle/0000_foundation.sql` | Initial database schema, including journal/review/rewrite tables. |
| `drizzle/0003_rewrite_practice_fields.sql` | Adds native model sentence, spaced stage, user rewrite text, completed/skipped timestamps to rewrite tasks. |
| `src/main/services/review/lib/prompt.ts` | Current review prompt asset; explicitly asks to review a journal entry and produce structured JSON with one focus pattern, self-repair, reference rewrite, and rewrite task. |
| `src/main/services/review/lib/review-input.ts` | Builds review input with current journal content, hash, date, caps, and existing patterns. |
| `src/main/services/review/lib/input.ts` | Builds current review input and pattern examples from persisted correction history. |
| `src/main/services/review/procedures/start.ts` | Starts a review for an active journal revision; builds review prompt and invokes model adapter. |
| `src/main/services/review/procedures/preview.ts` | Loads review preview for the reviewed journal revision and computes stale status against active journal. |
| `src/main/services/review/procedures/save.ts` | Saves validated preview operations into learning-history tables and creates at most one D+1 rewrite task. |
| `src/shared/review-contract/schemas.ts` | Review contract schema; only `rewrite_original` rewrite practice kind is accepted at the review-output boundary. |
| `src/shared/review-contract/validation.ts` | Validates review output, quote anchors, caps, focus/self-repair/input-bridge references, and builds preview operations. |
| `scripts/review-contract-harness.ts` | Harness sample for journal review contract and generated rewrite practice operations. |
| `test/rewrite-practice.test.ts` | Pure contract tests for D+1 rewrite task selection, complete, skip, and max-age behavior. |
| `test/rewrite-practice-service.test.ts` | Main-service tests for complete/skip rewrite practice returning fresh Today snapshot and completed practice. |
| `test/review-save.test.ts` | Save transaction tests for rewrite task creation and exclusions. |
| `test/review-contract.test.ts` | Review validation tests, including rewrite task validation and focus correction contracts. |
| `test/review-integration.test.ts` | Integration tests for prompt safety, review input, provider adapter behavior, and JSON validation. |
| `.trellis/spec/product/mvp-scope.md` | Product scope explicitly says v0.1 is daily journaling; CET practice and Drill Center are out of scope/backlog. |
| `.trellis/spec/product/learning-flow.md` | Product learning flow contract for Today page, daily writing, review preview, and rewrite practice. |
| `.trellis/spec/product/data-model-contract.md` | Data contracts for journal revisions, review state, rewrite task kinds/statuses, and D+1 Today slot. |
| `.trellis/spec/product/review-agent-contract.md` | Review agent contract, prompt safety, input/output constraints, and runtime boundary. Includes rewrite-check deferral. |
| `.trellis/spec/product/privacy-security.md` | Privacy/security contract for local-first journal/review data and provider disclosure. |
| `.trellis/spec/product/validation-and-testing.md` | Review contract harness requirements and validation cases. |
| `.trellis/workflow.md` | Trellis development workflow and skill routing; not a product writing-practice workflow. |
| `.claude/skills/trellis-*` | Local Trellis development skills; no product CET writing practice skill was found. |

### Code Patterns

#### Current product is journal-centered

- `README.md:3-5` describes English Coach as daily journaling and says the current app focuses on one workflow: today's English journal entry and review.
- `.trellis/spec/product/mvp-scope.md:5-7` defines the product goal as a local-first desktop writing coach for Chinese native speakers who practice English through daily journaling, and states the app is not a general English-learning platform in v0.1.
- `.trellis/spec/product/learning-flow.md:47-54` defines the daily writing flow as: user writes an English journal entry, autosave stores active revision, clicking Review creates a review run for current revision/content hash, and the app validates returned JSON before showing learning results.
- `src/renderer/components/JournalEditorCard.tsx:18-37` labels the editor as `Journal editor`, title `Today's journal`, and aria-label `Today's English journal`.
- `src/renderer/components/TodayHeader.tsx:14` describes the surface as `A focused journal space with coaching only when you ask for it.`

#### Today page state flow

- `src/renderer/App.tsx:93-120` initializes Today state from `TodayJournalSnapshot`, including journal content, review state, review preview, self-repair attempt, and rewrite practice input/completion state.
- `src/renderer/App.tsx:143-174` autosaves content through `window.api.journal.saveToday({ content })` after a debounce and updates the Today snapshot.
- `src/renderer/App.tsx:176-231` starts review only when there is an active journal revision and calls `window.api.review.start({ journalEntryId, journalRevisionId })`.
- `src/renderer/App.tsx:233-245` saves current editor content before review and then reviews the saved revision.
- `src/renderer/App.tsx:247-268` saves a review preview via `window.api.review.save({ reviewRunId, selfRepairAttemptText, revealedWithoutAttempt })`; save is the learning-history persistence boundary.
- `src/renderer/App.tsx:270-307` submits or skips pending rewrite practice through `window.api.journal.completeRewritePractice` and `window.api.journal.skipRewritePractice`.
- `src/renderer/App.tsx:379-421` renders `JournalEditorCard` and `LearningPanel` as the main Today UI.

#### Learning panel flow

- `.trellis/spec/product/learning-flow.md:25-43` defines the right panel states: before writing, after writing, and after review, with one pending rewrite practice if available.
- `src/renderer/components/LearningPanel.tsx:135-141` implements Before Writing copy: today's journal is ready, start with free writing, feedback comes later, and pending rewrite practice is optional.
- `src/renderer/components/LearningPanel.tsx:254-287` implements After Writing state with `Review current journal` / retry current version.
- `src/renderer/components/LearningPanel.tsx:290-390` implements review preview with focus correction, hint-first self-repair, other corrections, reference rewrite, scheduled practice card, and save-review button.
- `src/renderer/components/LearningPanel.tsx:531-548` shows scheduled practice after review preview: `Tomorrow practice scheduled`, `One sentence saved for D+1`, prompt, and note that the input field appears when due.

#### D+1 rewrite practice implementation

- `.trellis/spec/product/learning-flow.md:123-135` states v0.1 shows at most one D+1 `rewrite_original` practice from a saved review, may appear on Today, and must not block writing.
- `.trellis/spec/product/data-model-contract.md:170-248` is the detailed executable contract for the D+1 Rewrite Practice Today Slot.
- `src/shared/types/journal.ts:27-43` defines `RewritePracticeSnapshot` with `practiceKind: 'rewrite_original'`, `spacedStage: 'D+1'`, status enum, prompt, native model sentence, dueAt, createdAt, and `isOlderThanSevenDays`.
- `src/main/services/journal/service.ts:47-48` sets the seven-day max age for the main Today slot.
- `src/main/services/journal/service.ts:98-108` selects one pending task where status is pending, kind is `rewrite_original`, dueAt is due, createdAt is within seven days, and `spacedStage === 'D+1'`.
- `src/main/services/journal/service.ts:110-123` adds the selected task to `TodayJournalSnapshot.pendingRewritePractice`.
- `src/main/services/journal/service.ts:203-229` completes a rewrite practice by trimming user input, setting `status = 'completed'`, setting `completedAt`, and returning both a fresh Today snapshot and the completed task snapshot.
- `src/main/services/journal/service.ts:232-257` skips a rewrite practice by setting `status = 'skipped'`, setting `skippedAt`, and returning a fresh Today snapshot.
- `src/renderer/components/LearningPanel.tsx:145-200` renders the due practice card: original sentence, focus pattern, prompt, input, submit, skip, and native model hidden until completed.

#### Review prompt asset and contract are journal-specific

- `src/main/services/review/lib/prompt.ts:3-5` system prompt: `You are an English writing coach for Chinese native speakers` and journal content is untrusted.
- `src/main/services/review/lib/prompt.ts:7-20` user prompt begins `Review this journal entry for actionable English learning feedback` and applies rules/caps for focus pattern, self-repair, reference rewrite, and rewrite task.
- `src/main/services/review/lib/prompt.ts:23-43` JSON shape includes `corrections`, `summary.focusPattern`, `selfRepairTask`, `inputBridge`, `referenceRewrites`, and `rewriteTasks`.
- `src/main/services/review/lib/prompt.ts:62-64` wraps writing in `<journal_content>...</journal_content>`.
- `.trellis/spec/product/review-agent-contract.md:26-44` review input type is `ReviewInput` with `journalContent` and hard caps.
- `.trellis/spec/product/review-agent-contract.md:96-110` requires one focus pattern, one self-repair task matching focus, input bridge examples, reference rewrite with `noticeTheGap`, and hidden native model for rewrite practice.
- `src/shared/review-contract/schemas.ts:17` only allows `rewritePracticeKindSchema = z.enum(['rewrite_original'])` at the review contract boundary.
- `src/shared/review-contract/validation.ts:356-395` maps validated model output into preview operations for corrections, pattern operations, reference rewrites, self-repair, rewrite practice, and input bridge.

#### Review save creates rewrite practice only from saved validated review

- `.trellis/spec/product/learning-flow.md:78-83` says review output remains preview-only until user saves it; pattern counts, rewrite practice, reference rewrite, and self-repair attempts persist only after save.
- `src/main/services/review/procedures/save.ts:59-64` parses stored preview operations and requires exactly one anchored non-low-confidence focus correction.
- `src/main/services/review/procedures/save.ts:109-118` persists reference rewrites.
- `src/main/services/review/procedures/save.ts:120-144` finds the first `rewrite_original` D+1 operation, verifies it references the focus correction and not low-confidence corrections, then inserts a pending `rewrite_tasks` row due in 24 hours.
- `src/main/services/review/procedures/save.ts:146-160` marks the review saved or stale and updates `journal_entries.last_review_run_id` only when current.

#### Database shape is generalized only around review artifacts, not writing modes

- `src/main/db/schema.ts:4-33` journal identity/revisions are named `journal_entries` and `journal_revisions`.
- `src/main/db/schema.ts:35-63` review runs reference `journal_entry_id`, `journal_revision_id`, and `content_hash`.
- `src/main/db/schema.ts:111-134` rewrite tasks include `kind` enum values `rewrite_original`, `new_context_reuse`, and `pattern_detection`, but v0.1 types and validation only surface `rewrite_original` D+1.
- `.trellis/spec/product/data-model-contract.md:83-91` documents rewrite practice kinds `rewrite_original`, `new_context_reuse`, and `pattern_detection`, with v0.1 only requiring `rewrite_original` with `D+1`.

#### CET-related implementation/docs found

- No code, tests, prompt assets, routes, UI, IPC channels, database tables, or product docs implementing CET writing practice were found.
- `.trellis/spec/product/mvp-scope.md:45-56` explicitly lists `CET practice` as v0.1 out of scope.
- `.trellis/spec/product/mvp-scope.md:75-80` lists `CET Practice` in the backlog after v0.2.
- Repository-wide CET/exam Chinese-term search found no implementation references for `CET`, `四级`, `六级`, `作文`, or `写作` outside the product-scope mentions above; matches for `exam` were only incidental words such as `example`.

#### Skill/workflow references

- `.trellis/workflow.md:133-163` contains Trellis development skill routing; it routes development/research/check tasks, not product writing-practice modes.
- `.claude/skills/trellis-*` are development workflow skills for Trellis (brainstorm/check/update-spec/etc.). They are not product-facing skill workflows.
- Search found no product implementation corresponding to an `original skill workflow` for CET writing practice inside this repository.

### External References

None. The request was internal repository research only.

### Related Specs

- `.trellis/spec/product/mvp-scope.md` — v0.1 journaling scope and explicit CET/backlog placement.
- `.trellis/spec/product/learning-flow.md` — Today page, daily journal writing, review preview, and rewrite practice contracts.
- `.trellis/spec/product/data-model-contract.md` — journal/review/rewrite persistence contracts and D+1 rewrite practice executable contract.
- `.trellis/spec/product/review-agent-contract.md` — review prompt/input/output and model-runtime boundary contracts.
- `.trellis/spec/product/privacy-security.md` — local-first review/provider disclosure and prompt injection boundary.
- `.trellis/spec/product/validation-and-testing.md` — review contract harness and validation requirements.

## Caveats / Not Found

- The current active Trellis task is not set (`task.py current --source` returned none), but the user supplied the explicit research output path.
- No CET writing practice implementation or prompt was found in the repository.
- No product-facing `skill workflow` for CET was found; the only skill/workflow references discovered are Trellis/Claude development workflow files.
- Build output under `out/` contains copied migrations and was excluded from substantive findings.
