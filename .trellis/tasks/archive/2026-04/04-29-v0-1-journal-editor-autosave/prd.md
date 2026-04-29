# v0.1 journal editor and autosave

## Goal

Implement the Today journal writing experience with autosave and content revisions while preserving the annotation model required for later correction highlighting.

## Requirements

- Implement Today as the default page with a journal editor and right-side learning panel shell.
- Store journal identity in `journal_entries` and text versions in `journal_revisions`.
- Normalize line endings to LF and compute `content_hash` for each saved revision.
- Autosave journal edits without triggering review or correction changes.
- Track active revision and stale review state when content changes after a saved review.
- Keep the user's original journal text intact; do not auto-apply corrections.
- Use an annotation-safe editor path. v0.1 may start simple, but data structures must support highlighting by offsets without mutating text.
- Show last autosave time after writing.

## Acceptance Criteria

- [ ] User can create/edit today's journal.
- [ ] Edits autosave to a new or updated active revision.
- [ ] Saved content uses LF-normalized hashing.
- [ ] Existing saved review becomes stale after active content changes.
- [ ] Stale review UI can show the required historical-review copy.
- [ ] Journal text is never overwritten by review suggestions.
- [ ] The right panel shows the appropriate before/after-writing states.

## Definition of Done

- Tests cover revision creation, content hashing, and stale-review transition.
- Manual UI check covers creating a journal, autosave, reload, edit-after-review stale state where applicable.
- Typecheck and lint pass.

## Technical Approach

Model journal text as versioned content from the start. Build editor rendering separately from correction annotations so later highlighting can map UTF-16 offsets to editor positions.

## Out of Scope

- Live review agent calls.
- Full correction list rendering.
- Apply correction.
- Complete rewrite queue.

## Technical Notes

- Product references: `.trellis/spec/product/learning-flow.md`, `.trellis/spec/product/data-model-contract.md`.
- Frontend references: `.trellis/spec/frontend/components.md`, `.trellis/spec/frontend/state-management.md`.
