# brainstorm: engineering stack completion

## Goal

补齐当前 Electron + React + TypeScript local-first 桌面应用的工程化栈，使项目从 v0.1 功能开发状态走向更稳定、可维护、可验证、可分发的生产级基础设施。

## What I already know

* 用户要求从技术栈层面进行工程化栈补齐，不关注具体业务实现细节。
* 当前核心技术栈整体合理：Electron + React + TypeScript、SQLite + Drizzle、Zod shared contracts、TanStack Query、keytar、AI SDK。
* 已识别的候选补齐方向包括 CI/check 脚本、格式化工具、组件测试、E2E 测试、Electron 发布安全、可观测性。
* `package.json` 已有 `lint`、`typecheck`、`test`、`review:harness`、`build/package/make` 脚本，但缺少统一 `check` 脚本。
* 当前未发现 `.github` CI 目录。
* ESLint 已启用 TypeScript、React Hooks、显式返回类型、禁用 `any`/non-null assertion 等规则。
* 现有测试偏服务层、契约层和 Query cache 行为，组件测试/E2E/打包 smoke 尚未成体系。

## Assumptions (temporary)

* 第一阶段应优先补最小但高收益的质量门禁，而不是一次性引入完整发布平台。
* 工程化补齐应尽量贴合现有 pnpm + Vite + Electron Forge + Vitest 技术栈。
* 可观测性、自动更新、代码签名等可能需要产品分发策略明确后再做。

## Open Questions

* None.

## Requirements

* 第一阶段选择 Quality Gate MVP。
* 增加统一的本地质量检查入口 `pnpm check`。
* 增加 GitHub Actions CI workflow，运行核心质量门禁。
* 增加 Prettier 作为显式直接 dev dependency。
* 增加 `format` 和 `format:check` 命令。
* 将 `format:check` 强制纳入 `pnpm check` 和 CI。
* CI 使用 pnpm frozen lockfile 安装，并运行 lint、typecheck、test、review harness、format check。
* 暂不在第一阶段引入组件测试、Electron E2E、签名、自动更新或远程 telemetry。
* 避免引入与当前 local-first 桌面应用不匹配的重型基础设施。

## Acceptance Criteria

* [x] `package.json` 有 `check`、`format`、`format:check` scripts。
* [x] Prettier 是显式 dev dependency，不依赖 transitive CLI。
* [x] `pnpm check` 会运行 `format:check`、`lint`、`typecheck`、`test`、`review:harness`。
* [x] GitHub Actions workflow 使用 Node 22、pnpm、frozen lockfile，并运行同等核心检查。
* [x] 格式化配置避免扫描 build output、node_modules、Trellis workspace/generated artifacts 等不应格式化内容。
* [x] 本阶段 out-of-scope 的组件测试、Electron E2E、签名、自动更新、远程 telemetry 已明确记录。

## Definition of Done (team quality bar)

* Tests added/updated where appropriate.
* Lint / typecheck / tests / build-related checks pass.
* CI/check command documented in executable scripts.
* Risky distribution/security choices are explicitly scoped.
* Rollback or incremental adoption path considered for new tooling.

## Technical Approach

Quality Gate MVP 使用低风险增量方式落地：保留现有 ESLint/Vitest/TypeScript 检查，新增 Prettier 专责格式化，并通过本地 `pnpm check` 与 GitHub Actions 统一质量门禁。CI 不在第一阶段运行完整 Electron make/release，只运行可稳定复现的核心检查。

## Decision (ADR-lite)

**Context**: 当前核心应用技术栈合理，但缺少统一质量门禁、显式格式化工具和自动化 CI。

**Decision**: 第一阶段实施 Quality Gate MVP；使用 Prettier + ESLint 分工，强制 `format:check` 进入 `pnpm check` 和 CI。

**Consequences**: 质量门禁会更严格，首次引入可能产生格式化 diff；组件测试、Electron E2E、发布签名、自动更新、远程 telemetry 延后到后续任务。

