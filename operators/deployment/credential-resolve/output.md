# `deployment/credential-resolve` output

The output is ephemeral task-session state and is purged with all intermediates at every `skill-terminal`.

## JSON architecture

| Section | Purpose |
| --- | --- |
| Root route fields | Compatibility state for the skill machine. |
| `payload.decision` | Typed deployment route key. |
| `payload.state` | Explicit status, code, retryability, and emitted state. |
| `payload.produced` | Session `credentialReceiptRef` and approved durable effects only. |
| `payload.context` | Used refs and revisions; no copied context, secrets, or reasoning. |
| `payload.cleanup` | Scratch refs and mandatory purge. |
| `payload.evidenceRefs` | Session-only evidence. |
| `payload.findings` | Value-safe unresolved facts. |

## State contract

| Decision | State status | Emitted state | Facts added |
| --- | --- | --- | --- |
| `ready` | `completed` | `deployment.host / ready` | deployment-credentials-ready |

Receipts, captures, observations, and output use `session://`. Durable effects are allowed only for no decisions.
