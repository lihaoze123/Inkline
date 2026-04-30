# Research: AI SDK structured generation and providers

- **Query**: Research Vercel AI SDK usage for an Electron/Node TypeScript backend that needs structured generation and multi-provider support. Cover package names needed for `ai`, OpenAI-compatible/custom baseURL, Anthropic provider, `generateObject` with Zod, error/retry considerations, Node/Electron compatibility, and mapping onto an existing app with strict downstream validation.
- **Scope**: mixed
- **Date**: 2026-04-30

## Findings

### Files Found

| File Path | Description |
|---|---|
| `package.json` | Electron + TypeScript app; Node engine `>=22.0.0`, zod `^4.2.0`, no AI SDK packages currently installed. |
| `src/main/services/review/lib/openai-compatible-agent.ts` | Current direct OpenAI-compatible adapter using `electron.net.fetch`, `{baseUrl}/chat/completions`, `response_format: { type: 'json_object' }`, manual timeout, and JSON parsing. |
| `src/main/services/review/types.ts` | Review agent seam: request includes `systemPrompt`, `userPrompt`, validated `ReviewInput`; response exposes `output: unknown` and `rawOutput: unknown`. |
| `src/shared/review-contract/schemas.ts` | Zod schemas for review input/output, closed enums, caps, anchoring payloads, and output type definitions. |
| `src/shared/review-contract/validation.ts` | Strict downstream validation after model output: schema parse, content hash, quote anchoring, caps, references, focus/self-repair/input-bridge checks. |
| `src/main/services/review/procedures/start.ts` | Review flow calls agent, then `validateReviewResult(reviewInput, agentResponse.output)` before persistence; maps malformed JSON/validation/provider errors to run statuses. |
| `.trellis/spec/product/review-agent-contract.md` | Product/runtime contract for minimal review agent: main process owns provider settings, keychain, network call, validation, persistence; renderer never touches provider SDKs. |
| `.trellis/spec/big-question/network-stack-differences.md` | Project note explaining why main-process external HTTP should use Electron `net.fetch()` rather than Node/global fetch for proxy/VPN behavior. |
| `.trellis/spec/backend/error-handling.md` | Backend error-handling patterns for input validation, external dependency failures, and sanitized user-facing errors. |

### Code Patterns

- Current provider implementation is a one-shot main-process adapter. It builds the request at `src/main/services/review/lib/openai-compatible-agent.ts:107-116`, uses injected `fetchImpl` or `net.fetch` at `src/main/services/review/lib/openai-compatible-agent.ts:118-128`, handles non-2xx responses at `src/main/services/review/lib/openai-compatible-agent.ts:130-134`, and returns parsed JSON at `src/main/services/review/lib/openai-compatible-agent.ts:136-137`.
- The current adapter treats provider JSON as a boundary object only. `parseJsonContent` wraps parsed JSON into `reviewAgentResponseSchema.parse({ output, rawOutput })` at `src/main/services/review/lib/openai-compatible-agent.ts:59-72`; the actual review contract is still enforced later.
- The downstream boundary is intentionally strict: `validateReviewResult` begins with `reviewOutputSchema.safeParse(agentOutput)` at `src/shared/review-contract/validation.ts:101-116`, then applies app-specific checks such as content hash, anchoring, caps, correction references, and warning/invalid status before returning operations at `src/shared/review-contract/validation.ts:118-200`.
- The main review procedure does not persist usable review data until validation passes: agent call at `src/main/services/review/procedures/start.ts:191-197`, validation-failed persistence at `src/main/services/review/procedures/start.ts:203-228`, successful persistence of parsed output and operations at `src/main/services/review/procedures/start.ts:250-268`, and error classification at `src/main/services/review/procedures/start.ts:343-357`.
- Project spec requires `output` to remain untrusted `unknown` until shared validation passes: `.trellis/spec/product/review-agent-contract.md:194-203`; it also explicitly requires `net.fetch` for OpenAI-compatible calls at `.trellis/spec/product/review-agent-contract.md:198-200`.

