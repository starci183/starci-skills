# Analyze starci-source-index-publish input

Global `@selection` has already selected this one-flow skill from prompt intent. Before any operator or Qdrant retrieval, validate the invocation and verify `selection.skillId` equals `starci-source-index-publish`. Then perform these local checks:

1. Resolve project and declared context inputs.
2. Distinguish local indexing from public MCP mutation.
3. Evaluate tunnel work only for public publication.

Reject stale or missing authority/evidence, an ambiguous target, a write root outside scope, external mutation without approval, or an option outside the closed schema. Do not reconsider other skills here; return to global analysis if selection is wrong.

The fixed first state is `mcp-config`. Emit only normalized scope and facts as task-session data; do not choose a second mode or copy operator knowledge into context.

## Options

| Option | Values | Decision effect |
| --- | --- | --- |
| `publishPublic` | `boolean` | Publish MCP through the declared public boundary. |
| `ensureTunnel` | `boolean` | Reconcile a tunnel before MCP publication. |
