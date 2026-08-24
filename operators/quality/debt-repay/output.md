# `quality/debt-repay` output

The output is an ephemeral task-session object consumed by the parent state machine. It is purged with input, bindings, command output, diagnostics, observations, receipts, and scratch values at every `skill-terminal`.

## JSON architecture

| Section | Purpose |
| --- | --- |
| Root route fields | Compatibility state emitted to the skill machine. |
| `payload.decision` | Typed quality route key. |
| `payload.state` | Explicit status, code, retryability, and emitted state. |
| `payload.produced` | Session artifact `debtReceiptRef` and approved durable source/authority effects only. |
| `payload.context` | Minimal refs and revisions actually used; no copied context or reasoning. |
| `payload.cleanup` | Scratch refs and mandatory terminal purge. |
| `payload.evidenceRefs` | Session-only proof handed to the next state. |
| `payload.findings` | Structured failure facts, never hidden reasoning. |

## State contract

| Decision | State status | Emitted state | Facts added |
| --- | --- | --- | --- |
| `closed` | `completed` | `quality.debt.result / complete` | debt-closed |
| `progress` | `completed` | `quality.debt.result / ready` | debt-progress |
| `blocked` | `blocked` | `quality.blocked / blocked` | debt-blocked |

`debtReceiptRef`, command captures, evidence, diagnostics, and output use `session://`. Only the explicit repair/debt product effect declared by `operator.json` may survive the skill.
