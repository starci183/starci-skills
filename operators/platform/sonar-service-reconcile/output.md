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
| `proved` | `completed` | `platform.sonar.proved / complete` | Declared Sonar service/project enforcement changes |
| `blocked` | `blocked` | `platform.blocked / blocked` | None |
