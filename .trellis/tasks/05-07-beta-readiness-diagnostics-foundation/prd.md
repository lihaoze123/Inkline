# Beta-Readiness Diagnostics Foundation

## Goal

Add a thin Settings diagnostics baseline that helps private beta users understand whether Inkline is ready to review writing: local database state, migration state, selected provider configuration, selected provider keychain status, and the existing model-output validation boundary should be visible without requiring developer intervention.

## What I Already Know

- The user asked to continue the PR 25 roadmap work after the active-pattern new-context foundation was completed and archived.
- The current task list is empty and the worktree was clean when this task was created.
- Roadmap Horizon 3 foundations are now mostly present: Drill Center foundation, CET guidance foundation, scenario packs foundation, track guidance, and optional active-pattern starter context.
- Roadmap Horizon 5 explicitly allows a thin beta-readiness baseline when it enables real user feedback.
- Settings currently has AI provider controls, review behavior controls, learning-history export controls, and a folded `Connection status` block.
- Existing `StartupStatus` already exposes `databaseReady`, `databaseLocation`, `migrationsApplied`, runtime timezone, and timezone offset.
- Existing settings snapshots already expose selected provider/model/base URL state and provider credential statuses without returning API keys to the renderer.
- Existing provider diagnostics for review/rewrite failures are persisted as bounded, secret-redacted metadata, but Settings does not yet present a clear setup/readiness checklist.
- The product must remain local-first: diagnostics must not upload writing, raw provider bodies, API keys, or filesystem data.

## Recommended MVP

Replace or extend the folded Settings connection status into a visible beta-readiness diagnostics section:

- Show an overall readiness label derived from local state only.
- Show database readiness and the local database path.
- Show migration readiness.
- Show selected provider readiness: provider name, configured model, required base URL status for `openai-compatible`, and selected provider credential status.
- Show keychain readiness using the existing selected provider credential status and storage label.
- Show that model output is guarded by the existing structured validation boundary, without running a live provider request.
- For each failed or incomplete item, show one short next action, such as save a model ID, add a base URL, save an API key, or check OS keychain access.

The diagnostics should be computed from the existing `startup` and `settings` data already loaded by the renderer. Prefer a small pure helper with unit tests over a new IPC channel unless implementation proves main-process-only information is required.

## Why This MVP

- It directly addresses the roadmap's first-run setup and local diagnostics item.
- It helps external testers diagnose common setup blockers before they try review or starter generation.
- It avoids expanding the learning loop, provider runtime, packaging, or external ecosystem.
- It keeps the privacy boundary simple because no new secrets, writing content, provider calls, or filesystem reads are introduced.

## Requirements

- Product behavior:
  - Settings shows a visible diagnostics/readiness section without requiring users to expand a low-salience details element.
  - The section must distinguish ready, setup-needed, and unavailable states.
  - The section must provide actionable next steps for incomplete provider, base URL, model, database, migration, or keychain state.
  - Copy must be concrete and user-facing; avoid developer-only terms unless they are already shown in Settings, such as database path or OS keychain.

- Data/API:
  - Reuse existing `StartupStatus` and `SettingsSnapshot` data if possible.
  - Do not add database tables, migrations, provider settings, learning events, review output fields, rewrite task kinds, or learning evidence semantics.
  - Do not return API keys or raw provider outputs to the renderer.
  - Do not run a live provider smoke test in this foundation.

- UI:
  - Keep the layout consistent with the current Settings page.
  - Avoid a heavy dashboard or marketing-style readiness score.
  - Keep repeated diagnostic rows stable and readable on desktop and narrow viewports.
  - The existing low-level connection status can remain as secondary detail if useful, but the MVP readiness state should be visible.

- Privacy/security:
  - Diagnostics must not send writing content to a provider.
  - Diagnostics must not expose raw model response bodies, Authorization headers, API keys, or unsanitized provider error text.
  - Provider/keychain state must use existing safe credential statuses.

## Acceptance Criteria

- [ ] Settings renders a visible diagnostics/readiness section.
- [ ] The section derives database and migration status from `StartupStatus`.
- [ ] The section derives selected provider, model, base URL, and keychain status from `SettingsSnapshot`.
- [ ] Missing model, missing custom base URL, missing key, unavailable keychain, database failure, and migration failure each produce a clear non-ready row and next action.
- [ ] Ready rows avoid implying that a live provider request has succeeded.
- [ ] No live provider request is performed by diagnostics.
- [ ] No API key, raw provider body, writing content, or unsanitized provider error text is displayed.
- [ ] Tests cover the pure readiness derivation and Settings render states.
- [ ] No DB schema/migration, provider runtime setting, rewrite task/evidence behavior, or learning-history format changes are added.
- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass.

## Out of Scope

- Packaging, installers, code signing, or auto-update flows.
- Real provider smoke tests or sample review calls from Settings.
- New provider adapters, runtime providers, or model selection automation.
- External sync, Anki, Obsidian, or ecosystem export changes.
- Test data reset workflows.
- Import/restore execution beyond the existing preview/export/backup surface.
- Learning-event analytics, dashboards, scores, gamification, or mastery changes.
- Any change to review, rewrite-check, D+3/D+7 generation, pattern evidence, or prompt-generation semantics.

## Confirmed Decision

- Proceed with the recommended Settings diagnostics MVP now. Treat `$trellis-continue` on 2026-05-07 as confirmation to start implementation after curated context validation.

## Open Question

- None.

## Definition of Done

- PRD and implementation context are curated.
- User confirms the recommended MVP.
- Trellis implementation and quality review run for this task.
- Tests added or updated for changed behavior.
- Lint, typecheck, and tests pass.
- Spec docs updated if the diagnostics contract should become durable project knowledge.
- Work commits are created before finish-work archival/journal commits.

## Technical Notes

- Files inspected:
  - `.trellis/spec/product/roadmap.md`
  - `.trellis/spec/product/mvp-scope.md`
  - `.trellis/spec/product/privacy-security.md`
  - `.trellis/spec/product/validation-and-testing.md`
  - `src/shared/types/app.ts`
  - `src/main/ipc/handlers.ts`
  - `src/renderer/query/foundation.ts`
  - `src/renderer/components/SettingsPage.tsx`
  - `src/shared/types/settings.ts`
  - `src/main/services/credentials/service.ts`
- Current Settings `Connection status` already shows default provider, model, selected provider key, local model flag, review context, database, migrations, pi-mono, and AnkiConnect.
- Existing `StartupStatus` has enough data for database, migration, database path, and timezone display.
- Existing credential status uses safe values such as configured/not-configured/unavailable and storage, without exposing the key.
