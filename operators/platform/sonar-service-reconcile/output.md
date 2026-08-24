# `platform/sonar-service-reconcile` output

The output is ephemeral task-session state and is purged with provider observations, receipts, and scratch values at every `skill-terminal`.

## JSON architecture

| Section | Purpose |
| --- | --- |
| Root route fields | Emit proved or blocked platform state. |
| `payload.decision` | `proved` or `blocked`. |
| `payload.state` | Explicit status, code, retryability, and emitted route. |
| `payload.produced` | Session `sonarServiceReceiptRef` plus approved Sonar mutations. |
| `payload.context` | Used refs and provider revisions only. |
| `payload.cleanup` | Scratch refs and mandatory terminal purge. |
| `payload.evidenceRefs` | Session-only verification evidence. |
| `payload.findings` | Value-safe unresolved facts without raw responses or reasoning. |

| Decision | State | Emitted route | Durable effect |
| --- | --- | --- | --- |
| `proved` | `completed` | `platform.sonar.proved / complete` | Declared changes, or an empty mutation list when already converged |
| `blocked` | `blocked` | `platform.blocked / blocked` | Any partial coordinator mutation is reported with before/after revisions |

A proved result requires a fresh receipt, not a mutation. Re-running an already-converged plan is a successful idempotent no-op.
