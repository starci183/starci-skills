# `platform/mcp-config` output

The output is a closed ephemeral task-session object consumed by the parent skill. Input, output, loaded context, scratch, observations, and receipts are purged at every `skill-terminal` state.

## JSON architecture

| Section | Purpose |
| --- | --- |
| Root envelope | Emit `platform.mcp.index / ready` with `platform-mcp-config-ready`. |
| `payload.decision` | The only legal decision is `ready`. |
| `payload.state` | Explicit completion status, code, retryability, and emitted route. |
| `payload.produced` | Task-session receipt/artifacts and metadata for the approved generated-config mutation. |
| `payload.context` | Exact references and revisions used, never copied context or reasoning. |
| `payload.cleanup` | Scratch inventory and mandatory terminal purge policy. |
| `payload.evidenceRefs` / `findings` | Task-session evidence and concise unresolved facts. |

## State contract

| Decision | Operator state | Emitted state | Meaning |
| --- | --- | --- | --- |
| `ready` | `completed` | `platform.mcp.index / ready` | The generated config represents every approved service, route, and partition and its validation passes. |

`payload.state.emits` must exactly match the root route and manifest facts. Receipts and evidence use `session://`; only the approved generated config may survive.
