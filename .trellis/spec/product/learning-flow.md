# Learning Flow Contract

## Core Learning Principles

- Free writing comes before correction. The editor must not use realtime redlines, live suggestions, or auto-correction that pushes the user into exam mode.
- AI can design starter prompts/topics and post-writing feedback, but it must not replace the act of writing.
- Feedback should be small and stable. Each review should focus on the most transferable pattern, not exhaustively list every possible issue.
- Every review must contain exactly one focus pattern.
- The focus correction uses hint-before-answer. Show a hint first, then reveal the model answer only after user attempt or explicit reveal.
- Every review must include positive evidence through at least one concrete `What you did well` item.
- Reference rewrite must support noticing-the-gap, not just show a native version.
- D+1 rewrite practice is a core differentiator; the product must not feel like a one-off correction tool.

## Scenario: Practice Entry and Template Flow

### 1. Scope / Trigger

- Trigger: Any task that changes the main entry page, template picker, writing editor state, starter prompt controls, review entry point, or rewrite practice panel.
- Practice is the product entry. Journal, CET-4 Writing, CET-6 Writing, and Free Writing are equal templates, not separate product modes.

### 2. Signatures

Template IDs:

```ts
type WritingTemplateId = 'journal' | 'cet4' | 'cet6' | 'free';
```

Main renderer surfaces:

```text
PracticeHeader
PracticeTemplatePicker
WritingEditorCard
LearningPanel
ReviewDisclosureDialog(mode = 'starter' | 'review')
```

Writing actions:

```ts
window.api.writing.getCurrentAttempt(): Promise<WritingAttemptSnapshot>;
window.api.writing.getWritingAttempt({ templateId }): Promise<WritingAttemptSnapshot>;
window.api.writing.saveWritingAttempt({ templateId, content, userGoal }): Promise<SaveWritingAttemptResult>;
window.api.writing.generateStarterPrompt({ templateId, userGoal }): Promise<GenerateStarterPromptResult>;
```

### 3. Contracts

- The product identity is `Writing Practice`; Journal, CET, and Free Writing must remain equal practice scenarios.
- A shell-level `Today` page may be the default launch surface when it routes users into writing practice instead of replacing Practice as the product identity.
- The picker shows Journal, CET-4 Writing, CET-6 Writing, and Free Writing as same-level cards.
- Template selection may primarily live on Today/Home, but the Write/Practice workbench must still show the current template and provide lightweight switching.
- Lightweight switching may be collapsed or subtle by default, but must still call `getWritingAttempt({ templateId })` when the user changes scenario.
- Before switching templates, persist the current template's unsaved content and optional goal/topic so the current draft is not lost.
- Selecting a template loads that template's current attempt and resets review preview/progress state for the previous template.
- Each template preserves one current draft.
- Every template supports starter prompt/topic generation, regenerate, retry after failure, and skip.
- Starter prompt/topic and optional goal/topic controls may be collapsed by default to protect independent writing, but generation, regenerate, retry, skip, and goal editing must remain reachable in the Practice workbench.
- Users may provide an optional goal/topic whether or not they generate a starter prompt.
- Autosave freshness includes both writing content and optional goal/topic; changing only the goal/topic must still persist the writing attempt.
- Before generating a starter prompt/topic, persist any unsaved content or goal/topic so the attempt state and provider context are fresh.
- CET editor surfaces must not show timers, word-count targets, precise scores, or mock-exam UI in v0.1.
- Review input is template-aware and includes generated prompt/topic and user goal/topic when present.
- The writing editor stays independent: no in-editor co-writing or live suggestions.

### 4. Validation & Error Matrix

| Condition | Behavior |
| --- | --- |
| User selects a new template | Load `getWritingAttempt({ templateId })`; clear stale review preview/progress and starter generation error. |
| User edits only optional goal/topic | Autosave `saveWritingAttempt({ templateId, content, userGoal })`; do not wait for draft text changes. |
| User starts starter generation with unsaved edits | Save the current content and user goal/topic first, then call `generateStarterPrompt({ templateId, userGoal })`. |
| Starter prompt generation is skipped | Keep editor usable; review may still include optional `userGoal`. |
| Starter prompt generation fails | Show error with Retry; do not use local fallback topics. |
| Starter prompt disclosure not accepted | Show disclosure; do not call provider. |
| User edits content after review | Mark old review stale and offer review-current-version action. |
| Review preview is ready while user is in Practice | Keep the Practice workspace editor-first; show a short ready state plus an explicit action to open the focused Feedback & Rewrite page. Do not auto-route or render a heavy inline review preview. |
| User reviews non-Journal template | Review, preview, save, and post-action refresh remain on that template. |

