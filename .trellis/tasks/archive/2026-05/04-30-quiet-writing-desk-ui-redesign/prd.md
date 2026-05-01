# Quiet Writing Desk UI Redesign

## Goal

将 English Coach 重设计为一个“安静书桌式”的 AI 英语写作练习产品。用户打开应用后，应快速进入 Today → Writing Workspace → Feedback & Rewrite → Notebook 的学习闭环：选择今日写作主题，独立完成一段英文，获得温和且聚焦的 AI 教练反馈，自己改写，再把可复用表达沉淀到轻量表达库。

本次重设计的核心不是“美化 UI”，而是修正产品气质：从 AI 工具 / SaaS 后台 / 考试批改系统，转向一张安静、有陪伴感、适合长期练习的英文写作书桌。

## Product Positioning

English Coach 是面向中文母语学习者的 AI English Writing Practice Coach。

产品应帮助用户：

* 敢写英文，而不是一开始就被纠错打断。
* 独立完成表达，而不是让 AI 替用户写。
* 通过少量、稳定、可迁移的反馈理解自己的问题。
* 通过 self-repair / rewrite 真正练习改写。
* 保存有用表达，形成自己的表达积累。

产品不是：

* ChatGPT 对话窗口。
* CET/雅思 mock exam 系统。
* 分数驱动的作文批改器。
* 功能密集的 Dashboard。
* 过度游戏化打卡产品。

## Current Context From Specs

* `.trellis/spec/product/mvp-scope.md` defines the app as a local-first desktop AI writing practice app for Chinese native speakers.
* Existing product loop: choose practice template → optional starter prompt/topic → independent writing → focused AI review → self-repair → reference rewrite → save learning history → D+1 rewrite practice.
* Journal, CET-4 Writing, CET-6 Writing, and Free Writing are equal practice templates under the broader Writing Practice product identity.
* v0.1 explicitly excludes mock-exam mode, timers, word-count pressure, precise CET scores, live suggestions, in-editor co-writing, complex dashboards, and full history/progress pages.
* `.trellis/spec/product/learning-flow.md` requires free writing before correction, no realtime redlines/autocorrect/live suggestions, exactly one focus pattern per review, hint-before-answer, at least one concrete `What you did well`, reference rewrite for noticing-the-gap, and D+1 rewrite as a differentiator.
* A shell-level Today page is allowed if it routes users into Writing Practice instead of replacing the product identity.

## MVP Requirements

### 1. App Shell & Information Architecture

The app should use a stable desktop-style shell:

```text
Sidebar
  English Coach
  Today
  Practice
  Notebook
  Progress
  Settings

Main Content
  Current page content
```

Requirements:

* Fixed left sidebar with calm navigation.
* Main content area uses generous whitespace and a max readable width.
* Decorative botanical / landscape illustration may be represented by a minimal placeholder only; final artwork will be supplied separately and must not drive extra UI features.
* Navigation labels should make Practice/Writing identity clear.
* Today may be the launch surface, but Practice remains the product identity.
* Avoid dense dashboard widgets and excessive card grids.

### 2. Today Page

Purpose: help users start writing within 5 seconds.

Content:

* Warm greeting, e.g. `Good evening, Chumeng.`
* Subcopy, e.g. `Ready to write a little in English today?`
* Primary Today’s Practice module.
* One clear `Start Writing` CTA.
* Optional Continue Last Draft module.
* Lightweight Recent Progress module.
* Lightweight Recent Expressions module.

Today’s Practice should show:

* Prompt title.
* Practice scenario/template.
* Start Writing CTA.

Do not add concept-art-only metadata such as estimated time, difficulty, honor/status labels, or focus chips unless product specs explicitly introduce them.

Constraints:

* Do not show precise exam scoring.
* Do not make the page feel like a metrics dashboard.
* Do not over-emphasize streaks or gamification.

### 3. Practice / Writing Workspace

Purpose: make writing feel quiet, independent, and paper-like.

Layout:

```text
Breadcrumb / Context
Prompt title
Template context
Short writing instruction

Large writing editor
  Draft title
  Writing area
  Autosave status

Optional secondary hints only when grounded in the current product flow

Finish later
Get Feedback
```

Requirements:

* Writing editor is the visual center.
* The editor should feel like a sheet of paper, not a database form.
* No realtime redlines, live suggestions, or autocorrect UI.
* AI suggestions must not interrupt the act of writing.
* Hints are secondary, minimal, and must not invent lesson metadata not present in the product flow.
* Autosave status should be calm: `Saving...` → `Saved just now`.
* The primary action is `Get Feedback`.
* `Finish later` is secondary.

Writing text style:

