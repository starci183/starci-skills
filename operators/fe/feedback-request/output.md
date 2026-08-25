# `fe/feedback-request` output

The output is an ephemeral routing envelope. A successful output describes one durable request upsert; it never copies the request body or any user artifact into session output.

## JSON architecture

| Section | Purpose |
| --- | --- |
| root state | Emit the declared complete or blocked route. |
| `payload.state` | Bind decision, code, retryability and fact delta. |
| `payload.produced` | Describe the exact `.claude/requests` mutation and content hash. |
| `payload.context` | List only references and revisions actually used. |
| `payload.cleanup` | Purge all intermediates at `skill-terminal`. |
| `payload.evidenceRefs` | Hand downstream states session-owned evidence only. |

`recorded` requires exactly one idempotent request mutation. `blocked` must report no mutation. The request remains a queued upgrade candidate; it does not itself modify `.claude`, Grammar, or product source.
