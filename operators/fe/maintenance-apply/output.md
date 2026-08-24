# `fe/maintenance-apply` output

The output is a closed, ephemeral task-session object consumed by the parent skill state machine. It is never a durable artifact. Only explicitly approved product-source or external mutations survive; the output and every intermediate reference are purged at every skill terminal.

## JSON architecture

| Section | Purpose |
| --- | --- |
| `stage`, `status`, `facts` | Compatibility envelope for the existing skill route. |
| `payload.decision` | Typed decision key selected from this operator's declared outcomes. |
| `payload.state` | Explicit operator status, code, retryability, and exact emitted route. |
| `payload.produced` | Session artifact references plus descriptors of approved durable mutations or external effects. |
| `payload.context` | Minimal references and revisions actually used; never copied context or reasoning. |
| `payload.cleanup` | Scratch references and mandatory `skill-terminal` purge policy. |
| `payload.evidenceRefs` | Session-only evidence for the next state. |
| `payload.findings` | Concise unresolved facts; never a chain-of-thought transcript. |

## State contract

| Decision | Operator state | Emitted state | Required facts |
| --- | --- | --- | --- |
| `applied` | `completed` | `fe.maintenance.maintenance-apply.result / complete` | `fe-maintenance-apply-complete` |
| `blocked` | `blocked` | `fe.maintenance.blocked / blocked` | `fe-maintenance-apply-blocked` |

The parent state machine, not the operator or an orchestration worker, routes `payload.state.emits`. Only a successful source decision may report exact approved mutations.