* 17–18px text.
* 1.65–1.8 line-height.
* Serif or reading-friendly writing font.
* Large padding.
* Stable scroll behavior.

Focus mode:

* Optional first implementation.
* When enabled or when user starts typing, reduce visual noise: dim sidebar/secondary panels, hide decorative art, emphasize editor.
* It must not become a forced fullscreen mode.

### 4. Feedback & Rewrite Page

Purpose: turn AI review into a coach-led rewrite loop, not a correction report.

Layout:

```text
Feedback & Rewrite
Coach summary sentence

Left column
  Overall feedback
  What you did well
  Focus pattern / Top improvement
  Original draft with gentle highlights
  Hint-before-answer self-repair
  Reference rewrite / Notice the gap

Right column
  Try rewriting editor
  Rewrite autosave/status
  What improved
  Useful expressions

Back to draft
Compare rewrite
```

Requirements:

* Feedback must be small, stable, and focused.
* Exactly one focus pattern should remain the core review concept.
* The UI may present “Top improvements” visually, but implementation must not violate the one-focus-pattern contract for v0.1.
* Include at least one concrete positive item (`What you did well`).
* Use hint-before-answer: user sees a hint before model answer / reference phrasing.
* Reference rewrite supports noticing-the-gap; it is not framed as the only correct answer.
* Rewrite editor should make user action obvious.
* `Compare rewrite` should produce positive, specific feedback about what improved.
* Useful expressions can be extracted from reference/rewrite and saved.

Highlighting rules:

* Use soft yellow/green/orange backgrounds.
* Avoid harsh red squiggles.
* Avoid making the user feel graded or shamed.
* Hover/focus explanations should be short labels or small notes, not large popovers.

### 5. Notebook / Expression Bank

Purpose: preserve reusable expressions without becoming a complex knowledge base.

Content:

* Saved expressions.
* Better alternatives.
* Common mistakes only if they naturally come from review output.
* Source practice context.
* Optional tags: Journal, CET-4, CET-6, Free Writing, Workplace, Opinion.

Expression card fields:

* English expression.
* Chinese meaning or explanation.
* Usage scenario.
* Source practice.
* Save/unsave and copy actions.

Constraints:

* Use cards/list, not tables.
* Keep the page lightweight.
* Do not build a full error-pattern analytics system in this task unless explicitly chosen.

### 6. Settings Page

Purpose: make provider, credential, and privacy configuration readable without turning Settings into a dense admin dashboard.

Requirements:

* Keep Settings visually secondary to the writing flow while remaining easy to scan.
* Use flat sections, thin dividers, and calm typography instead of stacked cards.
* Show provider credential status as quiet text, not badges or status chips.
* Preserve all required provider/privacy information from product specs: default provider, provider/model config, keychain status, database location, pi-mono status, raw response storage, and reserved AnkiConnect status.
* Raw response storage must remain clearly warned as potentially containing writing content.
* Do not add new provider features or debugging affordances in this visual pass.

### 7. Progress Page

Purpose: show gentle growth, not pressure.

Content may include:

* This week’s practice count.
* Rewrite completion count.
* Expressions saved.
* Recent writing history.
* Coach-style growth note.

Constraints:

* For v0.1 alignment, Progress can be a lightweight placeholder or shell-level summary unless we explicitly include full persistence/history in this task.
* No rankings, heavy charts, precise scoring, or exam pressure.

## Visual Design System

### Experience Keywords

* Calm.
* Focused.
* Editorial.
* Warm.
* Lightweight.
* Trustworthy.
* Writing-first.

### Color Tokens

Recommended base palette:

```text
Global background: #FAF9F6
Card background:   #FFFFFF
Soft section bg:   #F4F3ED

Primary text:      #2D3142
Secondary text:    #7D8597
Muted text:        #A0A4AE

Primary action:    #1B4365
Primary hover:     #153650

Soft green bg:     #E8F3EB
Soft green text:   #2A7E4B

Soft yellow bg:    #FCF3D9
Soft yellow text:  #997300

Soft red/orange bg:#FBEBEB
Soft red/orange text:#A33B3B
```

Rules:

* Use deep sea-blue for the primary CTA only.
* Avoid high-saturation gradients.
* Avoid large purple/blue SaaS backgrounds.
* Use red sparingly and softly.

### Typography

Recommended:

* Headings: `Lora`, `Merriweather`, `Playfair Display`, or system serif fallback.
* Body/UI: `Inter`, `SF Pro`, `Aptos`, `Segoe UI Variable`, or system sans-serif.
* Writing surface: `Iowan Old Style`, `Palatino Linotype`, `Georgia`, or serif fallback.

Rules:

* Large page titles use serif for editorial warmth.
* UI controls use sans-serif for clarity.
* Long writing text should be comfortable for English paragraphs.

