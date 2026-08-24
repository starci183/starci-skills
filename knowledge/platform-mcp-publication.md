# Platform MCP publication

| Field | Value |
| --- | --- |
| Knowledge ID | `platform.mcp-publication` |
| Operators | `mcp-config, mcp-publish` |
| Search tags | `mcp, qdrant, partition, public, https, read-only` |
| Dependencies | `workspace.routing, platform.source-index` |

## Record

Compile and publish only the declared MCP topology and source-index partitions. Generated config is value-free, ignored, rebuildable, and contains no credential values. Publication requires exact config/index receipts, optional tunnel proof only when the config declares that boundary, and approval for the exact runtime/provider plan. The coordinator alone mutates; already-converged services produce a fresh proof receipt with no mutation.

Proof is authenticated, read-only, partition-isolated, and bounded to declared HTTPS routes. Reject writable capabilities, cross-role results, stale index generations, adjacent route/collection discovery, and any mismatch between public routing and frozen config.
