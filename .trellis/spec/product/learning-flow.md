# Learning Flow Contract

## Core Learning Principles

- Free writing comes before correction. The editor must not use realtime redlines or auto-correction that pushes the user into exam mode.
- Feedback should be small and stable. Each review should focus on the most transferable pattern, not exhaustively list every possible issue.
- Every review must contain exactly one focus pattern.
- The focus correction uses hint-before-answer. Show a hint first, then reveal the model answer only after user attempt or explicit reveal.
- Every review must include positive evidence through at least one concrete `What you did well` item.
- Reference rewrite must support noticing-the-gap, not just show a native version.
- Long-term tracking is framed as mastery, including recurring mistakes and successful reuse.

## Today Page

Today is the default home page.

Structure:

```text
Top: Today status
Middle: Journal editor
Right: Review / learning panel
```

Right panel states:

```text
Before writing:
  - today's journal status
  - one pending rewrite practice if available

After writing:
  - Review button
  - last autosave time

After review:
  - What you did well
  - Today's focus pattern
  - Try fixing this
  - Top corrections
  - Reference rewrite / Notice the gap
  - Practice this sentence
```

The UI should prioritize the next action over completeness.

## Daily Writing Flow

- User writes an English journal entry.
- Autosave stores the active journal revision.
- A lightweight self-check can appear near Review, but it must not block review.
- Clicking Review creates a review run for the current revision and content hash.
- The app passes only the current journal, selected existing patterns, and bounded context to the review agent.
- The app validates returned JSON before showing learning results.

## Review Preview Flow

Review preview order:

```text
1. What you did well
2. Today's Focus Pattern
3. Focus correction hint
4. User self-repair attempt / reveal model
5. Other corrections
6. Reference rewrite + Notice the gap
7. Rewrite practice
```

The primary save button must communicate the consequence:

```text
Save review and update learning history
```

Do not use a vague `Save` label for the review-save action.

## Review Save Behavior

- Review output remains preview-only until the user saves it.
- Pattern counts, rewrite practice, reference rewrite, and self-repair attempts are persisted only after save.
- If the user edits the journal after a review is saved, the old review becomes stale relative to the active revision.
- A stale review may remain visible as history, but current highlighting must be driven only by the active saved review.

Stale review copy:

```text
This review is based on an earlier version of your journal.
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

v0.1 shows at most one D+1 `rewrite_original` practice from a saved review. It can appear on Today but must not block new writing.

A rewrite practice includes:

- Original sentence.
- Focus pattern.
- Input field.
- Skip action.
- Snooze action only if the task explicitly implements snooze.

v0.1 does not require the full rewrite queue or rewrite-check agent unless the task PRD says so.
