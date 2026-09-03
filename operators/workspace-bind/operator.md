# workspace.bind

## Job

Resolve one project and role into a verified checkout identity, its exact source head, and the closed
runtime binding it may consume, and return that as one typed route receipt.

## Declaration is the only authority

A route exists because a portable declaration in `@workspaces/projects/<project>/<role>` says so and a
hydrated local route projects it onto this machine's disk. Four things routinely resemble a route and
are none of it: a directory whose name matches the project, a sibling checkout that sits next to the
Source, the current working directory, and the origin open in a browser. Those are hints, they carry
no authority at all, and this operator has nowhere to put them: Requirements declares no hint field,
so a request that carries one fails the gate with `INVALID_INPUT` at step 1 rather than being
weighed. Refusing them at the gate is the point, because a hint that survives into the body of a run
is a hint that gets followed the moment the declared route looks inconvenient. The two route halves
must agree on project, role, Git repository, and branch; a `source` repository kind carries no
directory and resolves to the Source root itself, a `sibling` kind carries a safe relative directory
and resolves beside it, and a hydrated route that names another Source belongs to another machine and
is refused.

## Endpoint binding is a closed projection

An endpoint is never a URL somebody chose. It is the `workspace-route-port-projection`: the verified
frontend and backend routes, the project offset and slot step from `@workspaces/ports/<project>`, the
application slot, and the routed backend's declared port services, folded into one fingerprint. The
binding carries that fingerprint, and a stale one is refused rather than recomputed into agreement.
Only origin-only `http://localhost:<canonical-port>` values are endpoints; a free URL, `127.0.0.1`, a
remote host, an alternate application, an undeclared service, or a port that merely happens to be
listening establishes nothing. Step 5 runs only when `runtimeNeed` is not `none`: a caller that binds
no runtime binds no endpoints either, and a route that carries endpoints nobody asked for has
consumed a shared resource on its own initiative.

## The caller is a consumer, never an owner

The shared local frontend, api, and identity processes belong to exactly one delegated owner task.
This operator binds the caller to that owner's endpoints as a consumer. It does not start, stop,
restart, replace, or kill a process, and it claims no port, no PID, and no runtime lifecycle. A
registry that is missing, stale, or not ready yields a typed stop so the caller can raise one
coordination request; it never authorises a replacement. An address already in use, an unexpected
authenticated session, and a failing probe are all evidence to report, and none of them is permission.

## Nothing is repaired here

No credential is read, copied, or recorded; only the sealed roster reference is bound, and
`IDENTITY_ROSTER_SEALED` states that. A declaration that does not exist is repaired by the workspace
owner, never by this operator, so `ROUTE_UNDECLARED` and `ROUTE_UNHYDRATED` are expected outcomes of
an unprepared workspace rather than defects in the request. `CHECKOUT_DIRTY` never falls back to
anything: this operator does not stash, clean, or reset a working tree to make a binding possible.
The businesses authority root is derived as `<git root>/.worktrees/businesses` when that worktree
exists on a source checkout and is absent otherwise; it is never accepted from the person, because a
typed authority root is how a second business tree is born. Provenance and freshness are not a step
of their own: they are written inside the emit, next to the binding they describe.

## Boundary

Context is read-only apart from the machine-local hydrated route state, which Git ignores. The
operator writes only `response/` of its own branch: `response.md`, `response/data/route.json` and
`response.json`. It never accepts a similar name, a sibling directory, the working directory, or a
browser URL as route authority, never accepts a chosen URL, a loopback alias, or a merely listening
port as an endpoint, never starts, stops, restarts, replaces, or kills a shared runtime process, never
claims a port, a PID, or a runtime lifecycle for a feature task, never creates or switches to a task,
feature, or worktree branch under a forbidden worktree policy, never writes a credential, token,
cookie, or password into the receipt or any evidence, and never repairs a missing route, initializes a
workspace, or provisions an account. It makes no product decision and carries no verdict.

## Context

| Alias | Bind | Required |
| --- | --- | --- |
| `@workspaces/projects/<project>/<role>` | the portable route declaration, read by fingerprint; the only route authority | yes |
| `@workspaces/local/routes/<project>/<role>` | the hydrated route this machine projects the declaration onto, and the checkout it resolves to | yes |
| `@workspaces/device-state` | machine identity and the sealed credential roster, bound by name and never read | yes |
| `@workspaces/ports/<project>` | the port projection, read only when the caller consumes the runtime | no |
| `@worktrees/sessions/central-runtime` | the runtime owner registry, its generation and health evidence, bound only when the caller consumes | no |

