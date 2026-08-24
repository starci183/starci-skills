# Backend request routing

| Field | Value |
| --- | --- |
| Knowledge ID | `be.request-routing` |
| Operators | `preflight` |
| Search tags | `backend, request, workspace route, business impact, source partition, receipt` |
| Dependencies | `none` |

## Record

A backend run begins from verified authority, not remembered repository state. Bind the project, backend role, checkout root, branch, source revision, business-impact route, accepted capability head, allowed write roots, and source-context partition before planning.

## Routing law

The source partition is `/be/<project>/` in `starci-context-v1`. A Qdrant hit is discovery evidence only: open the exact authoritative file from the verified checkout before using its contents. Record query, point identity, virtual path, repository revision, file hash, and observation time in a source receipt.

Product-facing work requires a current accepted business capability. Purely technical work must bind an existing implemented authority and must not silently reopen it. Missing/stale routes, mixed repositories, ambiguous impact, unavailable Qdrant, or writes outside the declared roots stop before downstream knowledge is loaded.
