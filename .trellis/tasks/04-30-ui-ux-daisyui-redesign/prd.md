# brainstorm: daisyUI UI/UX redesign

## Goal

全面重构当前 English Coach 的所有现有 UI，使用 daisyUI/Tailwind 作为成熟 UI 基础，并重点优化日常写作、复盘、自我修复、D+1 复写和设置管理的 UX。目标不是新增大功能，而是把现有单页 Today 工作流做成更清晰、更少干扰、更像学习产品的桌面体验。

## What I already know

* 用户明确要求：使用成熟 UI 库 daisyUI，并全面重构当前所有 UI。
* 用户明确要求：重点优化 UX，而不是只换视觉样式。
* 当前应用是 Electron + Vite + React 19 + TypeScript。
* 当前没有前端路由；主要是单页 Today 工作流。
* 当前主要 UI 在 `src/renderer/App.tsx`，样式集中在 `src/renderer/styles.css`。
* 当前没有 Tailwind CSS / daisyUI 依赖。
* 当前 `SettingsPanel` 常驻 Today 顶部，provider/model/key/raw response 状态也常驻 header，容易干扰日常写作。
* 当前右侧学习面板承载 before-writing、after-writing、review preview、stale review、D+1 rewrite practice 等状态。
* 当前 journal editor 禁用了 spellcheck，符合“先自由写作、后反馈”的产品方向，但需确认是否保持。
* 当前 review preview 强调 self-repair，但 reveal model answer 按钮行为仍可能削弱“先试再看答案”的学习节奏。
* 当前 disclosure modal 使用自定义样式，后续可用 daisyUI modal 并补齐可访问性体验。

## Assumptions (temporary)

* 本任务只重构现有 UI/UX，不新增历史页、账号系统、云同步或复杂导航。
* daisyUI 作为组件语义层，Tailwind utilities 用于布局和细节，不引入额外 React component library。
* 优先让日常用户打开应用后直接进入写作，不被 provider/debug 信息打断。
* 保留现有 IPC、数据模型和 review/journal 行为，除非 UX 决策需要小范围行为调整。

## Open Questions

None.

## Requirements (evolving)

* 引入 Tailwind CSS + daisyUI 并接入 Vite renderer 构建。
* 全面迁移当前 UI 到 daisyUI/Tailwind class 体系，避免旧全局 CSS 与新样式长期混搭。
* 采用“沉浸写作优先”的 Today 信息架构：写作区成为主路径，右侧保留 Next step 教练面板，设置/技术信息默认不打断写作。
* Provider settings、API key、raw response storage 等配置移入右侧 daisyUI drawer；主界面只保留低干扰状态 badge（Ready / Setup needed / Error）。
* Journal editor 继续默认关闭 spellcheck，并用轻提示解释“先自由写，稍后复盘”。
* Review self-repair 允许用户直接 reveal model answer，但直接 reveal 前需要二次确认，鼓励用户先尝试。
* Review 完成后将 future rewrite practice 从 disabled input/buttons 改为明确的“明天练习已安排”预告卡。
* 视觉方向采用干净现代 SaaS：light theme、清爽中性色、蓝/紫系 accent，避免当前暖色纸张风格继续主导。
* Review 结果采用分层 accordion：Focus Pattern + self-repair 主练习常显，what went well / other corrections / low-confidence / reference rewrite 等次级内容折叠展示。
* 本轮只重构现有 Today 工作流，不新增历史页、统计页、路由或未来导航入口。
* 本轮不加入额外 UX 扩展，严格聚焦已确认的 UI/UX 重构范围。
* 实现时做轻量组件拆分：把主要 UI surface 拆到 `src/renderer/components/*`，但状态管理和业务编排仍保留在 Today 页面层。
* 重构 Today 页面现有视觉层级，让写作区成为主路径。
* 优化设置、技术状态、autosave、review、self-repair、rewrite practice、disclosure modal 的用户体验表达。
* 保留现有核心业务能力：今日写作、自动保存、review、保存 review、D+1 rewrite practice、provider/key/raw response 设置。

## Acceptance Criteria (evolving)

