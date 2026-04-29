# AI review observability MVP

## Goal

Improve terminal-user-facing observability for the AI review flow so users can see what review is doing, understand whether it is slow or failed, and trust which successful outputs are reliable without exposing private journal content or raw model data.

## Requirements

- Add an inline review status card near the Review action in the LearningPanel.
- Drive review progress from real main-process progress events rather than fake frontend percentages.
- Use five user-understandable review phases:
  - `preparing`: organizing the journal entry and learning context.
  - `requesting`: sending the request to the AI provider.
  - `waiting`: waiting for the AI provider response.
  - `checking`: validating whether AI suggestions are reliable.
  - `building_preview`: building the saveable preview.
- Show elapsed time during review and a slow-response hint when the provider is still processing.
- Persist a structured review summary for each run.
- Keep provider/model/base URL folded into Details by default; surface them in primary copy only for configuration or connection failures.
- On success, show a lightweight quality summary above the preview:
  - anchored correction count.
  - low-confidence suggestion count.
  - focus pattern.
  - generated learning asset counts.
  - warning explanation when filtered suggestions are present.
- On failure, show actionable human-readable error copy by default, with technical metadata only in Details.
- Error categories should include `missing_config`, `provider_error`, `timeout`, `invalid_json`, `validation_failed`, and `stale_content` where applicable.
- Details must expose structured metadata only: run id, provider/model, phase timings, duration, provider status/error category, validation warning count, correction stats, asset counts, and whether raw output was saved.
- Do not show prompt text, journal content, or raw model response in the main UI.
- Retry always reviews the current editor content and creates a new review run.
- Review does not lock the editor; if content changes during review, completion should surface stale state and guide users to review the current version.
- Warnings do not block saving, but the UI must explain which suggestions are filtered or not saved.
- Save status remains separate from the AI review progress timeline and receives only lightweight status/summary messaging.
- Enforce one active review in the renderer; progress events should include run identity and the renderer should ignore stale events.

## Acceptance Criteria

- [ ] During a successful review, the user sees the real phase sequence and elapsed time in an inline status card.
- [ ] If provider response is slow, the UI displays a non-blocking slow-response hint.
- [ ] After a successful review, the preview includes a quality summary with anchored, low-confidence, focus, warning, and generated asset information.
- [ ] If review output has warnings, save remains available and low-confidence/filtered suggestions are explained.
- [ ] Missing API key/config failures show actionable settings-oriented copy.
- [ ] Provider timeout failures show actionable retry-oriented copy and Details include timeout/error metadata.
- [ ] Malformed/invalid model output shows actionable copy and Details include parse/validation metadata.
- [ ] If the journal changes while review is in progress, completion shows stale guidance and Retry reviews the current version.
- [ ] Review summaries are persisted with duration/phase timings/result/error/stats/raw-saved metadata.
- [ ] Details do not expose prompt text, journal content, or raw model response.
- [ ] Progress events from older runs do not override the active review state.
- [ ] Tests cover success, timeout/provider failure, invalid JSON or validation failure, warning/low-confidence summary, and stale review behavior.

## Definition of Done

- Tests added or updated for shared contracts, main-process review flow, IPC/preload wiring where practical, and renderer summary/error behavior where existing test harness supports it.
- Typecheck passes.
- Lint passes if configured for the touched code.
- Existing review persistence and save invariants remain intact: preview does not write learning history until save, save is atomic/idempotent, and low-confidence corrections are not saved as accepted corrections.
- Manual UI verification covers the review happy path and at least one failure/stale path if the app can be run locally.

## Technical Approach

1. Define shared `ReviewProgressEvent` and `ReviewRunSummary` contracts using existing shared schema/type patterns.
2. Add a main-process progress reporting seam for `startReview`, emitting phase events with run identity and timestamps.
3. Capture phase timings and final summary during `startReview`; persist the structured summary on `review_runs` with a schema migration.
4. Extend IPC channel constants, preload API, and renderer global types to support progress subscription.
5. Update `App`/`LearningPanel` state to track active review progress, ignore stale run events, render the inline status card, success quality summary, failure card, and folded Details.
6. Keep save observability separate and lightweight, enhancing only the existing save status copy if needed.
7. Update tests around the review procedure, provider adapter error mapping, persistence decision/summary mapping, and UI utilities/components as appropriate.

## Decision (ADR-lite)

**Context**: The review flow already persists final statuses and validation data, but users cannot see which step is running, why a review is slow, or why some AI output was filtered.

**Decision**: Implement real backend phase events plus persisted structured summaries, and render them as terminal-user-facing inline UI. Keep sensitive content and raw model data out of the visible Details surface.

**Consequences**: This adds cross-layer contract and IPC work plus a DB migration, but avoids fake progress and creates a foundation for future history/debug UI without building that history UI in this MVP.

## Out of Scope

- Full review history list or debug drawer.
- True cancellation of in-flight provider calls.
- Concurrent active reviews.
- Displaying prompt text, journal content snapshots, or raw model response in the main UI.
- Token usage as a required MVP metric.
- Explaining why the AI did not find additional issues beyond reporting what the app received, validated, filtered, and saved.
- Combining save operations into the AI review progress stepper.

## Technical Notes

- Existing renderer review state starts in `src/renderer/App.tsx` and renders review UI through `src/renderer/components/LearningPanel.tsx`.
- Existing IPC review channels live in `src/shared/constants/channels.ts`, `src/preload/index.ts`, and `src/main/ipc/handlers.ts`.
- Existing main review procedure is `src/main/services/review/procedures/start.ts`.
- Existing review validation and preview operations are in `src/shared/review-contract/validation.ts`.
- Existing review run schema is in `src/main/db/schema.ts` and already stores status, provider/model, input snapshot, raw output, parsed output, preview operations, validation errors, and timestamps.
- Product constraints come from `.trellis/spec/product/review-agent-contract.md`, `.trellis/spec/product/data-model-contract.md`, `.trellis/spec/product/privacy-security.md`, and `.trellis/spec/product/learning-flow.md`.
- Relevant implementation guides include backend API module/database/error/type-safety/quality, frontend IPC/React pitfalls/components/type-safety, shared TypeScript/code-quality/timestamp, and guides for cross-layer and DB schema changes.
