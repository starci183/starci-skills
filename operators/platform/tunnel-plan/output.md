# `platform/tunnel-plan` output

This read-only output is consumed from task-session memory and purged with every input, load, observation, plan, and evidence object at `skill-terminal`.

## JSON architecture

| Section | Purpose |
| --- | --- |
| `payload.decision` | The sole decision is `ready`. |
| `payload.state` | Explicit completion code and exact manifest emission. |
| `payload.produced` | Session-only `tunnelPlanRef`, artifacts, and an always-empty mutation list. |
| `payload.context` | Exact refs and revisions actually used. |
| `payload.cleanup` | Complete scratch inventory and terminal purge. |
| `payload.evidenceRefs` / `payload.findings` | Session proof and concise unresolved facts. |

## State contract

| Decision | Operator status | Emitted route | Facts added |
| --- | --- | --- | --- |
| `ready` | `completed` | `platform.tunnel.apply / ready` | `platform-tunnel-plan-ready` |

The plan and all evidence use the current task's `session://` prefix. `payload.produced.mutations` is empty because this operator cannot change source, Cloudflare, DNS, tunnels, runtime, or records.
