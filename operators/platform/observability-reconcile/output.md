# `platform/observability-reconcile` output

This output is ephemeral task-session state. It is consumed by the parent machine and purged with every input, load, observation, receipt, and evidence object at each `skill-terminal`.

## JSON architecture

| Section | Purpose |
| --- | --- |
| `payload.decision` | Select `proved` or `blocked`. |
| `payload.state` | Carry explicit status, code, retryability, and exact manifest emission. |
| `payload.produced` | Return `observabilityReceiptRef`, session artifacts, and coordinator-owned mutations. |
| `payload.context` | Record refs and revisions actually used, never copied context. |
| `payload.cleanup` | Register every scratch ref for terminal purge. |
| `payload.evidenceRefs` / `payload.findings` | Point to proof and concise unresolved facts. |

## State contract

| Decision | Operator status | Emitted route | Facts added |
| --- | --- | --- | --- |
| `proved` | `completed` | `platform.observability.proved / complete` | `platform-observability-proved` |
| `blocked` | `blocked` | `platform.blocked / blocked` | `platform-observability-blocked` |

A proved result requires a session receipt and at least one coordinator-applied mutation. Blocked results may report partial mutations, but workers never own mutations. All intermediates remain session-only until mandatory terminal cleanup.
