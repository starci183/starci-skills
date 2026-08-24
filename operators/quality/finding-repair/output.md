# `quality/finding-repair` output

The output is an ephemeral task-session object consumed by the parent state machine. It is purged with input, bindings, command output, diagnostics, observations, receipts, and scratch values at every `skill-terminal`.

## JSON architecture

| Section | Purpose |
| --- | --- |
| Root route fields | Compatibility state emitted to the skill machine. |
| `payload.decision` | Typed quality route key. |
| `payload.state` | Explicit status, code, retryability, and emitted state. |
| `payload.produced` | Session `repairReceiptRef`, one typed `decisionProof`, and approved durable source effects only. |
| `payload.context` | Minimal refs and revisions actually used; no copied context or reasoning. |
| `payload.cleanup` | Scratch refs and mandatory terminal purge. |
| `payload.evidenceRefs` | Session-only proof handed to the next state. |
| `payload.findings` | Structured failure facts, never hidden reasoning. |

## State contract

| Decision | State status | Emitted state | Facts added |
| --- | --- | --- | --- |
| `repaired` | `completed` | `quality.repair.result / complete` | finding-repaired |
| `boundary-drift` | `blocked` | `quality.blocked / blocked` | repair-boundary-drift |
| `stale-finding` | `replan` | `quality.inventory / ready` | finding-stale |
| `external-blocker` | `blocked` | `quality.blocked / blocked` | repair-external-blocker |

`repairReceiptRef`, command captures, evidence, diagnostics, and output use `session://`. Only the explicit repair/debt product effect declared by `operator.json` may survive the skill.

`decisionProof.kind` is correlated exactly: `repaired → mutation-applied`, `stale-finding → finding-revision-mismatch`, `boundary-drift → boundary-expansion-required`, and `external-blocker → external-verdict-unavailable`. Only `repaired` may report changed targets or durable writes, and it must set `reinventoryRequired: true`; the operator never self-certifies that the finding disappeared.