* [ ] 应用能在 renderer 中成功加载 Tailwind CSS + daisyUI 样式。
* [ ] Today 页面所有现有 UI surface 都迁移到 daisyUI/Tailwind 风格。
* [ ] Today 默认呈现沉浸写作主界面，provider/debug 信息不再压过写作任务。
* [ ] Provider settings 可从右上角低干扰入口打开右侧 drawer，并完成 base URL/model/API key/raw response 设置。
* [ ] 主界面用简短状态 badge 表达 Ready / Setup needed / Error，不展示完整调试信息。
* [ ] Journal editor 保持 `spellCheck={false}`，并在 UI 中解释这是为了先自由写作、稍后复盘。
* [ ] Review 中 self-repair attempt 为空时点击 reveal model answer 会出现二次确认，而不是无提示直接显示答案。
* [ ] Review 后的 rewrite practice preview 不再渲染 disabled input/buttons，而是显示“明天练习已安排”预告卡。
* [ ] 不新增 History/Stats 页面、路由或 disabled future nav；当前应用仍以 Today 为唯一主界面。
* [ ] `App.tsx` 不继续承载全部 UI；主要 presentational surfaces 轻量拆分到 renderer components，Today 页面保留状态和 handler 编排。
* [ ] 整体 UI 使用干净现代 SaaS light theme，主色和反馈色通过 daisyUI/Tailwind 统一表达。
* [ ] Review 结果首屏突出 Focus Pattern + self-repair，次级内容通过 daisyUI collapse/accordion 展开。
* [ ] Autosave/review/rewrite/disclosure 的 loading、success、error、empty 状态都有清晰 UI 表达。
* [ ] 现有 journal/review/settings/rewrite flows 行为不回退。
* [ ] `pnpm lint`、`pnpm typecheck`、`pnpm test` 通过。
* [ ] UI 变更通过本地 Electron dev server 手动验证 golden path 和关键边界状态。

## Definition of Done (team quality bar)

* Tests added/updated where behavior changes are introduced.
* Lint / typecheck / tests green.
* Docs/notes updated if behavior changes.
* Rollout/rollback considered if dependency/build integration is risky.
* UI manually exercised in the running desktop app before reporting completion.

## Out of Scope (explicit)

* 不新增历史浏览页、学习统计页、路由或未来导航入口。
* 不加入本轮已确认范围之外的额外 UX 扩展。
* 不更换 Electron/Vite/React 架构。
* 不重写 backend/main process IPC 或 review provider contract。
* 不新增云端账号、同步、订阅、在线服务配置。
* 不为了视觉重构改变 review 算法或 prompt contract。

## Decision (ADR-lite)

**Context**: 当前 Today 页面顶部常驻 provider/model/key/raw response 等技术状态，日常写作主任务被配置和调试信息打断。
**Decision**: 采用沉浸写作优先的信息架构：写作区为主，右侧是学习教练 Next step，设置与技术状态默认收起。Provider settings 通过右上角 Settings 入口打开右侧 daisyUI drawer，主界面只保留 Ready / Setup needed / Error 状态 badge。
**Consequences**: 日常体验更聚焦；provider/debug 信息不会常驻占据主路径，但需要在缺少 API key、数据库不可用、provider 配置异常时用 badge/alert 明确提示。

**Context**: 当前 editor 禁用 browser spellcheck，符合“先自由表达、再集中复盘”的学习节奏，但可能被用户误认为缺失拼写辅助。
**Decision**: 继续保持 `spellCheck={false}`，并在编辑器 UI 中用轻提示解释“先自由写，稍后复盘”。
**Consequences**: 写作过程更沉浸；需要通过文案降低用户对没有红线提示的困惑。

**Context**: Review preview 里的 self-repair 设计希望用户先尝试修正，但强制阻塞可能带来过多摩擦。
**Decision**: 允许用户直接 reveal model answer，但当 self-repair attempt 为空时需要二次确认，并用文案建议先尝试。
**Consequences**: 保留用户自由度，同时减少无意识跳过练习；实现上需要一个 daisyUI modal/confirm 状态。

**Context**: 当前 Review 后的 future rewrite practice 用 disabled input/buttons 预告未来练习，容易让用户误以为控件坏了或当前就应该可操作。
**Decision**: 改为明确的“明天练习已安排”预告卡，展示将练习的句子/模式和安排原因，不显示不可操作输入框。
**Consequences**: 学习闭环更清楚，今天的操作噪音更少；真正的输入控件只在 D+1 practice 可执行时出现。

**Context**: 当前 UI 是暖色纸张/学习笔记风格，但用户偏好更成熟、现代的 UI 库体验。
**Decision**: 视觉方向采用干净现代 SaaS light theme，以中性色表面、蓝/紫 accent、清晰边框/阴影和 daisyUI 语义组件建立一致性。
**Consequences**: 产品会更像现代桌面 SaaS 工具而非手写 journal；需要用文案和学习面板保留“coach”感。