### AI SDK Packages and Provider Setup

- Current npm metadata checked on 2026-04-30:
  - `ai@6.0.170`: core SDK, peer dependency `zod: ^3.25.76 || ^4.1.8`, engine `node >=18`.
  - `@ai-sdk/openai@3.0.54`: OpenAI provider, peer dependency `zod: ^3.25.76 || ^4.1.8`, engine `node >=18`.
  - `@ai-sdk/anthropic@3.0.72`: Anthropic provider, peer dependency `zod: ^3.25.76 || ^4.1.8`, engine `node >=18`.
  - `@ai-sdk/provider@3.0.9`: provider interface package, engine `node >=18`; pulled by the SDK/providers and normally not needed as an app dependency unless typing provider abstractions directly.
- For this repo's `package.json`, the existing `zod@^4.2.0` and `node >=22.0.0` satisfy the current AI SDK peer/engine constraints.
- Minimal packages for direct OpenAI-compatible and Anthropic support are `ai`, `@ai-sdk/openai`, and `@ai-sdk/anthropic`. `@ai-sdk/provider` is transitive unless app code imports its types directly.

### OpenAI-Compatible / Custom Base URL

- `@ai-sdk/openai` exports `createOpenAI(options?: OpenAIProviderSettings)` and default `openai` provider.
- Provider settings from package type definitions include:
  - `baseURL?: string` — base URL for OpenAI API calls.
  - `apiKey?: string` — API key.
  - `organization?: string`, `project?: string`.
  - `headers?: Record<string, string>`.
  - `name?: string` — overrides default provider name for third-party providers.
  - `fetch?: FetchFunction` — custom fetch implementation.
- Mapping to current settings: current `settings.baseUrl`, `settings.model`, and OS-keychain API key can create a provider instance like `createOpenAI({ baseURL, apiKey, name, fetch })`, then call a model by ID through that provider.
- Important compatibility caveat: AI SDK OpenAI provider supports custom `baseURL`, but exact endpoint selection depends on model/provider behavior. The existing direct adapter always calls chat completions at `{baseUrl}/chat/completions` (`src/main/services/review/lib/openai-compatible-agent.ts:32-39`). AI SDK v6 examples emphasize `generateText` + structured `Output.object`; the OpenAI provider package contains both chat and responses implementations. Any migration should verify the selected OpenAI-compatible endpoint against the target provider.

### Anthropic Provider

- `@ai-sdk/anthropic` exports `createAnthropic(options?: AnthropicProviderSettings)` and default `anthropic` provider.
- Provider settings from package type definitions include:
  - `baseURL?: string` — default prefix is `https://api.anthropic.com/v1`; can use proxy servers.
  - `apiKey?: string` — sent via `x-api-key`, defaulting to `ANTHROPIC_API_KEY` if not supplied.
  - `authToken?: string` — sent via `Authorization: Bearer`, defaulting to `ANTHROPIC_AUTH_TOKEN`; only one of `apiKey` or `authToken` is required.
  - `headers?: Record<string, string>`.
  - `fetch?: FetchFunction`.
  - `generateId?: () => string`.
  - `name?: string`, defaulting to `anthropic.messages`.
- This maps to a second provider branch under the existing main-process review seam. Key storage/settings need to distinguish Anthropic API key/token from the current OpenAI-compatible key before invoking `createAnthropic`.

### Structured Generation with Zod

- AI SDK v6 packaged docs state that structured object generation is now part of `generateText` / `streamText` through the `output` property, not the older standalone `generateObject` flow. The relevant doc page says: "The AI SDK standardises structured object generation across model providers using the `output` property on `generateText` and `streamText`."
- Current v6 object pattern:

