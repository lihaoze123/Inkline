# Validation and Testing Contract

## Review Contract Harness

Before full UI work is considered reliable, build a harness that exercises review validation without depending on live model output.

Inputs:

```text
sample writing
mock agent output
existing patterns
template context, generated prompt/topic, and user goal/topic when relevant
```

Outputs:

```text
schema validation result
anchoring success rate
generated corrections
generated pattern operations
generated rewrite practice operations
validation_status
```

## Executable Contract: Review Contract Harness

### 1. Scope / Trigger

- Trigger: Any task that validates review-agent output, generates review preview operations, or simulates `saveReviewRun` idempotency.
- The harness is the shared contract between mock agent output, future live model integration, and Review Result UI persistence.
- Do not create a second validation path in UI or main-process code; import the shared contract functions instead.

### 2. Signatures

```ts
normalizeWritingContent(content: string): string;
locateAnchor(content: string, anchor: CorrectionAnchor): AnchorResult;
validateReviewResult(
  input: ReviewInput,
  agentOutput: unknown,
  options?: { lowConfidenceInvalidThreshold?: number },
): ReviewValidationResult;
new ReviewSaveStub().saveReviewRun(
  reviewRunId: string,
  operations: PreviewOperations,
): SaveSimulationSummary;
```

CLI signature:

```bash
pnpm run review:harness
```

### 3. Contracts

- `ReviewInput.contentHash` must equal `sha256(normalizeWritingContent(writingContent))`.
- `agentOutput` is `unknown` until it passes the Zod review output schema.
- `CorrectionAnchor.exact`, `prefix`, and `suffix` are located against LF-normalized content without normal-space collapsing.
- Successful anchors return JavaScript UTF-16 `startOffset` and `endOffset` for the reviewed content hash.
- `ReviewValidationResult.operations` are preview-stage operations only; every operation that carries `updatesLongTermStats` must set it to `false`.
- Invalid schema or invalid validation returns empty preview operations.
- The CLI output must include schema validation result, anchoring success rate, generated corrections, generated pattern operations, generated rewrite practice operations, validation status, issues, and save idempotency simulation.

### 4. Validation & Error Matrix

| Condition | Result |
| --- | --- |
| Zod schema parse fails | `schemaValid: false`, `validationStatus: invalid`, `schema_invalid`, empty operations |
| `contentHash` mismatches normalized writing content | `content_hash_mismatch`, `validationStatus: invalid`, empty operations |
| Anchor exact text cannot be located | Correction becomes `low_confidence`; too many low-confidence anchors make the result `invalid` |
| `originalText` differs from anchored exact text | Warning; anchor exact text remains authoritative |
| `matchedPatternId` is absent from `existingPatterns` | `matched_pattern_missing`, `validationStatus: invalid`, empty operations |
| Focus/self-repair/input bridge/rewrite indexes point outside corrections | `validationStatus: invalid`, empty operations |
| `selfRepairTask.hint` contains the full corrected text | `self_repair_hint_leaks_answer`, `validationStatus: invalid`, empty operations |
| `upgradeOpportunities` exceeds `maxUpgradeOpportunities`, has `sourceText` not found in writing content, or is mixed into corrections | `validationStatus: invalid`, empty operations |

### 5. Good/Base/Bad Cases

- Good: Short writing sample, one focus correction, one concrete `whatWentWell`, valid anchor, existing matched pattern, reference rewrite with `noticeTheGap`, one `rewrite_original` task.
- Base: Anchoring succeeds after LF normalization or curly-quote fallback; result may be `valid_with_warnings` but preview operations remain non-persistent.
- Bad: Paraphrased `exact`, missing focus pattern, multiple focus patterns, generic/empty `whatWentWell`, missing pattern ID, leaked self-repair answer, or rewrite task indexes that do not exist.

### 6. Tests Required

