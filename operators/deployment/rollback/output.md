# `deployment/rollback` output

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
| `rolled-back` | `completed` | `deployment.proof / ready` | Adds `deployment-rolled-back`. |
| `partial` | `blocked` | `deployment.blocked / blocked` | Adds `deployment-rollback-partial`; requires exact mutation revisions. |
| `external-error` | `blocked` | `deployment.blocked / blocked` | Adds `deployment-rollback-external-error`; retryable only after external state is re-observed. |
| `blocked` | `blocked` | `deployment.blocked / blocked` | Adds `deployment-rollback-blocked`. |

`payload.state.emits` must match the root route and manifest facts. Receipts and evidence use `session://`; only approved deployment mutations may survive.

`rolled-back` may contain an empty mutation list when the safe release was already active. Any failed outcome with mutations must be `partial`; external-error and generic blocked outputs are mutation-free.