## Inputs

| Kind | From | Required |
| --- | --- | --- |
| — | this operator opens the chain, so it consumes no earlier branch | no |

## Requirements

| Field | Type | Default | Ask |
| --- | --- | --- | --- |
| `project` | id | — | The project to bind |
| `role` | choice | — | `fe` or `be`: the role of that project to bind |
| `gitPolicy` | list of `{worktreeBranches, mutationBranch}` | the policy the route declaration carries | The branch law this binding is verified against; `forbidden` keeps every write on the mutation branch |
| `declaredWriteRoots` | list | empty | The only paths later work may write; anything dirty outside them is `CHECKOUT_DIRTY` |
| `runtimeNeed` | choice | none | `none` binds no runtime and skips step 5; `consume` binds the owner's endpoints as a consumer |
| `resume` | token | null | The blocked branch's token when re-entering after a stop |

## Steps

| # | Step | Params | Reads | Writes | Stops with |
| --- | --- | --- | --- | --- | --- |
| 1 | Validate the gate and resume, and refuse every hint it carries | `resume` | `request/request.json`, its requirements and its frozen head | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Bind bootstrap and identity | — | @workspaces/device-state, the machine identity and the sealed credential roster, @tools/secrets | — | `IDENTITY_UNVERIFIED` |
| 3 | Resolve the route | `project`, `role` | @workspaces/projects/<project>/<role> for exactly this project and role, @workspaces/local/routes/<project>/<role>, @tools/git | — | `ROUTE_UNDECLARED`, `ROUTE_UNHYDRATED`, `ROUTE_MISMATCH` |
| 4 | Verify the checkout: branch policy, a clean tree, and the write roots | `gitPolicy`, `declaredWriteRoots` | @workspaces/local/routes/<project>/<role>, the resolved checkout, its branch, its head and its working tree, @tools/git, @tools/shell | — | `BRANCH_POLICY_VIOLATION`, `CHECKOUT_DIRTY` |
| 5 | Bind the runtime the caller consumes, only when `runtimeNeed` is not none | `runtimeNeed` | @worktrees/sessions/central-runtime, the owner registry, its generation and health evidence, @workspaces/ports/<project>, @tools/http | — | `ENDPOINT_AUTHORITY_STALE`, `RUNTIME_NOT_READY` |
| 6 | Bind provenance and freshness, then emit | — | everything above, @workspaces/device-state | `response/response.md`, `response/data/route.json`, `response/response.json` | — |

Step 5 recomputes nothing: the endpoint fingerprint either matches the closed projection or the
branch stops. Under `worktreeBranches` set to forbidden, a route binds only on the mutation branch and
records `WORKTREE_BRANCH_FORBIDDEN`; under `session-only` it binds on the mutation branch or on a
`session/<sessionId>` worktree branch, the only shape a source-writing operator may commit to; a redacted conversation head records `PROVENANCE_HEAD_BOUND`, and
a cached receipt matching the same identity tuple and fingerprints records `CACHED_ROUTE_REUSED`. A
resume begins again at step 1, reuses only unchanged fingerprinted observations, and consumes the
exact delta; a republished route arrives as a new route fingerprint, because the same fingerprint
cannot yield a different binding.

## Outputs

| Kind | File | Type | Required |
| --- | --- | --- | --- |
| `workspace-route-binding` | `response/response.md` | md | yes |
| `route` | `response/data/route.json` | data | yes |

## Stops

| Code | Disposition |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `SOURCE_DRIFT` | terminate |
| `NO_PROGRESS` | terminate |
| `IDENTITY_UNVERIFIED` | terminate |
| `ROUTE_UNDECLARED` | terminate |
| `ROUTE_UNHYDRATED` | terminate |
| `ROUTE_MISMATCH` | terminate |
| `BRANCH_POLICY_VIOLATION` | terminate |
| `CHECKOUT_DIRTY` | terminate |
| `ENDPOINT_AUTHORITY_STALE` | terminate |
| `RUNTIME_NOT_READY` | terminate |

## Next

| When | Operator |
| --- | --- |
| the route is bound and the checkout carries a publication to push | `git.publish` |
| the route is bound and a promise must be decided against its source | `business.decide` |
| the route is bound and a backend contract must be filled inside it | `backend.source.apply` |
| the route is bound and a frontend surface must be written inside it | `frontend.source.apply` |
| the runtime owner is missing or not ready and one coordination request must be raised | `platform.operate` |
| the route is bound and a frontend surface must be decided inside it | `frontend.direction.decide` |
| the route is bound and a published head must be verified before it ships | `quality.verify` |
