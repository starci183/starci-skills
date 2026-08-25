# `platform/reference-reindex` output

The output records the versioned policy and whether each local reference partition used `noop`, `incremental`, or `full`. Catalog bodies, Qdrant points, file inventories, Python environment, Caddy config, and proof responses remain task-session or machine-local state.

## JSON architecture

| Section | Purpose |
| --- | --- |
| Root route | Emit `platform.mcp.publish / ready|blocked`. |
| `payload.decision` | Select the typed route. |
| `payload.state` | Report operator status, code, retryability, and emitted facts. |
| `payload.produced` | Record resolved adaptive budgets, runtime proof, per-reference metrics/action/generation, and local durable writes. |
| `payload.context` | Preserve only revision/hash lineage. |
| `payload.cleanup` | Purge all ephemeral objects at `skill-terminal`. |
| `payload.evidenceRefs` / `findings` | Point to value-safe proof or bounded blockers. |

`noop` requires zero eligible drift. `incremental` requires compatible history/contract and every measured budget below its resolved policy ceiling. `full` records the exact forcing reason, including missing/corrupt generation, contract drift, incomparable history, manual override, or crossed adaptive budget. Ready also proves the loopback Caddy MCP endpoint and full-text/path query. Local data/config writes never imply a Git mutation.