```ts
import { generateText, Output } from 'ai';
import { z } from 'zod';

const { output } = await generateText({
  model,
  output: Output.object({
    schema: z.object({
      name: z.string(),
      age: z.number().nullable(),
      labels: z.array(z.string()),
    }),
  }),
  prompt: 'Generate information for a test user.',
});
```

- The same docs say `Output.object({ schema })` type-validates the returned result against a Zod schema, and schemas can use `.describe(...)` to provide model hints.
- User asked specifically for `generateObject` with Zod. The current installed/latest AI SDK docs available from `ai@6.0.170` no longer foreground `generateObject`; they document `generateText({ output: Output.object({ schema }) })`. If implementing against an older AI SDK major, verify the installed version's `generateObject` signature before coding. In v6, use `generateText` + `Output.object` for structured generation.
- Mapping to this app: `reviewOutputSchema` from `src/shared/review-contract/schemas.ts` can be the AI SDK structured output schema, but AI SDK validation should be treated as an early parse/shape check only. The app must still pass `output` through `validateReviewResult` because AI SDK schema validation cannot enforce all app-specific constraints such as quote anchoring, content hash, caps, existing pattern IDs, self-repair hint leakage, and learning-history write rules.

### Errors, Retry, Timeout

- AI SDK common generation settings include:
  - `maxRetries?: number` — maximum number of retries; default `2`; set `0` to disable.
  - `abortSignal?: AbortSignal` — cancels the call.
  - `timeout?: number | { totalMs?: number; stepMs?: number }` — aborts calls after a duration; can be combined with `abortSignal`.
  - `headers?: Record<string, string | undefined>` — request-specific headers for HTTP providers.
- AI SDK error docs identify:
  - `NoObjectGeneratedError` (docs refer to `AI_NoObjectGeneratedError`) when structured generation cannot produce a parsable object conforming to schema; preserves generated text, response metadata, usage, and cause.
  - `APICallError` for failed API calls; properties include `url`, `requestBodyValues`, `statusCode`, `responseHeaders`, `responseBody`, `isRetryable`, `data`, and `cause`; check with `APICallError.isInstance(error)`.
  - `RetryError` for retry exhaustion; properties include `reason`, `lastError`, `errors`, and `message`; check with `RetryError.isInstance(error)`.
- The current app classifies errors using message substrings at `src/main/services/review/procedures/start.ts:343-357` and only extracts provider status from `/(\d{3})/` at `src/main/services/review/procedures/start.ts:359-362`. AI SDK typed errors can provide status/retry/no-object distinctions, but they should still be mapped into the existing external-dependency failure categories and sanitized user-facing messages.
- Retry consideration for strict downstream validation: AI SDK default `maxRetries: 2` retries transport/retryable provider failures, not necessarily app-level validation failures from `validateReviewResult`. If a model output passes AI SDK schema but fails app validation, the current flow records `review_failed`; app-level repair/retry would be separate behavior and is not provided by the existing validation contract.

### Node / Electron Compatibility

- AI SDK and provider packages currently require Node `>=18`; this repo requires Node `>=22.0.0`, so runtime engine compatibility is satisfied.
- Electron main process compatibility caveat: the project has a documented requirement to use Electron `net.fetch` for external main-process HTTP because Node/global fetch may ignore system proxy/VPN configuration (`.trellis/spec/big-question/network-stack-differences.md:31-40`, `.trellis/spec/big-question/network-stack-differences.md:69-81`).
- Both OpenAI and Anthropic AI SDK provider settings expose `fetch?: FetchFunction`, which is the hook needed to preserve the current `net.fetch` behavior. A wrapper may be needed if TypeScript's `net.fetch` type differs from the provider's expected FetchFunction, but behaviorally this is the compatibility point.
- Keep provider SDK calls in Electron main only. The project contract says renderer must not import provider SDKs/API keys/keychain/database modules (`.trellis/spec/product/review-agent-contract.md:194-195`, `.trellis/spec/product/review-agent-contract.md:230-239`).

### Mapping to Existing Strict Validation App

