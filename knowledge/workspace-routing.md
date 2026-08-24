# Workspace routing

| Field | Value |
| --- | --- |
| Knowledge ID | `workspace.routing` |
| Operators | `route-verify` |
| Search tags | `workspace, route, source, revision, write root, qdrant partition` |
| Dependencies | `none` |

## Record

Resolve project and role to one verified checkout before reading an approved target file. Prove disk path, Git root, branch, origin, committed head, instructions, and allowed write roots. Qdrant stores operator knowledge only; implementation opens exact approved checkout files after their paths and hashes are frozen.

Routing produces immutable receipts and no product decision. A missing, stale, foreign, ambiguous, dirty-for-proof, cross-role, or root-escaping route stops the chain. Initialization and route repair are separate operators, never silent behavior inside a consumer.