### Shape, Borders, Shadows

* Small controls: 8px radius.
* Cards/panels: 12–16px radius.
* Avoid pill-shaped everything.
* Prefer fine borders over heavy shadows.
* Shadows only for floating overlays or subtle emphasis.

Recommended styles:

```css
border: 1px solid rgba(0, 0, 0, 0.06);
box-shadow: 0 8px 30px rgba(0, 0, 0, 0.04);
```

### Spacing

* Whitespace is a feature.
* Default page gutters should feel spacious on desktop.
* Avoid packing multiple dense widgets into the same row.
* Writing and feedback surfaces should have large inner padding.

### Iconography & Illustration

* Use thin-line icons such as Lucide-style icons.
* Illustration direction: botanical, paper, ink landscape, desk objects.
* Illustration must not become the main content.
* Avoid childish mascot style.

## Interaction Requirements

### Autosave

* Draft and optional user goal/topic autosave should remain visible and reassuring.
* State copy: `Saving...`, `Saved just now`, `Could not save. Retry`.

### Calm AI Loading

AI feedback loading should avoid aggressive spinners.

Preferred copy:

* `Reading your draft...`
* `Finding one useful pattern...`
* `Preparing your rewrite practice...`

Use skeleton/shimmer only if subtle.

### Rewrite Comparison

After user rewrites:

* Show what improved in 1–3 concrete points.
* Extract useful expressions.
* Encourage saving expressions.
* Avoid assigning a score.

### Accessibility

* Maintain sufficient contrast for text and controls.
* Highlight colors must not be the only carrier of meaning.
* Buttons must have clear labels.
* Focus states must be visible but calm.
* Keyboard navigation should remain possible.

## Technical Approach

### Existing Stack Constraint

Reuse the existing app stack:

* Electron Forge + Vite desktop app.
* React 19 + TypeScript renderer.
* Tailwind CSS v4 + daisyUI currently configured.
* TanStack Query for renderer state/data fetching.
* Existing typed `window.api` preload surface for writing/settings/review.
* Existing local-first persistence and review contracts.

Do not migrate to Next.js/Nuxt or replace the stack for this redesign.

### Implementation Direction

Recommended phased implementation:

1. Restyle app shell and global design tokens.
2. Reshape Today / Practice entry into the quiet writing-desk layout.
3. Restyle writing editor into the paper-like workspace.
4. Restyle review panel into Feedback & Rewrite flow while preserving existing learning-flow contracts.
5. Add lightweight Notebook/Progress shells only if chosen for MVP.

### Editor Strategy

For MVP:

* Keep the current editor approach unless implementation discovers a blocker.
* Use textarea/paper-like styling for writing comfort.
* Preserve autosave and review behavior.

Later:

* Consider a headless rich text editor only if inline annotation, hover notes, and diffing require it.
* Do not introduce Tiptap/ProseMirror in this task unless explicitly chosen.

## Decision (ADR-lite)

### Context

The product needs a major UI/UX shift, but the existing codebase already contains the local-first writing practice loop, autosave, review contracts, rewrite practice, Tailwind, and Electron shell. A technology rewrite would delay the learning experience improvements.

### Decision

Use the existing React/Vite/Electron/Tailwind architecture and focus the redesign on product flow, visual hierarchy, interaction tone, and component restructuring. Treat the reference images as design direction, not as a mandate to replace the stack.

### Consequences

* Faster implementation and lower risk.
* Existing review/self-repair contracts remain intact.
* Some advanced editorial interactions may be staged later.
* UI work must respect current v0.1 learning-flow boundaries, especially no live suggestions and no exam-pressure features.

## Acceptance Criteria

* [ ] App shell presents a quiet left navigation and spacious main writing area.
* [ ] Today page clearly routes users into writing practice with one primary Start Writing CTA.
* [ ] Practice/Writing page emphasizes independent writing and preserves autosave.
* [ ] Writing page does not show realtime redlines, live suggestions, AI co-writing, scoring pressure, or mock-exam UI.
* [ ] Feedback & Rewrite page presents coach-like feedback, at least one positive item, one focused improvement path, reference rewrite, and user rewrite action.
* [ ] Review UI preserves hint-before-answer and noticing-the-gap behavior from existing specs.
* [ ] Notebook direction is defined as lightweight expression saving, not a full knowledge base.
* [ ] Progress direction is gentle growth, not analytics dashboard or ranking.
* [ ] Settings page uses flat sections and quiet status text while preserving provider, credential, privacy, database, pi-mono, and AnkiConnect visibility.
* [ ] Visual design uses warm white surfaces, serif headings, deep sea-blue primary CTA, low-saturation highlights, restrained borders, and generous spacing.
* [ ] PRD explicitly excludes ChatGPT chat bubbles, harsh correction UI, exam scoring, timers/word-count pressure, and heavy dashboards.
* [ ] Implementation plan reuses current React/Vite/Electron/Tailwind stack.

