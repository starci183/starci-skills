# `deployment/proof` output

This closed output is ephemeral task-session state. Input, output, loaded context, scratch, observations, and receipts are purged at `skill-terminal` on every parent-skill terminal state.

## JSON architecture

| Section | Meaning |
| --- | --- |
| `payload.decision` | Typed route key. |
| `payload.state` | Explicit status, code, retryability, and emitted route. |
| `payload.produced` | Session receipt/artifacts and approved durable-mutation metadata. |
| `payload.context` | Exact refs and revisions used, never copied context or reasoning. |
| `payload.cleanup` | Scratch inventory and mandatory terminal purge. |
| `payload.evidenceRefs` / `findings` | Task-session evidence and concise unresolved facts. |

## State contract

| Decision | Operator state | Emitted state | Evidence |
| --- | --- | --- | --- |
| `complete` | `completed` | `delivery.proved / ready` | Adds `delivery-proof-ready`. |
| `rolled-back` | `completed` | `deployment.rolled-back / complete` | Adds `deployment-rollback-proved`; removes `deployment-rollback-required`. |
| `external-error` | `blocked` | `deployment.blocked / blocked` | Adds `deployment-proof-external-error`; retryable after re-observation. |
| `blocked` | `blocked` | `deployment.blocked / blocked` | Adds `deployment-proof-blocked`. |

`payload.state.emits` must match the root route and manifest facts. Receipts and evidence use `session://`; only approved deployment mutations may survive.

`rolled-back` is a terminal rollback truth. It must never route through delivery success or business reconciliation for the rejected release.
