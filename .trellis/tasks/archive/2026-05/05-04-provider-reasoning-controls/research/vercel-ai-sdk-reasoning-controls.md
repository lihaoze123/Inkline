# Research: Vercel AI SDK provider reasoning controls

- Query: Vercel AI SDK official documentation for provider-specific reasoning/thinking controls and first-class provider package choices for settings-page provider selection.
- Scope: mixed
- Date: 2026-05-03

## Findings

### Files found

- `package.json:28` - Local app depends on `@ai-sdk/anthropic` `^3.0.72`.
- `package.json:29` - Local app depends on `@ai-sdk/openai` `^3.0.54`.
- `README.md:61` - Product docs say OpenAI-compatible providers use `@ai-sdk/openai`; Anthropic Claude uses `@ai-sdk/anthropic`.
- `README.md:73` - README documents DeepSeek as an OpenAI-compatible base URL example.
- `src/main/services/ai/provider.ts:23` - Runtime provider factory is centralized in `createAiProviderModel`.
- `src/main/services/ai/provider.ts:24` - OpenAI-compatible provider path uses `createOpenAI`.
- `src/main/services/ai/provider.ts:35` - OpenAI-compatible language models are created with `provider.chat(config.model)`.
- `src/main/services/ai/provider.ts:39` - Anthropic provider path uses `createAnthropic`.
- `src/main/services/ai/runtime-config.ts:63` - Runtime config resolves provider settings per feature before loading credentials.
- `src/main/services/ai/runtime-config.ts:72` - Anthropic runtime config does not require a base URL.
- `src/main/services/ai/runtime-config.ts:80` - Non-Anthropic runtime config currently requires OpenAI-compatible base URL and model.
- `src/main/services/ai/types.ts:5` - Current provider IDs are only `openai-compatible` and `anthropic`.
- `src/main/services/ai/types.ts:28` - Generation requests accept opaque AI SDK `ProviderOptions`.
- `src/main/services/ai/generate.ts:83` - Generation wrapper passes `providerOptions` directly into `generateText`.
- `src/main/services/ai/generate.ts:106` - First generation attempt uses the requested provider options.
- `src/main/services/ai/generate.ts:116` - If a provider rejects `reasoningEffort: 'none'`, code retries without OpenAI reasoning effort.
- `src/main/services/ai/generate.ts:371` - Reasoning diagnostics are currently derived only from `providerOptions.openai.reasoningEffort`.
- `src/main/services/ai/generate.ts:410` - Compatibility fallback matches OpenAI-compatible errors for unknown `reasoning_effort` value `none`.
- `src/main/services/review/procedures/start.ts:367` - Review provider options are built from settings.
- `src/main/services/review/procedures/start.ts:369` - Review reasoning options are only applied for `openai-compatible`.
- `src/main/services/review/procedures/start.ts:373` - Review uses `providerOptions.openai.reasoningEffort`.
- `src/main/services/review/lib/openai-compatible-agent.ts:97` - Direct OpenAI-compatible review agent also defaults to OpenAI-style reasoning effort.
- `src/shared/types/ai.ts:13` - Local diagnostics allow `none`, `minimal`, `low`, `medium`, `high`, and `xhigh`.
- `src/shared/types/credentials.ts:3` - Shared credential provider IDs are only `openai-compatible` and `anthropic`.
- `src/shared/types/settings.ts:6` - Settings provider labels are only `OpenAI-compatible` and `Anthropic Claude`.
- `src/shared/types/settings.ts:34` - Provider settings are discriminated only between OpenAI-compatible and Anthropic configs.
- `src/shared/types/settings.ts:49` - Settings provider map is a fixed object with only `openai-compatible` and `anthropic`.
- `src/shared/types/settings.ts:91` - Provider config input schema requires `baseUrl` for OpenAI-compatible and only `model` for Anthropic.
- `src/main/services/settings/service.ts:90` - Settings snapshot builds a two-provider map.
- `src/main/services/settings/service.ts:140` - Saving Anthropic config stores only a model.
- `src/main/services/settings/service.ts:150` - Saving OpenAI-compatible config stores normalized base URL and model.
- `src/renderer/components/SettingsPage.tsx:66` - Settings page exposes a default provider select.
- `src/renderer/components/SettingsPage.tsx:85` - Settings page renders an OpenAI-compatible provider section.
- `src/renderer/components/SettingsPage.tsx:97` - OpenAI-compatible UI asks for a base URL.
- `src/renderer/components/SettingsPage.tsx:127` - Settings page renders an Anthropic Claude section.

