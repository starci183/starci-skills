# Platform source index

| Field | Value |
| --- | --- |
| Knowledge ID | `platform.source-index` |
| Operators | `source-index` |
| Search tags | `default-search, source, business, coding-context, generation, hash, cache` |
| Dependencies | `workspace.routing` |

## Record

Resolve the project's verified backend Source through `.workspaces`, then search only its canonical `.worktrees/businesses/` and `.worktrees/coding-context/frontend/` artifacts. Project identity belongs to the verified route and backend checkout, not an extra `.worktrees/<project>` directory. Use the agent's default file search; v7 owns no Qdrant collection, embedding pipeline, search alias, or derived repository index.

Compare metadata before body load. Frontend identity includes source revision/fingerprint, content hash, schema version, generator version, generator executable hash, and generator-config hash. An exact match reuses the active generation without rewriting it. For a changed set, rebuild and atomically publish one complete canonical JSON generation under `.worktrees/coding-context/frontend/`; never expose a mixed generation or write into the routed FE checkout.

Primary reference: [default search atomic collection aliases](https://default-search.tech/documentation/manage-data/collections/#collection-aliases).
