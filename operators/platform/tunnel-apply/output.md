# `platform/tunnel-apply` output

This closed output is ephemeral task-session state consumed by the parent machine. It is purged with all inputs, loads, observations, receipts, and evidence at every `skill-terminal`.

## JSON architecture

| Section | Purpose |
| --- | --- |
| `payload.decision` | Select `proved` or `blocked`. |
| `payload.state` | Carry explicit status, code, retryability, and exact manifest emission. |
| `payload.produced` | Return `tunnelReceiptRef`, session artifacts, and coordinator-owned mutations. |
| `payload.context` | Record only exact refs and revisions used. |
| `payload.cleanup` | Register all scratch refs for terminal purge. |
| `payload.evidenceRefs` / `payload.findings` | Reference proof and concise unresolved facts. |

## State contract

| Decision | Operator status | Emitted route | Facts added |
| --- | --- | --- | --- |
| `proved` | `completed` | `platform.tunnel.proved / complete` | `platform-tunnel-proved` |
| `blocked` | `blocked` | `platform.blocked / blocked` | `platform-tunnel-blocked` |

A proved output requires a receipt and at least one coordinator-applied Cloudflare mutation. Blocked output may report partial mutation revisions. Workers never mutate or receive credential handles; all intermediates are purged at terminal cleanup.
