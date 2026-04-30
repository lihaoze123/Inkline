# Optimize AI Backend with Vercel AI SDK

## Goal

Replace hand-written AI provider HTTP plumbing with a mature Vercel AI SDK-based backend architecture that supports structured generation, multiple providers, shared review/starter prompt generation, and a settings/credentials/UI model that can ship OpenAI-compatible and Anthropic Claude providers first.

## What I Already Know

- The current app is an Electron app; AI calls happen in the main process behind IPC, not through HTTP API routes.
- Review generation currently uses a narrow `ReviewAgent` abstraction and a hand-written OpenAI-compatible `/chat/completions` call.
- Starter prompt generation separately performs its own hand-written OpenAI-compatible call.
- The current provider settings only model one provider label, `OpenAI-compatible`, with configurable `baseUrl` and `model`.
- API keys are stored in the OS keychain through the existing credentials service.
- Review output is already governed by strict Zod schemas and additional business validation for content hash, quote anchors, correction caps, focus correction, self-repair, rewrite tasks, and generic-praise checks.
- The current UX has phase-level progress events but no token-level streaming.
- The user wants mature SDK/library usage even for plain API calls; do not keep expanding custom provider HTTP wrappers.
- The user does not want to prioritize a true agentic runtime right now; Claude Agent SDK/pi-mono should wait until tool use, sessions, MCP, or multi-step autonomous work is needed.

## Requirements

- Use Vercel AI SDK as the shared AI backend abstraction.
- Replace hand-written provider HTTP calls for both review generation and starter prompt generation.
- Build a full multi-provider architecture covering provider adapters, settings, credentials, and UI.
- Ship first-class support for:
  - OpenAI-compatible provider with custom `baseUrl`, `model`, and API key.
  - Anthropic Claude provider with provider-specific model and API key.
- Keep a global default provider/model in the first UI version.
- Internally allow per-feature model selection/override so review and starter prompt can diverge later without another schema rewrite.
- Use AI SDK structured generation (`generateText` + `Output.object`) with Zod schemas for structured outputs.
- Preserve existing review business validation after AI SDK schema-level generation.
- On schema or business validation failure, support at most one automatic repair/retry path; do not silently weaken validation or accept invalid output.
- Preserve existing privacy/disclosure behavior and raw-response storage controls.
- Preserve review run persistence and provider/model metadata with enough detail to identify which provider/model produced a result.

## Acceptance Criteria

- [ ] Review generation no longer calls provider endpoints through custom `fetch`/`net.fetch` request construction.
- [ ] Starter prompt generation no longer calls provider endpoints through custom `fetch`/`net.fetch` request construction.
- [ ] Review and starter prompt generation share one AI generation/provider service layer.
- [ ] OpenAI-compatible configuration keeps supporting custom base URL, model, and API key.
- [ ] Anthropic Claude can be configured as a provider with its own API key and model.
- [ ] Settings UI exposes the global default provider/model and provider credential state.
- [ ] Internal configuration types can represent future per-feature overrides even if the first UI does not expose them.
- [ ] Review output still passes the existing review contract schema and business validation before preview/save.
- [ ] Validation/schema failure retry is bounded to one attempt and failure remains visible to the user.
- [ ] Existing review progress phases and error categories remain coherent after migration.
- [ ] Tests cover provider selection, settings/credentials behavior, review generation success/failure, and starter prompt generation success/failure at the service boundary.
- [ ] Lint/typecheck/test commands pass.

## Definition of Done

- Tests added or updated for the changed AI backend, settings, and credential behavior.
- Lint, typecheck, and relevant test suite pass.
- Existing OpenAI-compatible user configuration is migrated or preserved without data loss.
- Error mapping remains user-facing and actionable for missing key, provider error, timeout, malformed output, and validation failure.
- Rollback path is clear: the old provider settings remain intelligible and no review data schema is made unrecoverable without need.

## Technical Approach

Use Vercel AI SDK as a provider-agnostic generation layer in the Electron main process. Introduce a shared AI generation service that can construct provider models from current settings and keychain credentials, then expose structured generation helpers for review and starter prompt flows.

Review generation should move from manual JSON-mode prompting to `generateText` + `Output.object` using the existing review output Zod schema where practical, followed by the existing domain-specific validation. Starter prompt generation should use the same service with its own schema. Provider-specific details such as OpenAI-compatible `baseURL` and Anthropic API key/model should live behind provider factory/adapters rather than in feature procedures.

## Decision (ADR-lite)

**Context**: The current backend has two hand-written OpenAI-compatible call sites and a single-provider settings model. The product needs a more robust AI backend, but current learning flows are structured generation, not autonomous agent workflows.

**Decision**: Use Vercel AI SDK for the shared AI backend, support OpenAI-compatible and Anthropic Claude first, preserve OpenAI-compatible custom base URL/model/API key, expose a global provider/model in the first UI, and defer Claude Agent SDK/pi-mono until agentic capabilities become product requirements.

**Consequences**: This reduces custom provider plumbing and prepares for multiple providers while keeping the product flow strict and validation-driven. It adds settings/UI complexity now, but avoids a second migration from hidden adapter swap to real multi-provider architecture later.

## Implementation Plan (small PRs / small stages)

- PR/stage 1: Add AI SDK dependencies and shared main-process AI generation service with provider factories for OpenAI-compatible and Anthropic.
- PR/stage 2: Extend settings and credentials types/services for multi-provider configuration while preserving existing OpenAI-compatible settings.
- PR/stage 3: Migrate review generation and starter prompt generation to the shared AI SDK service using `generateText` + `Output.object` and existing validation boundaries.
- PR/stage 4: Update settings UI/preload/IPC for global provider/model/key configuration and add service-boundary tests/error mapping coverage.

## Out of Scope

- True agentic runtime: tool use, MCP access, command execution, persistent agent sessions, or multi-agent orchestration.
- Token-level streaming UI.
- Adding providers beyond OpenAI-compatible and Anthropic Claude in the first implementation.
- Letting users configure separate review/starter models in the first UI release.
- Weakening review validation or accepting model output that fails quote-anchor/content-hash/business rules.
- Landing the whole migration as one large unreviewable change; implementation should be staged within this task.

## Technical Notes

- Current review provider call: `src/main/services/review/lib/openai-compatible-agent.ts`.
- Current review abstraction: `src/main/services/review/types.ts`.
- Current review orchestration: `src/main/services/review/procedures/start.ts`.
- Current starter prompt direct provider call: `src/main/services/writing/service.ts`.
- Current settings service/types: `src/main/services/settings/service.ts`, `src/shared/types/settings.ts`.
- Current credentials service: `src/main/services/credentials/service.ts`.
- Current IPC surface: `src/main/ipc/handlers.ts`, `src/shared/constants/channels.ts`, `src/preload/index.ts`.
- Current review contract/validation: `src/shared/review-contract/schemas.ts`, `src/shared/review-contract/validation.ts`.
- Runtime constraint: Electron main process / Node 22.

## Research References

- [`research/ai-sdk-structured-providers.md`](research/ai-sdk-structured-providers.md) — Vercel AI SDK packages/providers, structured Zod output, Electron compatibility, and validation-boundary notes.
