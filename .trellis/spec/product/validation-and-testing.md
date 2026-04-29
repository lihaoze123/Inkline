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