### 5. Good/Base/Bad Cases

- Good: User lands on Today, selects CET-6, enters Write/Practice, generates an English topic, writes independently, reviews, saves, and remains in CET-6 after save.
- Base: User picks Free Writing, skips generation, enters a goal, writes, and reviews with goal context.
- Base: User edits only the optional goal/topic and sees it preserved after switching away and back.
- Base: User switches from Journal to CET-4 and back; each draft is preserved.
- Bad: Template picker visually or structurally makes Journal or CET dominate the product identity.
- Bad: Editor says `journal entry` while the selected template is CET or Free Writing.
- Bad: Starter generation is mandatory before writing.
- Bad: The app calls starter generation using stale attempt state after the user changed the draft or goal/topic.

### 6. Tests Required

- Template selection test: switching templates loads distinct attempts and preserves drafts.
- Optional goal/topic autosave test: changing only `userGoal` persists through `saveWritingAttempt({ templateId, content, userGoal })`.
- Starter prompt freshness test: unsaved content/goal is saved before `generateStarterPrompt({ templateId, userGoal })` runs.
- Starter prompt state test: disclosure, generate, regenerate, retry, and skip states behave correctly.
- Review context test: non-Journal template review includes template context and stays on selected template after preview/save.
- Regression/manual test: Journal write -> review -> save -> D+1 rewrite remains available through the Journal template.
- Manual UI smoke: Today -> template picker -> Write, starter disclosure, generate/regenerate, skip, optional goal, editor autosave, review, save review, due D+1 rewrite practice.

### 7. Wrong vs Correct

#### Wrong

```tsx
<h1>Today's Journal</h1>
<JournalEditor />
<button>Review journal entry</button>
```

This makes Journal the product identity and leaks old assumptions into CET/Free Writing.

#### Correct

```tsx
<PracticeHeader selectedTemplateTitle={writing.template.title} />
<PracticeTemplatePicker templates={WRITING_TEMPLATES} />
<WritingEditorCard template={writing.template} />
<button>Review current writing</button>
```

Practice is the product entry, and the selected template supplies scenario-specific framing.

## Review Preview Flow

Default review surfaces should stay focused on:

```text
1. Overall coach note with positive evidence
2. Exactly one focus pattern
3. Focus correction hint
4. User self-repair attempt / reveal model
5. Reference rewrite + Notice the gap when available
6. Save-review boundary
```

Secondary review details, additional corrections, technical review metadata, and scheduled rewrite-practice details should be behind a low-priority disclosure unless a task explicitly asks for a denser diagnostic view. D+1 rewrite practice remains part of the product contract, but it must not compete with independent writing in the default workspace.

The primary save button must communicate the consequence:

```text
Save review and update learning history
```

Do not use a vague `Save` label for the review-save action.

## Review Save Behavior

- Review output remains preview-only until the user saves it.
- Pattern counts, rewrite practice, reference rewrite, and self-repair attempts are persisted only after save.
- If the user edits the writing after a review is saved, the old review becomes stale relative to the active revision.
- A stale review may remain visible as history, but current highlighting must be driven only by the active saved review.

Stale review copy:

```text
This review is based on an earlier version of your writing.
Review current version
```

## Correction Presentation

Each correction must show at least:

```text
Pattern: <rule>
You wrote: <original>
Try: <corrected>
Why: <explanation>
```

Correction categories in the UI:

- Fix: there is an error.
- Upgrade: not wrong, but more natural.
- Model: reference expression, not required to copy.

v0.1 does not enable upgrade opportunities. Do not mix upgrade opportunities into the correction list.

## Sorting Corrections

Sort by learning priority:

1. Recurring + high learning value.
2. Meaning-affecting errors.
3. Common grammar/collocation issues.
4. Style upgrade.
5. Spelling.

Low-confidence corrections are folded into `Other suggestions`; they do not update pattern count or generate rewrite practice.

## Rewrite Practice

v0.1 shows at most one D+1 `rewrite_original` practice from a saved review. It can appear in Practice but must not block new writing.

A rewrite practice includes:

- Original sentence.
- Focus pattern.
- Input field.
- Skip action.
- Snooze action only if the task explicitly implements snooze.

v0.1 does not require the full rewrite queue or rewrite-check agent unless the task PRD says so.
