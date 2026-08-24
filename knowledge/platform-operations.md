# Platform operations

| Field | Value |
| --- | --- |
| Knowledge ID | `platform.operations` |
| Operators | `tunnel-plan, tunnel-apply, mcp-config, source-index, mcp-publish, sonar-service-reconcile, observability-reconcile` |
| Search tags | `cloudflare, tunnel, mcp, qdrant, sonar, observability, provider` |
| Dependencies | `workspace.routing` |

## Record

Platform operators reconcile shared provider control planes without absorbing product ownership. Provider mutations are planned value-free, credentials stay in existing custody, and each apply is idempotent and bounded: one HTTP tunnel/DNS route, one read-only source index partition, one MCP publication, one Sonar service/project boundary, or one declared observability stack. Provider success requires a separate public/runtime proof.