### Code patterns

- Current implementation treats DeepSeek as a generic OpenAI-compatible endpoint, so the only configured reasoning knob is `providerOptions.openai.reasoningEffort`.
- Current diagnostics assume the OpenAI provider key; provider-specific DeepSeek, Google, xAI, Anthropic, or OpenRouter options would need matching diagnostics extraction instead of only `extractOpenAiReasoningEffort`.
- The fallback for rejected `reasoningEffort: 'none'` is useful for generic OpenAI-compatible APIs, but it is not the official DeepSeek disable path in current DeepSeek or AI SDK docs.
- No local dependencies currently exist for `@ai-sdk/deepseek`, `@ai-sdk/google`, `@ai-sdk/xai`, `@ai-sdk/openai-compatible`, or `@openrouter/ai-sdk-provider`.
- First-class provider choices would be a schema/runtime/settings change, not just a UI label change: provider IDs, credential status maps, provider settings maps, runtime config unions, provider factory creation, and settings save inputs are all currently keyed to two providers.
- For mainstream hosted platforms covered by AI SDK docs, most first-class provider packages have default API base URLs and optional custom `baseURL`, so the settings page can ask for provider, model, and key without requiring a manual base URL.

### External references

- AI SDK provider options are passed through `providerOptions` at the function-call level for `streamText` and `generateText`; AI SDK docs show `providerOptions.openai.reasoningEffort` as the general pattern. Source: [AI SDK Prompts, lines 328-363](https://ai-sdk.dev/docs/foundations/prompts).
- AI SDK also supports message-level and part-level provider options, but UI hook `UIMessage` objects do not support provider options without conversion. Source: [AI SDK Prompts, lines 364-512](https://ai-sdk.dev/docs/foundations/prompts).
- OpenAI has a first-party provider package, `@ai-sdk/openai`, with `createOpenAI` and provider options. Source: [AI SDK OpenAI provider, lines 247-323](https://ai-sdk.dev/providers/ai-sdk-providers/openai).
- OpenAI model creation can use `openai('gpt-5')`; the provider auto-selects the API, and `.responses`, `.chat`, or `.completion` can explicitly select the API. Source: [AI SDK OpenAI provider, lines 324-380](https://ai-sdk.dev/providers/ai-sdk-providers/openai).
- OpenAI Responses options include `reasoningEffort: 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'`, default `medium`; `none` is only available for GPT-5.1 models and unsupported use errors. Source: [AI SDK OpenAI provider, lines 444-464](https://ai-sdk.dev/providers/ai-sdk-providers/openai).
- OpenAI reasoning models support `providerOptions.openai.reasoningEffort`, and provider metadata can expose generated reasoning token counts. Source: [AI SDK OpenAI provider, lines 3658-3734](https://ai-sdk.dev/providers/ai-sdk-providers/openai).
- OpenAI-compatible providers have a separate first-party package, `@ai-sdk/openai-compatible`, via `createOpenAICompatible`. Source: [AI SDK OpenAI Compatible Providers, lines 267-293](https://ai-sdk.dev/providers/openai-compatible-providers).
- OpenAI-compatible chat options include `reasoningEffort string`, with exact values depending on the provider. Source: [AI SDK OpenAI Compatible Providers, lines 1024-1080](https://ai-sdk.dev/providers/openai-compatible-providers).
- OpenAI-compatible provider-specific options can be added under the configured provider name and are included in the request body. Source: [AI SDK OpenAI Compatible Providers, lines 1081-1137](https://ai-sdk.dev/providers/openai-compatible-providers).
- DeepSeek has a first-party AI SDK provider package, `@ai-sdk/deepseek`, and exposes `createDeepSeek`. Source: [AI SDK DeepSeek provider, lines 247-302](https://ai-sdk.dev/providers/ai-sdk-providers/deepseek).
- DeepSeek model creation can use `deepseek('deepseek-chat')`, `deepseek.chat('deepseek-chat')`, or `deepseek.languageModel('deepseek-chat')`. Source: [AI SDK DeepSeek provider, lines 303-346](https://ai-sdk.dev/providers/ai-sdk-providers/deepseek).
- Current AI SDK DeepSeek docs expose a provider-specific `thinking` option under `providerOptions.deepseek`; it supports `type: 'enabled' | 'disabled'`, and can enable thinking either via `deepseek-reasoner` or by setting this option. Source: [AI SDK DeepSeek provider, lines 348-398](https://ai-sdk.dev/providers/ai-sdk-providers/deepseek).
- AI SDK DeepSeek docs separately show `deepseek-reasoner` streaming reasoning parts. Source: [AI SDK DeepSeek provider, lines 399-466](https://ai-sdk.dev/providers/ai-sdk-providers/deepseek).
- Official DeepSeek API docs say thinking mode defaults to enabled, can be toggled with `{"thinking":{"type":"enabled/disabled"}}`, and OpenAI-format effort control is only `high` or `max`; for compatibility, `low` and `medium` map to `high`, and `xhigh` maps to `max`. Source: [DeepSeek Thinking Mode, lines 42-60](https://api-docs.deepseek.com/guides/thinking_mode).
- Official DeepSeek Chat Completion API lists `thinking.type` as `enabled` or `disabled`, default enabled, and says disabled uses the non-thinking model. Source: [DeepSeek Create Chat Completion, lines 154-168](https://api-docs.deepseek.com/api/create-chat-completion).
- Official DeepSeek Chat Completion API lists `reasoning_effort` values as only `high` and `max`; lower values are mapped upward for compatibility. Source: [DeepSeek Create Chat Completion, lines 169-173](https://api-docs.deepseek.com/api/create-chat-completion).
- Anthropic has a first-party AI SDK provider package, `@ai-sdk/anthropic`, with `createAnthropic`. Source: [AI SDK Anthropic provider, lines 247-303](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic).
- Anthropic model creation uses `anthropic(modelId)`, with `anthropic.languageModel`, `anthropic.chat`, and `anthropic.messages` aliases. Source: [AI SDK Anthropic provider, lines 304-345](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic).
- Anthropic options include `sendReasoning`, `effort`, and `thinking`; `sendReasoning: false` omits reasoning content from requests, not generation. Source: [AI SDK Anthropic provider, lines 346-369](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic).
- Anthropic `effort` can be set to `low` or `medium` from a default `high` for supported Opus models to save tokens and lower latency. Source: [AI SDK Anthropic provider, lines 464-521](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic).
- Anthropic reasoning controls include adaptive thinking for newer models and budget-based thinking with `thinking: { type: 'enabled', budgetTokens: ... }` for earlier models. Source: [AI SDK Anthropic provider, lines 572-739](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic).
- Anthropic context management can clear earlier thinking/reasoning blocks from conversation history. Source: [AI SDK Anthropic provider, lines 740-924](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic).
- Google/Gemini has a first-party AI SDK provider package, `@ai-sdk/google`, with `createGoogleGenerativeAI`. Source: [AI SDK Google provider, lines 247-300](https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai).
- Google/Gemini model creation uses `google('gemini-2.5-flash')`; provider settings include default API key env var and optional custom `baseURL`, but no base URL is required for normal Google API use. Source: [AI SDK Google provider, lines 285-323](https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai).
- Google `thinkingConfig.thinkingBudget` can be set to `0` to disable thinking if the model supports it; Gemini 3 uses `thinkingLevel` instead. Source: [AI SDK Google provider, lines 455-460](https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai).
- Gemini 3 reasoning depth is controlled by `thinkingLevel`, while Gemini 2.5 thinking tokens are controlled by `thinkingBudget`; `includeThoughts` controls whether reasoning summaries are returned. Source: [AI SDK Google provider, lines 506-664](https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai).
- xAI/Grok has a first-party AI SDK provider package, `@ai-sdk/xai`, with `createXai`. Source: [AI SDK xAI provider, lines 247-300](https://ai-sdk.dev/providers/ai-sdk-providers/xai).
- xAI/Grok model creation uses `xai(modelId)` for Chat API by default; `xai.responses(modelId)` explicitly uses the Responses API. Source: [AI SDK xAI provider, lines 301-339](https://ai-sdk.dev/providers/ai-sdk-providers/xai).
- xAI chat models support `providerOptions.xai.reasoningEffort` with values `low` or `high`. Source: [AI SDK xAI provider, lines 340-402](https://ai-sdk.dev/providers/ai-sdk-providers/xai).
- xAI Responses API provider options support `reasoningEffort: 'low' | 'medium' | 'high'`; docs also show a non-reasoning model ID, `grok-4-fast-non-reasoning`. Source: [AI SDK xAI provider, lines 996-1069](https://ai-sdk.dev/providers/ai-sdk-providers/xai).
- OpenRouter is documented as an AI SDK community provider using `@openrouter/ai-sdk-provider`, not a Vercel first-party provider package. Source: [AI SDK OpenRouter community provider, lines 247-286](https://ai-sdk.dev/providers/community-providers/openrouter).
- AI SDK's OpenRouter community page shows `createOpenRouter`, `openrouter.chat(modelId)`, and `openrouter.completion(modelId)`. Source: [AI SDK OpenRouter community provider, lines 287-316](https://ai-sdk.dev/providers/community-providers/openrouter).
- OpenRouter's official docs also install `@openrouter/ai-sdk-provider` and use `createOpenRouter`. Source: [OpenRouter Vercel AI SDK docs, lines 88-114](https://openrouter.ai/docs/guides/community/vercel-ai-sdk).

### Provider-specific control summary

| Provider | Official AI SDK package/page | Disable or minimize reasoning |
| --- | --- | --- |
| DeepSeek | `@ai-sdk/deepseek` | Best official path: use `providerOptions.deepseek.thinking = { type: 'disabled' }` to disable thinking. Do not rely on `reasoningEffort: 'none'`; DeepSeek official API only documents `high` and `max`, maps lower values upward, and defaults thinking to enabled. |
| OpenAI | `@ai-sdk/openai` | Use `providerOptions.openai.reasoningEffort`. To disable, `none` only works on GPT-5.1 models. Otherwise minimize with `minimal` or `low` where supported. Keep `reasoningSummary` unset unless summaries are needed. |
| Anthropic | `@ai-sdk/anthropic` | Avoid setting `thinking` unless needed. For supported models, minimize with `providerOptions.anthropic.effort = 'low'`. For budget-based thinking, use the lowest valid `budgetTokens` only when extended thinking is intentionally enabled. No `thinking: { type: 'disabled' }` value was found in AI SDK docs. |
| Google/Gemini | `@ai-sdk/google` | Gemini 2.5: set `providerOptions.google.thinkingConfig.thinkingBudget = 0` to disable if the model supports it, or a small positive budget to minimize. Gemini 3: use `thinkingLevel: 'minimal'` or `low` depending on model support. Leave `includeThoughts` false or unset unless summaries are needed. |
| xAI/Grok | `@ai-sdk/xai` | Chat API: minimize with `reasoningEffort: 'low'`; no disable value found. Responses API: minimize with `low` or select a non-reasoning model such as `grok-4-fast-non-reasoning` where appropriate. |
| OpenRouter | `@openrouter/ai-sdk-provider` community package | AI SDK/OpenRouter docs found no universal reasoning-off option. Use model IDs/routes that are non-reasoning when available, or provider-specific pass-through where OpenRouter/model docs explicitly support it. |
| Generic OpenAI-compatible | `@ai-sdk/openai-compatible` | Supports provider-dependent `reasoningEffort string` and generic provider-specific request-body passthrough under the configured provider name. This may be a fallback path for DeepSeek `thinking`, but the first-party `@ai-sdk/deepseek` package is clearer and has typed options. |

### First-class provider settings summary

| Settings choice | Package status in AI SDK docs | Provider creation API | Model API | Base URL needed in Settings? |
| --- | --- | --- | --- | --- |
| OpenAI | First-party `@ai-sdk/openai` | `createOpenAI({ apiKey, fetch? })` or default `openai` | `openai(modelId)`, `openai.responses(modelId)`, `openai.chat(modelId)`, `openai.completion(modelId)` | No. Optional `baseURL` can remain an advanced override. |
| DeepSeek | First-party `@ai-sdk/deepseek` | `createDeepSeek({ apiKey, fetch? })` or default `deepseek` | `deepseek(modelId)`, `deepseek.chat(modelId)`, `deepseek.languageModel(modelId)` | No. Optional `baseURL` exists for proxy/custom endpoint use. |
| Anthropic | First-party `@ai-sdk/anthropic` | `createAnthropic({ apiKey, fetch? })` or default `anthropic` | `anthropic(modelId)`, `anthropic.languageModel(modelId)`, `anthropic.chat(modelId)`, `anthropic.messages(modelId)` | No. Current app already treats Anthropic this way. |
| Google/Gemini | First-party `@ai-sdk/google` | `createGoogleGenerativeAI({ apiKey, fetch? })` or default `google` | `google(modelId)` | No. Optional `baseURL` exists for proxy/custom endpoint use. |
| xAI/Grok | First-party `@ai-sdk/xai` | `createXai({ apiKey, fetch? })` or default `xai` | `xai(modelId)` for Chat API, `xai.responses(modelId)` for Responses API | No. Optional `baseURL` exists for proxy/custom endpoint use. |
| OpenRouter | Community provider documented by AI SDK, `@openrouter/ai-sdk-provider` | `createOpenRouter({ apiKey })` | AI SDK page: `openrouter.chat(modelId)` / `openrouter.completion(modelId)`; OpenRouter docs also show `openrouter(modelName)` | No. Use OpenRouter model IDs like `anthropic/...` or `google/...`. |
| Manual OpenAI-compatible | First-party `@ai-sdk/openai-compatible` | `createOpenAICompatible({ name, apiKey, baseURL })` | `provider(modelId)`, plus chat/completion/embedding APIs depending on setup | Yes. This remains the escape hatch for arbitrary OpenAI-compatible endpoints. |

### Implications for this repo

- DeepSeek should not be controlled through the existing `providerOptions.openai.reasoningEffort = 'none'` as the primary disable path. Current DeepSeek docs and current AI SDK docs point to `thinking: { type: 'disabled' }`.
- If provider-specific reasoning controls are added, the runtime provider model likely needs either first-party provider packages or a provider capability layer that can emit different provider option keys (`deepseek`, `openai`, `anthropic`, `google`, `xai`, `openrouter`).
- The local `AiReasoningEffort` enum already contains values needed for OpenAI and xAI, but DeepSeek's official toggle is not an effort enum; it needs a separate on/off capability.
- Diagnostics should track requested/effective provider-specific controls, not only `openai.reasoningEffort`, because DeepSeek, Google, Anthropic, and xAI express controls differently.
- Settings-page provider choices can be first-class platform IDs instead of a single OpenAI-compatible bucket. That would let users choose OpenAI, DeepSeek, Anthropic, Google/Gemini, xAI/Grok, or OpenRouter and enter only API key plus model for normal hosted use.
- Keep manual OpenAI-compatible as an advanced/custom option for local models, proxies, and providers not covered by first-class package docs, because it is the only official AI SDK path that intentionally requires a user-entered base URL.
- Credential storage currently has a fixed two-provider map; adding first-class platform IDs requires extending keychain account mapping and credential status schemas for each new provider ID.
- Runtime config currently collapses every non-Anthropic provider into OpenAI-compatible. First-class providers need a broader `AiProviderRuntimeConfig` discriminated union and corresponding branches in `createAiProviderModel`.

## Related Specs

- `.trellis/spec/backend/index.md` - Backend service module and type-safety guidelines apply to provider runtime and generation services.
- `.trellis/spec/shared/index.md` - Shared type and Zod schema guidance applies to diagnostics/control schemas.
- `.trellis/spec/product/index.md` - Product spec applies because provider calls, privacy disclosure, raw response handling, and review agent behavior are user-facing contracts.
- `.trellis/spec/frontend/index.md` - Relevant if settings UI exposes provider-specific reasoning controls.

## Caveats / Not Found

- Official AI SDK docs now resolve at `https://ai-sdk.dev/...`; I did not find a separate canonical `docs.ai-sdk.dev` page for the requested provider docs.
- I used official AI SDK/Vercel docs and official provider docs where available. OpenRouter is a community provider in AI SDK docs, but its own official docs also document the same package.
- I found no official AI SDK docs that make `reasoningEffort: 'none'` a valid DeepSeek disable mechanism.
- I found no official AI SDK OpenRouter documentation for a universal text reasoning disable/minimize option.
- I did not inspect package source or TypeScript declarations from `node_modules`; conclusions are based on official documentation and the repo files listed above.
