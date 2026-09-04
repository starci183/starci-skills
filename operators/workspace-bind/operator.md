# workspace.bind

## Job

Resolve one project and role into a verified checkout identity, its exact source head, and the closed
runtime binding it may consume, and return that as one typed route receipt.

## Done when

Done when the `workspace-route-binding` and its `route` name one checkout resolved from the
declaration and its hydrated projection alone, on a branch the routed policy permits with a working
tree carrying nothing the policy refuses, at its observed source head with its derived mutation
readiness, and, when a runtime was to be consumed, the endpoint fingerprint of the closed projection
together with the registry entry of this route whose served head contains that source head.

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

`checkout` selects the declared checkout by default. With `session`, the same declarations are
verified first, then `scripts/workspace-checkout.mjs` selects the unique Git-registered worktree whose
branch is exactly `session/<request.sessionId>` in the canonical checkout's Git common directory.
Only `session-only` policy permits that selection. Neither a path nor another session can be supplied;
the helper creates, switches and repairs nothing. The route's checkout and source head describe the
selected worktree, while `sessionCheckout` preserves the observed canonical path, branch and head,
the common directory and the current session identity. The canonical head is an observation, not the
session's original base; source-writing receipts own that base. A missing, foreign, ambiguous or
unavailable registration is refused. Existing route receipts are never silently rebound.

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

## One registry entry per project route

The runtime registry holds one entry for each `<project>/<role>`, and a binding consumes the entry of
its own route: its endpoints, its head, its generation, its status, the evidence behind that status
and the identity provider an account for it would be created at. One machine serves several products
at once, so a registry read as a single block answers for whichever route happens to be recorded in
it, and every other route binds as not ready while the service it needs is listening. The binding
records the entry key it read, which is what makes that mistake visible instead of merely likely.

## The runtime is bound by ancestry, not by equality

One machine serves one integration branch per product, and that branch carries the work of every
session that asked for it, so the head a binding pinned is almost never the head that is serving. A
binding therefore does not compare the two for equality — that would fail on arithmetic the moment a
second session existed — it establishes that its own head is inside the served one: present among the
commits the entry records as contained, and an ancestor of the served head. Both are recorded, because
a reader who cannot see the pinned head beside the served one cannot check the claim.

A served head that does not contain this route's head is not a runtime this binding may consume.
`RUNTIME_NOT_READY` then names the commit that must be served and the operation that would serve it,
so the coordination request that follows is a specific request rather than a report that something is
wrong; and while another session holds the lease and is merging, the answer is `RUNTIME_BUSY` with the
holder and the queue position, which is a wait rather than a failure. Neither is permission to serve
it here: this operator still starts nothing.

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
of their own: they are written inside the emit, next to the binding they describe. The head a hydrated
route recorded is a record of the hydration and never route authority: the observed head wins, and a
hydration head two commits behind the checkout is not a stop.

A blocked branch emits no receipt and no route: `response.json` is the whole record, and `reason`
carries the observation that justified the stop, including the registry generation, the endpoints
probed and what each answered.

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
| `@worktrees/sessions/central-runtime` | the runtime owner registry: the entry of this route, the head it serves, what that head contains, its lease, generation and health evidence, bound only when the caller consumes | no |

## Inputs

| Kind | From | Required |
| --- | --- | --- |
| — | this operator opens the chain, so it consumes no earlier branch | no |

## Requirements

| Field | Type | Default | Ask |
| --- | --- | --- | --- |
| `project` | id | — | The project to bind |
| `role` | choice | — | `fe` or `be`: the role of that project to bind |
| `checkout` | choice | routed | `routed` selects the canonical checkout; `session` selects only this request session's registered worktree under the declared policy |
| `gitPolicy` | list of `{worktreeBranches, mutationBranch}` | the policy the route declaration carries; a declaration that carries none is `INVALID_INPUT` at step 1, never a guessed policy | The branch law this binding is verified against; `forbidden` keeps every write on the mutation branch |
| `declaredWriteRoots` | list | empty | The only paths later work may write; anything dirty outside them is `CHECKOUT_DIRTY`, and so is anything dirty at all when the checkout sits on the mutation branch rather than a `session/<sessionId>` branch |
| `runtimeNeed` | choice | none | `none` binds no runtime and skips step 5; `consume` binds the owner's endpoints as a consumer |
| `resume` | token | null | The blocked branch's token when re-entering after a stop |

## Steps