## Out of Scope

* Replacing Electron/Vite/React with a web framework migration.
* Building a ChatGPT-style conversation UI.
* Building full exam mock mode, precise CET scoring, timers, or word-count pressure.
* Live writing suggestions, realtime redlines, in-editor AI co-writing, or autocorrect.
* Heavy gamification, rankings, badges, or streak pressure.
* Full long-term analytics dashboard.
* Full expression persistence / Notebook implementation beyond lightweight placeholder or read-only summary.
* Full Progress / History implementation beyond lightweight placeholder or read-only summary.
* Full error-pattern system unless scoped as a separate v0.2 task.
* Introducing a complex rich-text editor solely for visual polish.

## Open Questions

* None for the current PRD. MVP scope is confirmed as Option A: Visual Core Loop Only.

## Expansion Sweep

### Future Evolution

* This UI can evolve into a broader learning system with D+1/D+3/D+7 rewrite practice, expression reuse, and recurring pattern tracking.
* The visual system should preserve room for later learning surfaces without turning the current MVP into a dashboard.

### Related Scenarios

* Template switching must remain consistent across Today and Practice.
* CET templates should feel like writing practice scenarios, not exam simulations.
* Review stale-state handling must remain clear when users edit after receiving feedback.

### Failure & Edge Cases

* Starter prompt/review provider disclosures must remain visible before provider calls.
* Failed AI generation should offer retry, not local fake fallback content.
* If review is stale for current writing, UI should direct user to review the latest version.
* Autosave failures need calm, actionable recovery.

## MVP Scope Options

### Option A: Visual Core Loop Only (Selected MVP)

Includes:

* App shell redesign.
* Today entry.
* Writing workspace.
* Feedback & Rewrite restyling using existing review/rewrite data.
* Notebook/Progress as lightweight navigation placeholders or minimal read-only summaries.

This is the confirmed MVP implementation scope.

Pros:

* Fastest path to validate the new product feeling.
* Lowest risk to existing learning contracts.
* Avoids overbuilding secondary persistence.

Cons:

* Expression Bank is not fully functional yet.
* Progress remains light.

### Option B: Core Loop + Lightweight Notebook

Includes Option A plus:

* Save useful expressions from review/rewrite into a simple Notebook view.
* Basic expression card list.

Pros:

* Completes the visible write → feedback → save expression loop.
* Stronger sense of learning accumulation.

Cons:

* Requires additional persistence/UI decisions.
* Slightly more scope before validating main UI direction.

### Option C: Full Product Shell

Includes Option B plus:

* More complete Progress page.
* Recent writing history.
* More detailed expression tagging/filtering.

Pros:

* Feels more complete as a product demo.

Cons:

* Highest risk of drifting into dashboard/product bloat.
* Conflicts with v0.1 out-of-scope history/progress constraints unless carefully limited.

## Implementation Plan

### PR1: App shell and design tokens

* Update global theme tokens toward warm white, deep sea-blue, low-saturation highlights, restrained radius, and editorial typography.
* Reshape the shell into stable left navigation plus spacious main content.
* Keep Settings accessible without making it visually dominant.

### PR2: Today and Writing Workspace

* Build the Today entry surface with one primary Start Writing CTA.
* Restyle the writing editor into a paper-like workspace.
* Preserve existing template selection, autosave, starter prompt, disclosure, and review entry behaviors.
* Keep hints secondary and avoid live suggestions/redlines.

### PR3: Feedback & Rewrite restyle

* Restyle review output into coach-like Feedback & Rewrite layout.
* Preserve exactly-one-focus-pattern, hint-before-answer, What-you-did-well, reference rewrite, and D+1 rewrite behavior.
* Add lightweight Notebook/Progress navigation placeholders or read-only summaries only within Option A scope.

## Technical Notes

* Task directory: `.trellis/tasks/04-30-quiet-writing-desk-ui-redesign/`.
* Product scope: `.trellis/spec/product/mvp-scope.md`.
* Learning flow contract: `.trellis/spec/product/learning-flow.md`.
* Current renderer app: `src/renderer/App.tsx`.
* Current renderer styles: `src/renderer/styles.css`.
* Current main renderer components include `PracticeHeader`, `PracticeTemplatePicker`, `WritingEditorCard`, `LearningPanel`, `ReviewDisclosureDialog`, and `SettingsPage`.
* Existing scripts: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm review:harness`, `pnpm check`.
* Current package description: `Local-first AI writing practice desktop app.`
