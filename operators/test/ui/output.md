# `test/ui` output

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
| `pass` | `completed` | `proof.run / ready` | Adds `ui-pass, ui-evidence`. |
| `in-boundary` | `repair` | `code.repair / repair` | Adds `ui-failed, in-boundary-repair`. |
| `boundary-drift` | `replan` | `layout.review / rejected` | Adds `boundary-drift, layout-feedback-recorded`. |
| `blocked` | `blocked` | `test.review / blocked` | Adds `ui-blocked`. |

`payload.state.emits` must exactly match the root route and manifest facts. All receipt and evidence refs use `session://`.
