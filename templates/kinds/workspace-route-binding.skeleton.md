# workspace-route-binding — project/role

One paragraph: which project and role were bound, to which checkout, at which head, and whether the
shared runtime was consumed. Written by `workspace.bind` as `response/response.md`; it authorises
later work to open exactly this checkout at exactly this head and proves nothing about the product.

## Binding

| Field | Value |
| --- | --- |
| Project | `project` |
| Role | `role` |
| Portable route | `.workspaces/projects/project/role.json` |
| Hydrated route | `.workspaces/local/routes/project/role/config.json` |
| Source head | `0000000000000000000000000000000000000000` |

## Checkout

| Field | Value |
| --- | --- |
| Disk path | the resolved checkout on this machine |
| Git root | the same checkout, as Git sees it |
| Git repository | the declared origin |
| Branch | the observed branch |
| Repository kind | source |
| Directory | — for a source route, the relative directory for a sibling one |
| Source head | `0000000000000000000000000000000000000000` |
| Mutation readiness | read-only |
| Businesses root | — when the checkout carries no business worktree |

## Policy

| Field | Value |
| --- | --- |
| Worktree branches | forbidden |
| Mutation branch | the branch the routed policy allows to be written |

## Write roots

| Path | Why |
| --- | --- |
| `src` | the only paths later work may write |

## Runtime

| Field | Value |
| --- | --- |
| Owner task | the delegated owner of the shared runtime; no rows at all when no runtime was consumed |
| Status | ready |
| Consumer role | consumer |
| Frontend | `http://localhost:<canonical-port>` |
| Api | `http://localhost:<canonical-port>` |
| Identity | `http://localhost:<canonical-port>` |

## Findings

| Code | Subject | Statement |
| --- | --- | --- |
| `ROUTE_HYDRATED_FROM_PORTABLE` | `.workspaces/local/routes/project/role/config.json` | the portable declaration resolved to this local route |
| `IDENTITY_ROSTER_SEALED` | the credential roster reference | the roster was bound by name and never read |
