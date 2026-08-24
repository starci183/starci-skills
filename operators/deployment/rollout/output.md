# `deployment/rollout` output

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
| `ready` | `completed` | `deployment.monitor / ready` | Adds `deployment-rollout-ready`. |

`payload.state.emits` must match the root route and manifest facts. Receipts and evidence use `session://`; only approved deployment mutations may survive.
