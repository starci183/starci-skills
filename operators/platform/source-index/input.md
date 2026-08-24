# `platform/source-index` input

This operator indexes exact business authority and generated frontend-contract JSON without loading repository source context. Input, resolved metadata, changed document bodies, embeddings, observations, and receipts are ephemeral task-session data and are purged at every parent-skill terminal.

## JSON architecture

| Section | Authored by | Purpose |
| --- | --- | --- |
| Root route fields | Skill state machine | Bind `platform.mcp.index / ready`. |
| `payload.provided` | Previous state | Supply exact MCP config, route-set, and exclusion-policy refs. |
| `payload.loads` | Runtime resolver | Declare previous-state artifacts, platform law, business heads, generated contract snapshots, target partition metadata, and orchestration. |
| `payload.session` | Session runtime | Name ephemeral input, output, and scratch slots. |

## Runtime-loaded data

- `artifacts`: resolve only the three provided refs.
- `knowledge`: retrieve only `platform.source-index` from one pinned knowledge generation.
- `business`: load exact revisions below `.worktrees/<project>/businesses/`.
- `frontendContracts`: metadata-first bindings to plain JSON previously generated from frontend contracts below `.worktrees/<project>/coding-context/frontend/`.
- `index`: load only declared Qdrant partition metadata and current content hashes, never retrieved source context.
- `orchestration`: resolve strategy independently from provider/model selection.

A request may index business, frontend coding context, or both, but at least one exact document is required. Every path must belong to `payload.loads.index.projectId`; cross-project batches are invalid.

A frontend snapshot identity includes source revision, source fingerprint, content hash, JSON-schema version, generator version, generator executable hash, and generator-config hash. Matching identity means reuse: do not load the document body, rechunk, re-embed, or upsert it.
