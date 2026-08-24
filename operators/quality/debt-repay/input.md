# `quality/debt-repay` input

This operator repays one approved debt scope. Its input is an ephemeral task-session object. The runtime never writes the envelope, loaded values, command output, diagnostics, worker observations, or receipts outside the session and purges them at every parent-skill terminal.

## JSON architecture

| Section | Authored by | Purpose |
| --- | --- | --- |
| Root route fields | Skill state machine | Bind one accepted quality transition. |
| `payload.provided` | Previous state | Supply immutable task-session references. |
| `payload.loads` | Runtime resolver | Declare exact artifacts, law, execution/source boundary, and orchestration loaded after validation. |
| `payload.session` | Session runtime | Name ephemeral input, output, and scratch slots. |

## Provided by the previous state

- `approvedDebtRef`: exact `session://` reference; the operator cannot replace or broaden it.
- `approvalReceiptRef`: exact unexpired owner approval over the debt identity, permitted writes, closure criterion, and approval revision.
- `debtInventoryRef`: exact current open/closed debt inventory projection; closure finalization must update this authority atomically.
- `baselineRef`: exact `session://` reference; the operator cannot replace or broaden it.
- `scopeRef`: exact `session://` reference; the operator cannot replace or broaden it.
- `loopControlRef`: exact `session://` iteration budget, prior fingerprint, prior metric, and stop-policy reference owned by the parent machine.
- `closureProofRef`: `null` while repaying; an exact independent green proof when `intent` is `close`.

## Intent and loop control

- `intent: repay` requires `closureProofRef: null`, at least one exact source target, and `iteration < maxIterations`.
- `intent: close` requires a non-null independent closure proof and zero source targets. It may only finalize the debt record and closed inventory; it cannot repair source.
- `previousIterationFingerprint` is `null` only on the first repayment iteration. A repeated fingerprint, unchanged metric, unchanged remainder, or exhausted budget is blocked rather than emitted as progress.

## Loaded by the runtime

- `artifacts`: resolve only references listed by `payload.provided` into session memory.
- `knowledge`: retrieve only `quality.readiness-repair` from the pinned Qdrant generation.
- `source`: open only declared target files and verify their hashes; broad repository context is forbidden.
- `orchestration`: resolve execution strategy separately from provider/model mapping.

Acceptance requires exact current approval, a closed debt inventory authority, strict measured progress, and independent proof before closure. Validate the complete envelope before any load, command, or mutation.