- Schema acceptance/rejection asserts `schemaValid`, `validationStatus`, issue codes, and empty operations on invalid output.
- Quote anchoring asserts repeated phrase disambiguation, multiline LF normalization, mixed Chinese/English UTF-16 offsets, curly quote fallback, irregular spaces not collapsed, and paraphrased exact downgrade.
- Operation generation asserts corrections, pattern reuse/new pattern suggestions, self-repair, reference rewrites, upgrade opportunities, input bridge, and rewrite practice are preview-only.
- Idempotency simulation asserts repeated `saveReviewRun(reviewRunId, operations)` does not duplicate pattern count increments, rewrite tasks, reference rewrites, or self-repair attempts.
- CLI test or manual run asserts `pnpm run review:harness` prints all required output fields.

### 7. Wrong vs Correct

Wrong: validate schema in one place, locate anchors in another, then let UI generate persistence operations from raw model JSON.

Correct: `validateReviewResult` is the only boundary from raw agent JSON to preview operations, and save code consumes those validated operations.

## Scenario: Inkline Feature Validation

### 1. Scope / Trigger

- Trigger: Any task that changes template selection, starter prompt generation, writing attempt persistence, template-aware review input, or D+1 rewrite practice.
- This validates the full product loop, not only TypeScript correctness.

### 2. Signatures

