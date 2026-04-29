# Research: MVP review runtime integration

- **Query**: Determine whether English Coach v0.1 should use pi-mono or a minimal direct provider adapter for live journal review.
- **Scope**: internal architecture decision with prior pi-mono research context
- **Date**: 2026-04-29

## Updated Decision

MVP v0.1 should not bind to pi-mono. English Coach needs a headless structured LLM call, schema validation, quote anchoring, privacy gating, and main-process persistence. It does not need coding-agent tools, file access, command execution, multi-step planning, or agent session management for the first review loop.

Use a minimal `ReviewModelClient` provider adapter in v0.1:

```text
ReviewService
  -> ReviewModelClient provider adapter
  -> structured output / JSON schema
  -> validateReviewResult
  -> quote anchoring
  -> review_runs status update
```

Keep pi-mono as a v0.2+ optional runtime adapter if the product later needs multi-step agent workflows, controlled tools, reusable prompt/session management, or transcript replay.

## Findings

### Files Found

| File Path | Description |
|---|---|
| `/home/chumeng/Documents/Frontend/english-coach/package.json` | App manifest; no pi-mono dependency or pi-related script. |
| `/home/chumeng/Documents/Frontend/english-coach/pnpm-lock.yaml` | Lockfile; no `pi-mono`, `@mariozechner/pi-coding-agent`, `@mariozechner/pi-agent-core`, or `@mariozechner/pi-ai` dependency found by text search. |
| `/home/chumeng/Documents/Frontend/english-coach/src/main/services/review/lib/pi-mono-agent.ts` | Current local integration seam; `callPiMonoReviewAgent` is a stub that throws, and `parseReviewAgentJson` only parses raw JSON into the local response shape. |
| `/home/chumeng/Documents/Frontend/english-coach/src/main/services/review/types.ts` | Local review-agent service contract: `ReviewAgentRequest` has `systemPrompt`, `userPrompt`, and validated `input`; `ReviewAgentResponse` has `output: unknown` and `rawOutput: unknown`. |
| `/home/chumeng/Documents/Frontend/english-coach/src/main/services/review/procedures/start.ts` | Main-process review flow calls `options.agent ?? callPiMonoReviewAgent`, validates `agentResponse.output`, and stores `agentResponse.rawOutput` depending on settings. |
| `/home/chumeng/Documents/Frontend/english-coach/test/review-integration.test.ts` | Contract tests cover bounded input and prompt delimiting; no live provider adapter yet. |
| `/home/chumeng/Documents/Frontend/english-coach/src/shared/types/settings.ts` | Settings type includes display-only `piMonoAuthStatus`. |
| `/home/chumeng/Documents/Frontend/english-coach/src/main/services/settings/service.ts` | Settings service currently reports `piMonoAuthStatus: 'not-configured'`. |
| `/home/chumeng/Documents/Frontend/english-coach/.trellis/tasks/04-29-v0-1-review-agent-integration/prd.md` | Active task PRD requires main-process pi-mono call, bounded context, structured JSON, raw-output setting, and validation. |
| `/home/chumeng/Documents/Frontend/english-coach/.trellis/spec/product/review-agent-contract.md` | Product-level agent input/output, prompt-safety, quote anchoring, and validation contract. |
| `/home/chumeng/Documents/Frontend/english-coach/.trellis/spec/product/privacy-security.md` | Product-level privacy, provider disclosure, secret handling, and main/renderer boundary contract. |
| `/home/chumeng/Documents/Frontend/english-coach/.trellis/spec/product/validation-and-testing.md` | Requires shared `validateReviewResult` harness as the only boundary from raw agent JSON to preview operations. |
| `/home/chumeng/Documents/Frontend/english-coach/.trellis/spec/frontend/ipc-electron.md` | Settings IPC contract lists `piMonoAuthStatus` as display-only foundation status. |
| `/home/chumeng/Documents/Frontend/english-coach/.trellis/tasks/archive/2026-04/04-29-english-journal-coach-mvp/source-prd.md` | Original PRD says pi-mono is the agent runtime and Electron main process invokes it, but does not define a command/API/env contract. |

### Code Patterns

Local app-side seam already exists, but it is explicitly unimplemented:

```ts
// /home/chumeng/Documents/Frontend/english-coach/src/main/services/review/lib/pi-mono-agent.ts:3-5
export const callPiMonoReviewAgent: ReviewAgent = async () => {
  throw new Error('pi-mono review agent is not configured.');
};
```

The local service interface expected by the rest of the app is narrow and testable:

```ts
// /home/chumeng/Documents/Frontend/english-coach/src/main/services/review/types.ts:15-28
export const reviewAgentRequestSchema = z.object({
  systemPrompt: z.string().min(1),
  userPrompt: z.string().min(1),
  input: reviewInputSchema,
});

export const reviewAgentResponseSchema = z.object({
  output: z.unknown(),
  rawOutput: z.unknown(),
});

export type ReviewAgent = (request: ReviewAgentRequest) => Promise<ReviewAgentResponse>;
```

The main process review flow already consumes this seam and validates the unknown output through the shared harness:

