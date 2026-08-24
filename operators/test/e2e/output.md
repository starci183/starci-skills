# `test/e2e` output

This closed output is ephemeral task-session state and is purged with every intermediate at every parent `skill-terminal` state.

## JSON architecture

| Section | Meaning |
| --- | --- |
| `payload.decision` | Typed route key. |
| `payload.state` | Status, code, retryability, and emitted route. |
| `payload.produced` | Session receipt/artifacts and approved durable-mutation metadata. |
| `payload.context` | Refs and revisions used, never copied context or reasoning. |
| `payload.cleanup` | Scratch inventory and terminal purge. |
| `payload.evidenceRefs` / `findings` | Session evidence and concise unresolved facts. |

## State contract

| Decision | Operator state | Emitted state | Evidence |
| --- | --- | --- | --- |
| `pass` | `completed` | `test.ui / ready` | Adds `e2e-pass, e2e-evidence`. |
| `in-boundary` | `repair` | `code.repair / repair` | Adds `e2e-failed, in-boundary-repair`. |
| `blocked` | `blocked` | `test.review / blocked` | Adds `e2e-blocked`. |

`payload.state.emits` must exactly match the root route and manifest facts. All receipt and evidence refs use `session://`.
