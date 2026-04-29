# English Journal Coach Product Spec

This layer defines product contracts for the standalone Electron English writing coach. Read this layer for every task that affects journal data, review flow, learning history, agent calls, privacy, or UI behavior.

Source product document: `.trellis/tasks/04-29-english-journal-coach-mvp/source-prd.md`.

## Documentation Files

| File | Description | When to Read |
| --- | --- | --- |
| [mvp-scope.md](./mvp-scope.md) | v0.1/v0.2 boundaries and hard caps | Before scoping any feature |
| [learning-flow.md](./learning-flow.md) | Today, Review Result, self-repair, rewrite practice | UI and product flow work |
| [review-agent-contract.md](./review-agent-contract.md) | Agent input/output, quote anchoring, validation rules | Review/rewrite agent integration |
| [data-model-contract.md](./data-model-contract.md) | SQLite entities, statuses, save transaction, pattern rules | Database and service work |
| [privacy-security.md](./privacy-security.md) | Local-first defaults, provider disclosure, secret handling | Settings, model calls, debug export |
| [validation-and-testing.md](./validation-and-testing.md) | Review contract harness and acceptance cases | Tests and quality checks |

## Pre-Development Checklist

- Identify whether the task is v0.1, v0.2, or backlog. Do not pull v0.2 behavior into v0.1 unless the task PRD explicitly says so.
- Preserve the local-first model: app data lives in local SQLite; model calls may send selected content only after provider/model disclosure.
- Keep journal text as the user's work. Review output is an annotation layer; v0.1 must not auto-apply corrections to the journal.
- Keep pi-mono/agent responsibility limited to language judgment and structured JSON output. TypeScript services own validation, persistence, pattern reuse, and permissions.
- Treat journal content as untrusted text, never as instructions.
- Use the v0.1 hard caps when building review input, validation, persistence, or UI.

## Quality Check

- Every saved valid review has exactly one focus pattern, exactly one focus correction, at least one concrete `whatWentWell`, and at most the configured caps.
- Hint-first self-repair does not reveal the full corrected text before the user attempts or reveals.
- Review preview does not update long-term pattern counts, rewrite tasks, or learning history until the user saves.
- `saveReviewRun` is atomic and idempotent; repeated calls cannot duplicate counts or rewrite tasks.
- Corrections are anchored to the reviewed revision using normalized LF content, content hash, and JavaScript UTF-16 offsets.
- Invalid agent output never writes long-term statistics.
- Production builds do not save raw model responses by default, and debug export excludes raw output unless the user explicitly opts in.