```ts
// /home/chumeng/Documents/Frontend/english-coach/src/main/services/review/procedures/start.ts:82-93
const agent = options.agent ?? callPiMonoReviewAgent;
const agentResponse = await agent({
  systemPrompt: REVIEW_SYSTEM_PROMPT,
  userPrompt: buildReviewUserPrompt(reviewInput),
  input: reviewInput,
});
const persistenceDecision = buildReviewPersistenceDecision({
  validation: validateReviewResult(reviewInput, agentResponse.output),
  rawOutput: agentResponse.rawOutput,
  rawResponseStorageEnabled: settings.rawResponseStorageEnabled,
});
```

The local helper `parseReviewAgentJson` accepts plain JSON text, parses it as the agent `output`, and preserves the original string as `rawOutput`:

```ts
// /home/chumeng/Documents/Frontend/english-coach/src/main/services/review/lib/pi-mono-agent.ts:7-12
export function parseReviewAgentJson(rawOutput: string): ReturnType<typeof reviewAgentResponseSchema.parse> {
  return reviewAgentResponseSchema.parse({
    output: JSON.parse(rawOutput) as unknown,
    rawOutput,
  });
}
```

This helper is a local JSON parsing boundary, not evidence of a pi-mono CLI or SDK contract.

### Local Repo / Workspace Contract

The repo defines what a review agent must receive and return, but not how pi-mono is invoked.

Internal contracts found:

- `/home/chumeng/Documents/Frontend/english-coach/.trellis/spec/product/review-agent-contract.md:3-7`: agent does language judgment only; Electron app owns state, permissions, validation, persistence, pattern reuse, and database writes.
- `/home/chumeng/Documents/Frontend/english-coach/.trellis/spec/product/review-agent-contract.md:9-24`: journal content must be wrapped in `<journal_content>` and the system prompt must require JSON matching the schema.
- `/home/chumeng/Documents/Frontend/english-coach/.trellis/spec/product/review-agent-contract.md:26-44`: `ReviewInput` fields and v0.1 caps.
- `/home/chumeng/Documents/Frontend/english-coach/.trellis/spec/product/review-agent-contract.md:111-124`: validate JSON with Zod, locate anchors, check matched pattern IDs, and store validation errors; validation failure must not write long-term statistics.
- `/home/chumeng/Documents/Frontend/english-coach/.trellis/spec/product/privacy-security.md:72-76`: main process owns agent calls and secrets; renderer must use narrow IPC and must not access Node/Electron APIs directly.
- `/home/chumeng/Documents/Frontend/english-coach/.trellis/spec/product/validation-and-testing.md:30-32`: live pi-mono integration must use shared contract functions and not create a second validation path.

No local contract found for:

- pi-mono package name to install in this repo.
- pi-mono CLI executable name or command-line flags for this app.
- pi-mono SDK function/import to call for this app.
- pi-mono-specific environment variables for provider/model/auth.
- pi-mono config file path or agent definition for a journal review agent.
- a project-local `.pi` package/extension/prompt-template contract.

Sibling search scope `/home/chumeng/Documents/Frontend` found no additional local pi-mono integration contract outside `english-coach`.

### Package / Dependency Findings

`/home/chumeng/Documents/Frontend/english-coach/package.json` has no pi-mono dependency. Current dependencies are Electron, SQLite/Drizzle, settings/keychain, React, and Zod. Relevant lines:

- `/home/chumeng/Documents/Frontend/english-coach/package.json:19-35` lists runtime dependencies and does not include pi-mono packages.
- `/home/chumeng/Documents/Frontend/english-coach/package.json:36-50` lists dev dependencies and does not include pi-mono packages.

Text search found no pi-mono package in `/home/chumeng/Documents/Frontend/english-coach/pnpm-lock.yaml`.

Local PATH checks found no `pi-mono` or `pimono` executable. `npm view pi-mono --json` returned npm 404: package `pi-mono` does not exist on npm under that exact name.

`npm search pi-mono --json` found public packages related to GitHub repo `badlogic/pi-mono`, most importantly:

- `@mariozechner/pi-coding-agent` version `0.70.6`, CLI bin `pi`, package description `Coding agent CLI with read, bash, edit, write tools and session management`, repository `https://github.com/badlogic/pi-mono.git`, package subdirectory `packages/coding-agent`.
- Related packages/extensions include `@mariozechner/pi-agent-core`, `@mariozechner/pi-ai`, `pi-extensions`, `pi-mono-review`, and others, but none are referenced by this project.

`npm view @mariozechner/pi-coding-agent bin dependencies exports main types --json` showed:

```json
{
  "bin": { "pi": "dist/cli.js" },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
    "./hooks": { "types": "./dist/core/hooks/index.d.ts", "import": "./dist/core/hooks/index.js" }
  }
}
```

This is a public package contract for the pi coding agent, not a project-local review-agent contract.

### Public Documentation Findings

Public docs from `https://github.com/badlogic/pi-mono` indicate the pi coding agent supports multiple integration modes, but do not define this project's journal-review schema or a ready-made review-agent invocation.

Key public docs:

- `https://raw.githubusercontent.com/badlogic/pi-mono/main/packages/coding-agent/README.md`: states pi runs in four modes: interactive, print or JSON, RPC for process integration, and an SDK for embedding in apps. It also lists auth via API keys, including `ANTHROPIC_API_KEY` in installation examples.
- `https://raw.githubusercontent.com/badlogic/pi-mono/main/packages/coding-agent/docs/json.md`: documents JSON event stream mode: `pi --mode json "Your prompt"`; outputs all session events as JSON lines to stdout.
- `https://raw.githubusercontent.com/badlogic/pi-mono/main/packages/coding-agent/docs/rpc.md`: documents RPC mode: `pi --mode rpc [options]`; commands are JSON objects on stdin, responses/events are JSON lines on stdout. Common options include `--provider <name>`, `--model <pattern>`, `--no-session`, and `--session-dir <path>`. The docs explicitly note that Node/TypeScript users should consider using `AgentSession` directly from `@mariozechner/pi-coding-agent` instead of spawning a subprocess.
- `https://raw.githubusercontent.com/badlogic/pi-mono/main/packages/coding-agent/docs/sdk.md`: documents SDK installation and usage with `npm install @mariozechner/pi-coding-agent`, `createAgentSession`, `AuthStorage`, `ModelRegistry`, and `SessionManager`; `session.prompt(text)` sends prompts and events stream through `session.subscribe`.
- `https://raw.githubusercontent.com/badlogic/pi-mono/main/packages/coding-agent/examples/extensions/structured-output.ts`: demonstrates a structured-output extension tool using `defineTool`, Typebox parameters, `details`, and `terminate: true` so the agent can end on a tool call.

Relevant public snippets:

```bash
# pi JSON event stream mode
pi --mode json "Your prompt"
```

```bash
# pi RPC mode
pi --mode rpc [options]
```

```json
{"id": "req-1", "type": "prompt", "message": "Hello, world!"}
```

```ts
// SDK quick start from public docs
import { AuthStorage, createAgentSession, ModelRegistry, SessionManager } from "@mariozechner/pi-coding-agent";

const authStorage = AuthStorage.create();
const modelRegistry = ModelRegistry.create(authStorage);
const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
  authStorage,
  modelRegistry,
});

session.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

await session.prompt("What files are in the current directory?");
```

```ts
// Structured output example concept from public docs
const structuredOutputTool = defineTool({
  name: "structured_output",
  description: "Return a final structured answer...",
  parameters: Type.Object({
    headline: Type.String(),
    summary: Type.String(),
    actionItems: Type.Array(Type.String()),
  }),
  async execute(_toolCallId, params) {
    return {
      content: [{ type: "text", text: `Saved structured output: ${params.headline}` }],
      details: params,
      terminate: true,
    };
  },
});
```

### Environment Variables

Local repo search found no pi-mono-specific environment variables.

Public pi docs mention provider API-key authentication examples such as:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

No local contract maps Electron settings/keychain/provider selection to pi's auth storage, API-key environment variables, `~/.pi/agent/auth.json`, or model configuration.

### Related Specs

- `/home/chumeng/Documents/Frontend/english-coach/.trellis/spec/product/review-agent-contract.md` — review input/output, prompt safety, quote anchoring, validation rules.
- `/home/chumeng/Documents/Frontend/english-coach/.trellis/spec/product/privacy-security.md` — provider disclosure, secret handling, raw response storage, main-process agent-call ownership.
- `/home/chumeng/Documents/Frontend/english-coach/.trellis/spec/product/validation-and-testing.md` — validation harness must be shared by live pi-mono integration and mocks.
- `/home/chumeng/Documents/Frontend/english-coach/.trellis/spec/product/data-model-contract.md` — v0.1 limit: do not send all patterns to the review agent; limit is 30.
- `/home/chumeng/Documents/Frontend/english-coach/.trellis/spec/frontend/ipc-electron.md` — renderer/main IPC boundary and display-only pi-mono status.

## Caveats / Not Found

- No concrete local pi-mono invocation command/API exists for this app.
- No installed dependency or lockfile entry exists for `@mariozechner/pi-coding-agent` or a pi-mono SDK/runtime package.
- No executable named `pi`, `pi-mono`, or `pimono` was verified as locally installed for this project; PATH checks for `pi-mono` and `pimono` were empty. The public package exposes `pi`, but this repo does not depend on it.
- Public pi docs describe generic integration surfaces (CLI JSON events, RPC JSONL, SDK, structured-output extension), not the concrete review-agent schema, provider/auth handoff, or exact extraction of one structured JSON review result for `english-coach`.
- Implementing a live call now would require choosing and adding a contract not currently present in repo/specs: SDK vs subprocess/RPC, package version, auth/config source, model/provider settings, no-tools behavior, and structured-output extraction method.

## Concise Recommendation

For MVP v0.1, implement live review through a minimal direct provider adapter behind `ReviewModelClient`/`ReviewAgent`, not pi-mono. Keep the app-side seam, validation/status/raw-output flow, disclosure gate, and keychain-owned provider settings. Add pi-mono only as a later optional adapter if the product needs multi-step agent workflows or controlled tool calls.