**Context**: Review preview 当前把 summary、focus correction、self-repair、top corrections、low-confidence、reference rewrite、future practice 全部平铺在右侧面板，容易信息过载。
**Decision**: 采用分层 accordion：Focus Pattern + self-repair 主练习常显，其他 review 内容折叠展示。
**Consequences**: 用户首屏更容易聚焦今天最重要的练习；细节仍可查看，但需要给 accordion 标题清楚的信息 scent。

**Context**: 项目目前没有前端路由，用户目标是全面重构当前 UI/UX，而不是扩展产品功能。
**Decision**: 本轮只重构现有 Today 工作流，不新增 History/Stats 页面、路由或 disabled future nav。
**Consequences**: 范围更可控，避免 UI 重构膨胀成产品功能开发；历史/统计可作为后续独立任务。

**Context**: 当前 `App.tsx` 已超过 30KB，全面迁移 daisyUI/Tailwind 后如果继续单文件会更难维护。
**Decision**: 做轻量组件拆分：`TodayPage` 保留状态和业务 handler，主要 UI surface 拆到 `src/renderer/components/*`。
**Consequences**: 可维护性和审查性提升；避免引入 hooks/state 大拆分造成额外风险。

**Context**: 已确认范围已经包含 daisyUI/Tailwind 接入、全 UI 重构、设置 drawer、review accordion、reveal 二次确认、D+1 预告卡和轻量拆分。
**Decision**: 本轮不加入额外 UX 扩展，严格聚焦已确认范围。
**Consequences**: 完成度和验证质量优先；空/错误状态和小窗口会在既有 surface 内合理打磨，但不作为独立扩展专项。

## Technical Approach

* Add `tailwindcss`, `@tailwindcss/vite`, and `daisyui` as renderer styling dependencies.
* Wire Tailwind v4 through `vite.renderer.config.ts` using `@tailwindcss/vite` and import Tailwind/daisyUI from `src/renderer/styles.css`.
* Replace the current handwritten component CSS with daisyUI semantic classes plus Tailwind layout utilities, keeping only minimal global base styles where needed.
* Keep the app as a single Today workflow: no router, no History/Stats navigation, no disabled future nav.
* Keep `TodayPage` as the state/handler orchestration layer, but split presentational UI surfaces into `src/renderer/components/*`.
* Redesign Today around an immersive writing layout: main journal editor, right-side coach panel, top status badge + Settings drawer trigger.
* Move provider configuration/API key/raw response settings into a right-side daisyUI drawer.
* Rework review UI into a focused primary exercise plus accordion sections for secondary review details.
* Add a confirmation modal when revealing the model answer without a self-repair attempt.
* Replace disabled future rewrite controls with a clear “tomorrow practice scheduled” preview card.

## Implementation Plan

1. Install and configure Tailwind/daisyUI for the Vite renderer.
2. Create lightweight renderer components for app status/header, settings drawer, journal editor card, learning panel, review preview, rewrite practice, confirmation/disclosure dialogs, and shared display helpers.
3. Migrate Today layout to daisyUI/Tailwind with the modern SaaS light visual direction.
4. Implement UX behavior changes: settings drawer, status badge, reveal confirmation, review accordion, and D+1 preview card.
5. Remove obsolete handwritten component CSS while preserving necessary base styles.
6. Run lint/typecheck/tests, then launch the Electron dev app and manually verify writing, autosave, settings, review, self-repair reveal, save review, and rewrite practice paths.

## Technical Notes

* `package.json` 当前依赖包含 React/Electron/Vite，但不包含 `tailwindcss`、`@tailwindcss/vite`、`daisyui`。
* `vite.renderer.config.ts` 当前 plugins 为 `[react()]`；Tailwind v4 官方 Vite 集成需加入 `@tailwindcss/vite` plugin。
* Tailwind v4 官方 CSS 入口使用 `@import "tailwindcss";`。
* daisyUI v5 官方 CSS 配置可在 CSS 中添加 `@plugin "daisyui";`。
* 当前 CSS 是手写全局样式；迁移时应保留少量 base reset/desktop shell 约束，组件样式优先使用 daisyUI/Tailwind class。
* 已由 Explore agent 初步确认：无 router、无 page directory、主 UI 均在 `App.tsx`。

## Research References

* Context7 `/tailwindlabs/tailwindcss.com` — Tailwind v4 Vite plugin and CSS import syntax.
* Context7 `/websites/daisyui` — daisyUI install and CSS plugin syntax for Tailwind/Vite.