| # | Step | Params | Reads | Writes | Stops with |
| --- | --- | --- | --- | --- | --- |
| 1 | Validate the gate and resume, and refuse every hint it carries | `resume` | `request/request.json`, its requirements and its frozen head | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Bind bootstrap and identity | — | @workspaces/device-state, the machine identity and the sealed credential roster, @tools/secrets | — | `IDENTITY_UNVERIFIED` |
| 3 | Resolve the route | `project`, `role`, `checkout` | @workspaces/projects/<project>/<role> for exactly this project and role, @workspaces/local/routes/<project>/<role>, @tools/git | — | `ROUTE_UNDECLARED`, `ROUTE_UNHYDRATED`, `ROUTE_MISMATCH` |
| 4 | Verify the checkout: branch policy, a clean tree, and the write roots | `gitPolicy`, `declaredWriteRoots` | @workspaces/local/routes/<project>/<role>, the resolved checkout, its branch, its head and its working tree, @tools/git, @tools/shell | — | `BRANCH_POLICY_VIOLATION`, `CHECKOUT_DIRTY` |
| 5 | Bind the runtime the caller consumes from the registry entry of this project route, only when `runtimeNeed` is not none | `runtimeNeed` | @worktrees/sessions/central-runtime, the entry of this `<project>/<role>` with its served head, what that head contains, its lease, its generation, health evidence and identity declaration, @workspaces/ports/<project>, @tools/http | — | `ENDPOINT_AUTHORITY_STALE`, `RUNTIME_NOT_READY`, `RUNTIME_BUSY` |
| 6 | Bind provenance and freshness, then emit | — | everything above, @workspaces/device-state | `response/response.md`, `response/data/route.json`, `response/response.json` | — |

Step 5 recomputes nothing: the endpoint fingerprint either matches the closed projection or the
branch stops. Under `worktreeBranches` set to forbidden, a route binds only on the mutation branch and
records `WORKTREE_BRANCH_FORBIDDEN`; under `session-only` it binds on the mutation branch or on a
`session/<sessionId>` worktree branch, the only shape a source-writing operator may commit to, and
records `WORKTREE_BRANCH_SESSION_ONLY`, because a policy that opens a write path is exactly the
finding a later reader looks for; a redacted conversation head records `PROVENANCE_HEAD_BOUND`, and
a cached receipt matching the same identity tuple and fingerprints records `CACHED_ROUTE_REUSED`. `mutationReadiness` is
`ready` when the observed branch is one the routed policy permits a write on — the mutation branch, or
a `session/<sessionId>` branch under `session-only` — and the working tree carries nothing this step
must refuse; it is `read-only` in every other case, including a route bound with no declared write
roots. The declared write roots exempt dirt only on a `session/<sessionId>` branch, where it is a
session's expected work in progress; the mutation branch has no in-progress state of its own to
exempt, so any dirt observed there — inside a declared write root or outside it — is source that was
written with no session to account for it, and step 4 stops with `CHECKOUT_DIRTY` rather than
reporting a readiness that would carry the violation forward unrecorded. It is derived here and never
accepted from the request, because a readiness a caller can
assert is a readiness nobody measured. A
resume begins again at step 1, reuses only unchanged fingerprinted observations, and consumes the
exact delta. Changed declaration bytes produce a new route fingerprint; reuse also requires the
same selection mode, selected checkout identity and observed source head.

The read-only selection command is `node scripts/workspace-checkout.mjs <project> <role> <sessionId>
<routed|session> [declaredWriteRoot ...]`. It accepts repository-relative write ceilings, never a
checkout path. Its JSON is a checkout observation; the operator still binds identity, authority roots
and any requested runtime to produce the complete route receipt. Step 4 checks the selected tree, and a session selection also requires the canonical
mutation checkout to be clean. The response validator independently repeats the selection and
compares the route fields; request validation checks session selection before dispatch and binds the
session id to its containing coordinate, session state and frozen request hash.

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
| `RUNTIME_BUSY` | terminate |

## Next

| When | Operator |
| --- | --- |
| the route is bound and the checkout carries a publication to push | `git.publish` |
| the route is bound and a promise must be decided against its source | `business.decide` |
| the route is bound and a backend contract must be filled inside it | `backend.source.apply` |
| the route is bound and a frontend surface must be written inside it | `frontend.source.apply` |
| the route binds an explicitly authorized owner package whose existing behavior must be repaired | `library.source.apply` |
| a verified package release must be consumed in exact frontend dependency metadata | `dependency.update` |
| the runtime owner is missing or not ready and one coordination request must be raised | `platform.operate` |
| the route is bound and a frontend surface must be decided inside it | `frontend.direction.decide` |
| the route is bound and a published head must be verified before it ships | `quality.verify` |
| the route is bound and a served surface must be observed | `frontend.surface.audit` |