- Existing app seam already matches AI SDK well: `ReviewAgent` returns `output: unknown` and `rawOutput: unknown` (`src/main/services/review/types.ts:21-28`). An AI SDK-backed adapter can preserve that seam by returning the structured object as `output` and provider/result metadata or text/body as `rawOutput` according to privacy settings.
- Structured generation with AI SDK should replace manual JSON parsing for provider-normalized object generation, but should not replace `validateReviewResult`. The app has stricter semantic and anchoring contracts than a Zod schema can express.
- The existing prompt-safety/product contract remains load-bearing: model receives only system/user prompts, no filesystem/shell/database/generic tools (`.trellis/spec/product/review-agent-contract.md:203-204`, `.trellis/spec/product/review-agent-contract.md:220-227`).
- A multi-provider implementation maps naturally to a provider factory inside main process: load settings/keychain, choose OpenAI-compatible vs Anthropic, create the provider with `apiKey/baseURL/fetch`, call the selected model, return through `ReviewAgent`, then run unchanged validation/persistence.
- Result handling should preserve the current distinction between provider/transport failures, malformed structured output, and app validation failures. AI SDK `NoObjectGeneratedError` corresponds most closely to current malformed/invalid provider JSON handling; `APICallError`/`RetryError` correspond to provider/network/auth errors.

### External References

- [AI SDK package on npm](https://www.npmjs.com/package/ai) — current metadata: `ai@6.0.170`, zod peer `^3.25.76 || ^4.1.8`, Node `>=18`.
- [OpenAI provider package on npm](https://www.npmjs.com/package/@ai-sdk/openai) — current metadata: `@ai-sdk/openai@3.0.54`, exposes `createOpenAI` with `baseURL`, `apiKey`, `headers`, `name`, and `fetch` settings.
- [Anthropic provider package on npm](https://www.npmjs.com/package/@ai-sdk/anthropic) — current metadata: `@ai-sdk/anthropic@3.0.72`, exposes `createAnthropic` with `baseURL`, `apiKey`/`authToken`, `headers`, and `fetch` settings.
- [AI SDK structured data docs](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data) — current v6 docs show `generateText` with `Output.object({ schema })` for Zod-backed structured output.
- [AI SDK settings docs](https://ai-sdk.dev/docs/ai-sdk-core/settings) — documents `maxRetries`, `abortSignal`, `timeout`, and request `headers`.
- [AI SDK API call error docs](https://ai-sdk.dev/docs/reference/ai-sdk-errors/ai-api-call-error) — documents `APICallError` shape and `APICallError.isInstance`.
- [AI SDK retry error docs](https://ai-sdk.dev/docs/reference/ai-sdk-errors/ai-retry-error) — documents `RetryError` shape and `RetryError.isInstance`.

### Related Specs

- `.trellis/spec/product/review-agent-contract.md` — review runtime boundary, minimal provider adapter contract, validation/error matrix, and required tests.
- `.trellis/spec/big-question/network-stack-differences.md` — Electron `net.fetch` vs Node fetch behavior.
- `.trellis/spec/backend/error-handling.md` — backend treatment of external dependency and validation errors.
- `.trellis/spec/product/privacy-security.md` — relevant to provider keys/raw output storage (not read in detail for this report).

## Caveats / Not Found

- No active Trellis current task was set by `.trellis/scripts/task.py current --source`; the requested task directory existed and the user explicitly provided the target research path, so this file was written there.
- Current AI SDK v6 docs/package use `generateText` + `Output.object`, not the older `generateObject` API named in the query. Treat `generateObject` examples from older articles as version-sensitive.
- AI SDK provider custom `fetch` support exists in package type definitions, but this research did not compile a `net.fetch` wrapper against the provider's `FetchFunction` type.
- Endpoint behavior for third-party OpenAI-compatible providers should be smoke-tested because the existing adapter hard-codes `/chat/completions`, while AI SDK provider internals may select OpenAI chat/responses APIs depending on model/provider features.
