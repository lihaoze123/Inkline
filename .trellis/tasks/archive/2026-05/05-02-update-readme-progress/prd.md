# Update README Progress

## Goal

Bring `README.md` up to date with the current Inkline implementation so setup, feature, privacy, provider, quality, packaging, and project-structure notes reflect the app as it exists now.

## What I Already Know

- The user asked to edit the README so it follows the current progress.
- The project is now visibly branded as Inkline.
- The current app has a Today entry surface, Practice editor, Feedback flow, Notebook, Progress, Settings, first-launch welcome intro, and a refined sidebar/ink landscape visual treatment.
- AI generation is now backed by Vercel AI SDK provider adapters rather than hand-written provider HTTP calls.
- Settings expose OpenAI-compatible and Anthropic Claude providers with OS-keychain credentials and one global default provider/model.
- Renderer async/server-state is now organized through TanStack Query for foundation, writing, review, learning-assets, and settings flows.
- Engineering stack now includes `pnpm check`, Prettier format scripts, CI-oriented checks, packaging scripts, and app icon resources.
- The v0.2 learning-assets backlog exists but should not be represented as completed current behavior.

## Requirements

- Update README in English.
- Keep claims scoped to implemented behavior.
- Use modern README structure and presentation: concise intro, quick-start path, current status/scope, feature grouping, setup, scripts, architecture/project structure, privacy notes, and backlog boundary.
- Beautify the README with restrained Markdown affordances such as clear section order, compact tables, short paragraphs, and scannable bullets.
- Avoid flashy or decorative README styling: no emoji-heavy presentation, no noisy badge wall, no marketing-heavy copy, and no over-designed visual clutter.
- Reflect the current Inkline brand and visible app surfaces.
- Mention current provider support: OpenAI-compatible and Anthropic Claude.
- Mention AI SDK, TanStack Query, first-launch intro, app icon/resources, `pnpm check`, and current quality workflow where appropriate.
- Preserve local-first/privacy posture and current caveats about raw responses, review previews, and user writing not being auto-corrected.
- Do not document v0.2 backlog items as current features.

## Acceptance Criteria

- [x] README no longer reads like an older v0.1-only snapshot.
- [x] Feature list includes current implemented surfaces and infrastructure without overstating backlog work.
- [x] AI provider configuration instructions match the current Settings UI.
- [x] Tech stack and useful scripts match `package.json`.
- [x] Project structure includes current renderer query/assets organization and app resources where useful.
- [x] Documentation remains concise and useful for a developer opening the repo.
- [x] README follows a modern, scannable structure with quick start and clear project status.
- [x] README is visually cleaner without becoming flashy or marketing-heavy.

## Definition of Done

- README updated.
- Markdown formatting checked where practical.
- Trellis task context curated for implementation/check steps.
- No code behavior changes.

## Out of Scope

- Changing application code.
- Updating product behavior or UI copy beyond README documentation.
- Implementing v0.2 backlog features.
- Renaming internal package, database, credential service, or data paths.

## Technical Notes

- Current README: `README.md`.
- Current scripts: `package.json`.
- Current product surfaces verified in `src/renderer/App.tsx`, `src/renderer/components/SettingsPage.tsx`, and `src/renderer/components/OnboardingIntro.tsx`.
- Current provider architecture verified in `src/main/services/ai/provider.ts` and `src/shared/types/credentials.ts`.
- Relevant archived PRDs inspected: AI SDK backend, TanStack Query migration, first-launch onboarding, Inkline brand rename, ink landscape polish, sidebar visual hierarchy, app icon replacement, engineering stack completion.
- Spec update judgment: no `.trellis/spec/` update needed. This task changed only README claims, introduced no executable contracts, and the only overclaim found during review was fixed in README.
- Verification: `git diff --check -- README.md` passed after the modern-structure pass. Prettier/lint/typecheck/test could not run because `node_modules` is missing in this workspace.
