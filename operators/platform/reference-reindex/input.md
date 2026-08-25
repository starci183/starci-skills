# `platform/reference-reindex` input

The operator receives portable route receipts, exact local reference-checkout identities, metadata for their active Qdrant Edge partitions, one versioned adaptive drift policy, and local MCP/Caddy runtime metadata. It does not receive Git credentials, embedding services, or raw Qdrant search results.

## JSON architecture

| Section | Authored by | Purpose |
| --- | --- | --- |
| Root route | Skill state machine | Bind `platform.mcp.index / ready`. |
| `payload.provided` | Previous state | Supply validated MCP config, portable-route, and drift-policy receipts. |
| `payload.loads` | Runtime resolver | Load route artifacts, eligible blob inventories, current partition identities, resolved adaptive budgets, local runtime handles, and orchestration. |
| `payload.session` | Session runtime | Own ephemeral inventories, candidate catalogs, receipts, and cleanup. |

Each reference path is `.worktrees/references/<project>-<role>` and is frozen clean at its resolved portable-route commit. Inventories include eligible tracked blob identity, bytes, and record count; bodies are loaded only for a chosen incremental or full action. There is no fixed change percentage. Compatibility, file/byte/record/delete drift and estimated incremental/full cost select `noop`, `incremental`, or `full`. The baseline query mode is full-text plus path; embeddings remain optional.
