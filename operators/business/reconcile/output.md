# `business/reconcile` output

The output is an ephemeral task-session object consumed by the parent state machine. It is not a durable artifact and is purged with its input, loaded bindings, observations, and scratch values at every `skill-terminal`.

## JSON architecture

| Section | Purpose |
| --- | --- |
| Root route fields | State-machine compatibility envelope. |
| `payload.decision` | Typed route key from this operator contract. |
| `payload.state` | Explicit status, code, retryability, and emitted state. |
| `payload.produced` | Session artifact `reconciliationReceiptRef` plus explicitly approved durable effects only. |
| `payload.context` | Minimal refs and revisions actually used; never copied context or reasoning. |
| `payload.cleanup` | Scratch refs and mandatory terminal purge. |
| `payload.evidenceRefs` | Session-only evidence for the next state. |
| `payload.findings` | Concise unresolved facts, not an analysis transcript. |

## State contract

| Decision | State status | Emitted state | Facts added |
| --- | --- | --- | --- |
| `implemented` | `completed` | `business.complete / complete` | business-reconciled |
| `discrepancy` | `blocked` | `business.blocked / blocked` | business-discrepancy |

`reconciliationReceiptRef`, evidence, receipts, observations, and output use `session://`. Only a product/worktree effect explicitly declared by `operator.json` may survive the skill.
