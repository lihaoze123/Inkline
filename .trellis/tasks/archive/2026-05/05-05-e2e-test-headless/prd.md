# 优化 e2e test headless 运行

## Goal

让现有 Electron + CDP e2e 测试可以在 Linux headless/CI 环境中稳定运行，同时尽量复用当前自定义脚本，不引入大规模测试框架迁移。

## What I already know

* 用户目标：优化 e2e test，使其跑在 headless 环境。
* 当前 e2e 不是 Playwright/Cypress，而是 TypeScript 脚本启动 Electron Forge，再通过 CDP 驱动 UI。
* `package.json` 暴露 `pnpm test:e2e` 和 `pnpm test:e2e:live` 两个 e2e 命令。
* mocked UI e2e 已经传入 `--disable-gpu`、固定窗口大小、reduced motion、Linux `--no-sandbox` 等 Electron/Chromium 参数。
* live provider e2e 当前只传入 `--remote-debugging-port`，启动参数与 mocked UI e2e 不一致。
* 当前 GitHub CI 没有安装/启用 Xvfb，也没有运行 e2e 命令。

## Assumptions (temporary)

* 本任务优先解决 deterministic mocked UI e2e 的 headless 运行。
* live provider e2e 保持可手动运行，并在缺少 provider env vars 时继续跳过。
* 不在本任务中迁移到 Playwright/Cypress。

## Open Questions

* None.

## Requirements

* 新增/调整 package-level headless e2e 脚本，让 Linux headless 环境可通过 Xvfb 运行 deterministic e2e。
* headless 脚本需要清掉 Wayland display 状态并强制 X11，避免 Electron 绕过 Xvfb 打开本机可见窗口。
* 在 GitHub CI workflow 中安装 Xvfb 并运行 deterministic `pnpm test:e2e` 的 headless 版本。
* 在 Nix dev shell 中提供 `xvfb-run`，让本地 headless 脚本具备同样的基础依赖。
* 保持现有 CDP 驱动、测试 fixture、artifact/screenshot 输出方式。
* 同步 mocked UI 与 live provider e2e 的 Electron 启动参数，避免同类 headless 稳定性差异。
* 不让 live provider e2e 在没有外部 provider 凭据时阻塞本地或 CI 质量检查。

## Acceptance Criteria (evolving)

* [ ] `pnpm test:e2e:headless` 能在无物理 display 的 Linux 环境中通过虚拟 display 运行，且不会在 Wayland 桌面会话中绕过 Xvfb 打开可见窗口。
* [ ] e2e 失败时仍保留现有诊断输出和 failure screenshot 行为。
* [ ] `pnpm test:e2e:live` 的 Electron 启动参数与 mocked UI e2e 的 headless 相关参数保持一致。
* [ ] CI workflow 安装/启用 headless display 依赖并运行 deterministic e2e；live e2e 仍按 env vars 策略跳过或单独触发。
* [ ] Nix dev shell 提供 `xvfb-run` 以支持本地 headless e2e 脚本。
* [ ] `pnpm format:check`、`pnpm lint`、`pnpm typecheck`、`pnpm test` 通过。

## Definition of Done (team quality bar)

* Tests added/updated where appropriate。
* Lint / typecheck / relevant tests green。
* CI/headless behavior documented in package scripts or workflow names if changed。
* Rollback is simple: remove wrapper/script/workflow e2e step without changing app runtime behavior。

## Research References

* [`research/electron-headless-ci.md`](research/electron-headless-ci.md) — Electron headless Linux needs a display driver; `xvfb-run` around existing commands is the smallest fit for this repo.

## Research Notes

### Feasible approaches here

**Approach A: package-level `xvfb-run` wrapper (Recommended)**

* How it works: add headless e2e script(s), e.g. `test:e2e:headless`, that wrap existing e2e commands with `xvfb-run -a` on Linux-capable environments.
* Pros: minimal code churn; works locally and in CI; preserves current CDP implementation.
* Cons: requires Xvfb installed in Linux environments.

**Approach B: GitHub Actions-only Xvfb setup**

* How it works: keep package scripts unchanged; add CI steps/actions that run `pnpm test:e2e` under Xvfb.
* Pros: smallest package.json surface; good if only CI is targeted.
* Cons: local headless usage remains undocumented/manual; tied to GitHub Actions.

**Approach C: framework migration**

* How it works: introduce Playwright Electron/Cypress-style runner and migrate e2e orchestration.
* Pros: more conventional e2e tooling long-term.
* Cons: much larger scope; still needs display handling for Linux Electron; unnecessary for current goal.

## Expansion Sweep

### Future evolution

* Later CI could split deterministic e2e from live-provider e2e, with live tests guarded by explicit secrets and manual/scheduled triggers.
* If e2e surface grows, a shared Electron launch helper could prevent flag drift across scripts.

### Related scenarios

* `pnpm dev` should remain developer-headed and not inherit e2e-only launch behavior.
* App-build workflow may eventually run deterministic e2e before packaging, but that increases build time.

### Failure / edge cases

* Missing `xvfb-run` should fail with a clear dependency signal in headless-specific scripts/workflows.
* Headless changes should not weaken existing secret redaction or live-provider skip behavior.

## Technical Approach

Add a package script that wraps the existing deterministic e2e command with `xvfb-run -a`, update GitHub CI to install `xvfb` and run that headless e2e script after unit tests / harness checks, and include `xvfb-run` in the Nix dev shell for local parity. Keep Electron-specific flags inside the e2e TypeScript launchers, and align the live-provider launcher flags with the deterministic launcher without making live tests mandatory in CI.

## Decision (ADR-lite)

**Context**: Electron requires a display driver on Linux headless runners; current scripts start a real Electron app via Forge and CDP.

**Decision**: Use an Xvfb wrapper around the existing e2e command, plus CI installation/execution, rather than migrating frameworks or relying on launch flags only.

**Consequences**: Minimal implementation churn and local/CI parity, at the cost of requiring Xvfb in Linux headless environments.

## Implementation Plan

* Update package scripts to expose a deterministic headless e2e command.
* Update CI Linux dependencies and add a deterministic headless e2e step.
* Align live provider Electron launch flags with mocked UI e2e flags.
* Run format/lint/typecheck/unit tests and relevant e2e validation where the environment supports it.

## Out of Scope (explicit)

* Migrating the e2e framework to Playwright/Cypress.
* Making live provider e2e mandatory in regular CI without explicit secrets policy.
* Changing app runtime Electron window behavior outside e2e launchers.

## Technical Notes

* `package.json:18-19` defines current e2e scripts.
* `scripts/review-ui-e2e.ts:252-259` already centralizes Electron args for mocked UI e2e.
* `scripts/review-provider-e2e.ts:183-204` launches Electron with fewer args and can be aligned.
* `.github/workflows/ci.yml:28-47` installs native Linux deps and runs quality checks, but not e2e.
* Relevant specs found by research: `.trellis/spec/product/validation-and-testing.md`, `.trellis/spec/shared/pnpm-electron-setup.md`, `.trellis/spec/backend/electron-window-shell.md`.
