# Platform source index

| Field | Value |
| --- | --- |
| Knowledge ID | `platform.source-index` |
| Operators | `source-index` |
| Search tags | `qdrant, source, business, coding-context, generation, hash, cache` |
| Dependencies | `workspace.routing` |

## Record

Index only canonical project-scoped business and generated frontend coding-context artifacts. Authority lives below `.worktrees/<project>/businesses/` and `.worktrees/<project>/coding-context/frontend/`; Qdrant is a rebuildable search index. Compare metadata before body load. Frontend identity includes source revision/fingerprint, content hash, schema version, generator version, generator executable hash, and generator-config hash. An exact match reuses the active generation without body load, chunking, embedding, or write.

For a changed set, load only changed documents, derive stable point IDs, stage one complete collection generation, validate count and payload hashes, then atomically switch the declared alias. Never expose a mixed generation or mutate another project partition. Keep bodies, chunks, embeddings, and observations task-session-only.

Primary reference: [Qdrant atomic collection aliases](https://qdrant.tech/documentation/manage-data/collections/#collection-aliases).