## Out of Scope (explicit)

* 不更换核心应用技术栈，例如不迁移到 Next.js、独立后端或微服务。
* 不重写业务功能。
* 不默认接入会上传用户数据的远程 telemetry，除非用户明确同意。
* 第一阶段不引入 React Testing Library/jsdom 组件测试。
* 第一阶段不引入 Playwright/Electron E2E。
* 第一阶段不配置代码签名、自动更新、crash reporting 或远程 telemetry。

## Research References

* [`research/check-ci.md`](research/check-ci.md) — local/CI quality gates should start with a single `check` script and a GitHub Actions workflow using pnpm frozen installs.
* [`research/testing-stack.md`](research/testing-stack.md) — first testing additions should be Vitest + React Testing Library/jsdom for components and a small Electron smoke later.
* [`research/formatting-linting.md`](research/formatting-linting.md) — Prettier + ESLint is the lowest-risk formatter/linter split for the current ESLint v9 setup.
* [`research/electron-release-observability.md`](research/electron-release-observability.md) — MVP hardening should prioritize CSP/navigation/permission/fuses basics before signing/updater/telemetry.

## Research Notes

### What similar projects usually do

* Keep a single local `check` command that developers can run before handoff, while CI runs the same underlying checks in visible steps.
* Use ESLint for correctness and Prettier for deterministic formatting rather than mixing formatting into lint rules.
* Add fast renderer component tests before heavier browser/Electron E2E suites.
* Treat Electron distribution features as stages: hardening first, signing/updater/telemetry once release channel and privacy posture are decided.

### Constraints from this repo

* Existing scripts already expose `lint`, `typecheck`, `test`, `review:harness`, `build/package`, and `make`.
* Current tests are mostly service/contract/integration tests; no React component or Electron E2E test stack is installed.
* The app stores user writing locally and handles provider API keys, so telemetry/crash reporting must be opt-in and redacted if introduced.
* Electron security basics are already present, but CSP, navigation/window-open controls, fuses, and release signing/updater are not yet configured.

### Feasible approaches

**Approach A: Quality Gate MVP** (Recommended)

* How it works: add deterministic formatting, aggregate `check` script, CI workflow, and minimal config needed to enforce existing quality checks.
* Pros: highest immediate engineering value, low product risk, small dependency surface, creates a foundation for future layers.
* Cons: does not yet improve renderer UI coverage or Electron release hardening beyond existing checks.

**Approach B: Test Coverage MVP**

* How it works: add React Testing Library/jsdom component test infrastructure, a few representative component tests, and include them in `pnpm test`/CI.
* Pros: directly addresses frontend confidence gap and reduces manual regression risk.
* Cons: larger setup and mocking surface because renderer code depends on `window.api`/query hooks.

**Approach C: Release Hardening MVP**

* How it works: add CSP, navigation/window-open/permission guards, possibly Electron fuses/package smoke, while deferring signing/updater/telemetry.
* Pros: improves Electron production posture and desktop security.
* Cons: more sensitive to dev/prod environment differences and may require careful UI smoke validation.

## Expansion Sweep

### Future evolution

* Engineering stack can later grow into release matrices, signed artifacts, auto-update, crash reporting, coverage thresholds, and browser/Electron E2E suites.
* Avoid committing to remote telemetry before privacy/consent policy is explicit.

### Related scenarios

* Local `pnpm check` and CI should stay aligned so developers and automation validate the same contract.
* Component tests and Electron smoke tests should complement existing service/contract tests rather than replacing them.

### Failure & edge cases

* Formatter adoption can create broad diffs if applied to the whole repo at once.
* Electron security settings can behave differently in Vite dev server vs packaged app.
* Native Electron dependencies make packaging/CI slower and more platform-sensitive.

## Technical Notes

* Existing scripts live in `package.json`.
* Existing Electron main window security settings include `contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`.
* Existing tests live under `test/` and use Vitest.
* Research completed for check/CI, testing stack, formatting/linting, and Electron release/observability.
