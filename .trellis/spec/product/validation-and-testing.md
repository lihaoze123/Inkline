# Validation and Testing Contract

## Review Contract Harness

Before full UI work is considered reliable, build a harness that exercises review validation without depending on live model output.

Inputs:

```text
sample journal
mock agent output
existing patterns
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
- The harness is the shared contract between mock agent output, future live pi-mono integration, and Review Result UI persistence.
- Do not create a second validation path in UI or main-process code; import the shared contract functions instead.

### 2. Signatures

```ts
normalizeJournalContent(content: string): string;
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

- `ReviewInput.contentHash` must equal `sha256(normalizeJournalContent(journalContent))`.
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
| `contentHash` mismatches normalized journal content | `content_hash_mismatch`, `validationStatus: invalid`, empty operations |
| Anchor exact text cannot be located | Correction becomes `low_confidence`; too many low-confidence anchors make the result `invalid` |
| `originalText` differs from anchored exact text | Warning; anchor exact text remains authoritative |
| `matchedPatternId` is absent from `existingPatterns` | `matched_pattern_missing`, `validationStatus: invalid`, empty operations |
| Focus/self-repair/input bridge/rewrite indexes point outside corrections | `validationStatus: invalid`, empty operations |
| `selfRepairTask.hint` contains the full corrected text | `self_repair_hint_leaks_answer`, `validationStatus: invalid`, empty operations |
| v0.1 `upgradeOpportunities` exceeds cap `0` or is mixed into corrections | `validationStatus: invalid`, empty operations |

### 5. Good/Base/Bad Cases

- Good: Short journal, one focus correction, one concrete `whatWentWell`, valid anchor, existing matched pattern, reference rewrite with `noticeTheGap`, one `rewrite_original` task.
- Base: Anchoring succeeds after LF normalization or curly-quote fallback; result may be `valid_with_warnings` but preview operations remain non-persistent.
- Bad: Paraphrased `exact`, missing focus pattern, multiple focus patterns, generic/empty `whatWentWell`, missing pattern ID, leaked self-repair answer, or rewrite task indexes that do not exist.

### 6. Tests Required

- Schema acceptance/rejection asserts `schemaValid`, `validationStatus`, issue codes, and empty operations on invalid output.
- Quote anchoring asserts repeated phrase disambiguation, multiline LF normalization, mixed Chinese/English UTF-16 offsets, curly quote fallback, irregular spaces not collapsed, and paraphrased exact downgrade.
- Operation generation asserts corrections, pattern reuse/new pattern suggestions, self-repair, reference rewrites, input bridge, and rewrite practice are preview-only.
- Idempotency simulation asserts repeated `saveReviewRun(reviewRunId, operations)` does not duplicate pattern count increments, rewrite tasks, reference rewrites, or self-repair attempts.
- CLI test or manual run asserts `pnpm run review:harness` prints all required output fields.

### 7. Wrong vs Correct

Wrong: validate schema in one place, locate anchors in another, then let UI generate persistence operations from raw model JSON.

Correct: `validateReviewResult` is the only boundary from raw agent JSON to preview operations, and save code consumes those validated operations.

## Required Test Cases

The harness must include cases for:

1. Normal short journal.
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
