# `deployment/intent-bind` output

The output is ephemeral task-session state and is purged with all intermediates at every `skill-terminal`.

## JSON architecture

| Section | Purpose |
| --- | --- |
| Root route fields | Compatibility state for the skill machine. |
| `payload.decision` | Typed deployment route key. |
| `payload.state` | Explicit status, code, retryability, and emitted state. |
| `payload.produced` | Session `deploymentContractRef` and approved durable effects only. |
| `payload.context` | Used refs and revisions; no copied context, secrets, or reasoning. |
| `payload.cleanup` | Scratch refs and mandatory purge. |
| `payload.evidenceRefs` | Session-only evidence. |
| `payload.findings` | Value-safe unresolved facts. |

## State contract

| Decision | State status | Emitted state | Facts added |
| --- | --- | --- | --- |
| `ready` | `completed` | `deployment.manifest / ready` | deployment-target-bound |

Receipts, captures, observations, and output use `session://`. Durable effects are allowed only for no decisions.
