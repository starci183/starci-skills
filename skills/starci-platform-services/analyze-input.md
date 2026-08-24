# Analyze starci-platform-services input

Input analysis runs before any operator or Qdrant retrieval. Validate the closed invocation, then perform these checks:

1. Classify tunnel, MCP/source index, Sonar or observability reconciliation.
2. Resolve account/tenant/project identity and distinguish read-only indexing from public mutation.
3. Evaluate publishPublic and ensureTunnel only on the MCP branch; unused branches load no service context.

Also reject an unknown mode, stale or missing authority/evidence identity, ambiguous target, write root outside scope, external mutation without an approval boundary, or option outside the closed schema.

## Modes

| Mode | Meaning | First state |
| --- | --- | --- |
| `tunnel` | one HTTP tunnel/DNS route | `tunnel-plan` |
| `mcp` | business and generated-contract index | `mcp-config` |
| `sonar` | shared Sonar enforcement | `sonar` |
| `observability` | metrics collection/remote write | `observability` |

## Options

| Option | Values | Decision effect |
| --- | --- | --- |
| `publishPublic` | `boolean` | Publish MCP through the declared public boundary. |
| `ensureTunnel` | `boolean` | Reconcile a tunnel before MCP publication. |

Analysis emits only the normalized scope, classification facts and first state. It does not copy operator knowledge into skill context.
