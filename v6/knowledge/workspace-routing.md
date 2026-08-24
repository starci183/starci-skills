# Workspace routing

| Field | Value |
| --- | --- |
| Knowledge ID | `workspace.routing` |
| Operators | `route-verify` |
| Search tags | `workspace, route, source, revision, write root, qdrant partition` |
| Dependencies | `none` |

## Record

Resolve project and role to one verified checkout before reading target source. Prove disk path, Git root, branch, origin, committed head, instructions, and allowed write roots. Bind source context to `/<role>/<project>/` in `starci-context-v1`; a Qdrant hit must be reopened from that checkout before it becomes evidence.

Routing produces immutable receipts and no product decision. A missing, stale, foreign, ambiguous, dirty-for-proof, cross-role, or root-escaping route stops the chain. Initialization and route repair are separate operators, never silent behavior inside a consumer.
