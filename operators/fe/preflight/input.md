# `fe/preflight` input

Preflight freezes routing and scope. It does not analyze the product or load design context.

## JSON architecture

| Section | Ownership | Purpose |
| --- | --- | --- |
| Route envelope | Skill machine | Require `business.freshness / ready`. |
| `payload.provided` | Previous states | Bind project, request, route, fresh-business receipt, targets, and write roots. |
| `payload.loads.receipts` | Runtime resolver | Resolve exactly three receipt headers in metadata-only mode. |
| `payload.loads.orchestration` | Runtime resolver | Bind execution policy; coordinator-only remains mandatory. |
| `payload.session` | Session runtime | Hold ephemeral input, frozen scope, receipt, and output. |

Forbidden input includes business bodies, Qdrant knowledge, Principles, Grammar, FE contract JSON, and raw source.