Commands:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm review:harness
pnpm dev -- --remote-debugging-port=9222
```

Core test targets:

```text
writing content normalization/hash
writing attempt/revision service
starter prompt generation service
review start/save service
review contract validation
rewrite practice service
renderer manual smoke
```

### 3. Contracts

- Automated checks must include lint, typecheck, and unit/integration tests for changed behavior.
- Review-flow changes must also run `pnpm review:harness`.
- Frontend/product-flow changes require a dev-app launch and manual UI verification when a graphical environment is available.
- Electron launches used for Chrome DevTools verification must expose the remote debugging port on `9222`; use `pnpm dev -- --remote-debugging-port=9222` rather than plain `pnpm dev`.
- Manual UI verification should cover template picker, starter disclosure, generate/regenerate, retry or failure copy, skip generation, optional goal/topic, autosave, review, save review, and due D+1 rewrite practice.
- If manual UI verification cannot be fully performed, report the limitation explicitly; do not claim it was done.

### 4. Validation & Error Matrix

| Condition | Required Response |
| --- | --- |
| Typecheck fails | Fix before reporting completion. |
| Lint fails | Fix before reporting completion. |
| Tests fail | Fix or document blocker; do not mark task complete. |
| Review harness fails | Fix review contract regression before completion. |
| `pnpm dev` cannot launch | Report environment/startup error and what was not manually verified. |
| Port `9222` is unavailable | Stop the stale Electron/Chrome debug process or report the port conflict; do not silently launch on another port for DevTools verification. |
| UI cannot be interacted with in the environment | Report that only launch/build was verified, not full manual golden path. |

### 5. Good/Base/Bad Cases

- Good: A feature touching review and UI passes `typecheck`, `lint`, `test`, `review:harness`, launches Electron, and has a manual golden-path note.
- Base: Headless session can launch Electron on remote debugging port `9222` but not interact; report launch success and manual interaction limitation.
- Bad: Only running tests after a frontend flow change and claiming the UI was manually verified.

### 6. Tests Required

- Template selection test: per-template attempts/drafts do not overwrite each other.
- Starter prompt tests: disclosure gate, success persistence, provider error/retry state, no essay content in provider request.
- Review input test: `writingTemplate`, `generatedPrompt`, `userGoal`, and `writingContent` are present as expected.
- Rewrite practice tests: save creates one D+1 focus task; complete/skip update state and return snapshots needed by UI reveal.
- Regression test: non-Journal review/save returns the selected template's writing snapshot.

### 7. Wrong vs Correct

#### Wrong

```text
pnpm test passed, so the template picker and starter prompt UI are verified.
```

#### Correct

```text
pnpm typecheck, pnpm lint, pnpm test, and pnpm review:harness passed. Electron dev launched with --remote-debugging-port=9222. Full manual interaction was not possible in this headless session, so UI golden path still needs human verification.
```

## Scenario: Deterministic Mock UI E2E

### 1. Scope / Trigger

- Trigger: Any task that adds or changes the headless UI e2e path for the review -> feedback save -> D+1 rewrite practice flow.
- This e2e validates the real Electron renderer and React UI through CDP-driven DOM interaction, not direct service calls.
- This e2e is deterministic and uses an e2e-only mock AI provider; live provider compatibility belongs in the separate live-provider e2e command.

### 2. Signatures

Commands:

```bash
pnpm test:e2e
pnpm test:e2e:headless
pnpm test:e2e:live
```

Environment:

```text
INKLINE_E2E_AI_MOCK=1
INKLINE_KEYCHAIN_SERVICE_NAME=<random e2e service name>
XDG_CONFIG_HOME=<temporary e2e config root>
E2E_CDP_PORT=<optional fixed CDP port>
DISPLAY=<provided by xvfb-run for pnpm test:e2e:headless>
E2E_OPENAI_COMPATIBLE_API_KEY=<live-provider command only>
E2E_OPENAI_COMPATIBLE_BASE_URL=<live-provider command only>
E2E_OPENAI_COMPATIBLE_MODEL=<live-provider command only>
```

### 3. Contracts

- `pnpm test:e2e` runs the deterministic mock UI full-chain and must not require real provider credentials.
- `pnpm test:e2e:headless` clears Wayland display state, forces an X11 session hint, and wraps the deterministic mock UI e2e with `xvfb-run -a`; it is the command Linux headless CI should run.
- `pnpm test:e2e:live` preserves the live-provider CDP workflow and must skip cleanly when `E2E_OPENAI_COMPATIBLE_*` variables are missing.
- The mock AI provider is hidden behind an e2e-only runtime flag and must not appear in public provider schemas, Settings options, or normal user-facing provider UI.
- The mock AI provider must only return output when the e2e flag is set and the runtime is not production/packaged.
- Deterministic fixtures belong under `test/fixtures/`; they are test assets, not product contracts.
- The UI e2e must use a fresh temporary app config/data root and an isolated e2e keychain service on every run.
- E2E-only Electron/Chromium flags such as remote debugging, fixed window size, `--disable-gpu`, or Linux-only `--no-sandbox` must be set by the e2e launcher, not by the normal `pnpm dev` script.
- Linux headless environments must provide a display driver via Xvfb; Chromium flags alone are not a replacement for `$DISPLAY`.
- Linux e2e launchers must force X11 (`--ozone-platform=x11`) so Wayland sessions do not bypass the Xvfb display.
- Failure artifacts for mock UI e2e may include screenshots and bounded DOM summaries; live-provider e2e must not capture screenshots by default because real writing content may be visible.

### 4. Validation & Error Matrix

| Condition | Required Response |
| --- | --- |
| Mock e2e flag is absent | Use normal provider behavior; do not return fixture output. |
| Runtime is production/packaged | Do not enable mock provider, even if the e2e flag is present. |
| Live-provider env vars are absent | `pnpm test:e2e:live` reports a clean skipped status with missing env names only. |
| `xvfb-run` is missing for `pnpm test:e2e:headless` | The command fails before Electron launch; install Xvfb in CI/dev shell rather than falling back to headed mode. |
| Wayland session variables leak into headless e2e | `pnpm test:e2e:headless` must clear `WAYLAND_DISPLAY`, set an X11 session hint, and the launcher must pass `--ozone-platform=x11`. |
| Deterministic UI e2e cannot launch Electron/CDP | Fail with the `launch-cdp` phase and recent sanitized Electron output. |
| Renderer API never becomes ready | Fail with the `renderer-api-readiness` phase. |
| A UI element is missing or disabled | Fail with the current phase plus bounded screenshot/DOM summary. |
| Review fixture fails schema or app validation | Fail the e2e and fix the fixture or contract; do not silently accept invalid output. |
| Rewrite-check fixture fails schema validation | Fail the e2e and fix the fixture or contract. |
| Failure output contains API keys, password values, raw model JSON, or non-fixture writing content | Treat as a privacy regression. |

### 5. Good/Base/Bad Cases

- Good: `pnpm test:e2e:headless` runs under Xvfb in Linux CI and completes the same deterministic phases as `pnpm test:e2e`.
- Good: `pnpm test:e2e` starts from empty temp app data, dismisses onboarding through the UI, configures provider state through the UI, enters fixed writing, reviews with mock output, opens feedback, saves review, returns to Practice, submits D+1 rewrite practice, and observes deterministic rewrite-check completion.
- Base: The live-provider command remains available and cleanly skips without credentials; it is not part of the deterministic UI e2e's pass/fail.
- Bad: The default e2e depends on a real API key or model behavior.
- Bad: A `mock` provider is added to the public Settings provider list.
- Bad: The e2e calls `window.api.review.start` directly for the core user flow instead of interacting with the UI.

### 6. Tests Required

- Unit test: e2e mock provider guard returns fixture output only with the explicit e2e flag and non-production runtime.
- Unit test: production/packaged-like runtime does not enable mock output even when the e2e flag is present.
- Unit test: deterministic review fixture validates against the review contract for the fixed sample writing.
- Unit test: deterministic rewrite-check fixture validates against the rewrite-check schema.
- E2E helper test: DOM driver escaping, redaction, phase summary, failure artifact path, and live no-env skip behavior.
- E2E command: `pnpm test:e2e` passes through named phases for setup, launch/CDP, renderer readiness, provider setup, review generation, feedback save, rewrite practice, and cleanup.
- Headless E2E command: `pnpm test:e2e:headless` runs the same deterministic flow under Xvfb in Linux headless environments.

### 7. Wrong vs Correct

#### Wrong

```text
pnpm test:e2e:headless drops `xvfb-run` and only adds Chromium flags, then fails on Linux CI because Electron cannot find a display.
```

#### Correct

```text
pnpm test:e2e:headless clears `WAYLAND_DISPLAY`, forces an X11 session hint, then runs `xvfb-run -a pnpm test:e2e`; CI/dev shells install Xvfb, while Electron/Chromium flags remain inside the e2e launchers.
```

## Required Review Harness Cases

The harness must include cases for:

1. Normal short writing.
2. Repeated phrase.
3. Multiline text.
4. Mixed Chinese and English.
5. Curly quotes.
6. Irregular spaces.
7. Agent returns paraphrased `originalText`.
8. `matchedPatternId` does not exist.
9. `newPatternSuggestion` is a near-duplicate.
10. Low-confidence corrections exceed threshold.
11. Missing focus pattern.
12. Multiple focus patterns.
13. `selfRepairTask.hint` leaks full corrected text.
14. `whatWentWell` is empty or generic.
15. Reference rewrite lacks `noticeTheGap`.
16. Input bridge examples do not match focus pattern.

## Harness Exit Criteria

- 20 manual examples achieve anchoring success >= 95%.
- Invalid output never writes long-term statistics.
- Repeated `saveReviewRun` cannot duplicate pattern count.
- Stale reviews display historical snapshots correctly.
- Every valid review derives exactly one focus correction.
- Self-repair, input bridge, and rewrite task correction-index references pass validation.

## Per-Task Quality Checks

For implementation tasks touching review behavior, tests should cover:

- Zod schema acceptance and rejection.
- Quote anchoring and UTF-16 offset generation.
- Review state transitions.
- Atomic save rollback on failure.
- Idempotent save behavior.
- Privacy default for raw output.
- UI behavior for `valid`, `valid_with_warnings`, and `invalid`.

For frontend tasks, manual UI validation must exercise the golden path and stale-review edge case when applicable.
