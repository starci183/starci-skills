# `platform/mcp-publish` output

This closed output is an ephemeral task-session object consumed by the parent state machine. The parent skill purges it together with all inputs, loads, observations, receipts, and evidence at every `skill-terminal`.

## JSON architecture

| Section | Purpose |
| --- | --- |
| `payload.decision` | Select `proved` or `blocked`. |
| `payload.state` | Report status, code, retryability, and the exact manifest emission. |
| `payload.produced` | Return `mcpPublishReceiptRef`, session artifacts, and coordinator-applied mutation revisions. |
| `payload.context` | List only refs and revisions actually used. |
| `payload.cleanup` | Register all scratch refs for mandatory terminal purge. |
| `payload.evidenceRefs` | Point to session-only proof objects. |
| `payload.findings` | Record concise unresolved facts without a reasoning transcript. |

## State contract

| Decision | Operator status | Emitted route | Facts added |
| --- | --- | --- | --- |
| `proved` | `completed` | `platform.mcp.proved / complete` | `platform-mcp-proved` |
| `blocked` | `blocked` | `platform.blocked / blocked` | `platform-mcp-blocked` |

All receipt, artifact, evidence, and cleanup refs use the current task's `session://` prefix. Successful publication reports at least one coordinator-applied mutation. A blocked result may report partial mutations, but every mutation carries exact revisions and coordinator ownership.
