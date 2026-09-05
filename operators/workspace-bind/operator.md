# workspace.bind

## Job

Resolve one project and role into a verified checkout identity and its exact source head, and return
that as one typed route receipt; the runtime a caller consumes is the runtime owner's to serve and
bind.

## Done when

Done when the `workspace-route-binding` and its `route` name one checkout resolved from the
declaration and its hydrated projection alone, on a branch the routed policy permits with a working
tree carrying nothing the policy refuses, at its observed source head with its derived mutation
readiness, and with no runtime bound.

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

## The route binds no runtime

A route is a checkout and a head, nothing that listens. The shared local frontend, api and identity
processes belong to the runtime owner, which serves the product integration branch, holds the lease
and the pid, and binds the entry a caller consumes with its endpoints, its served head and what that
head contains; an operator that needs a served surface reads that entry through the runtime owner's
alias, never through this receipt. This operator therefore carries no endpoint, no port projection, no
registry entry and no runtime status: `route.runtime` is null on every receipt it writes, and a
binding that carries one has consumed a shared resource on its own initiative. It does not start,
stop, restart, replace or kill a process, and it claims no port, no PID and no runtime lifecycle.

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
carries the observation that justified the stop.

## Concrete attempt flow

This operator's rows are gated by the shared expected/actual attempt contract in `scripts/attempt-gate.mjs`.

| Observed state | Action | Actual check | Next branch |
| --- | --- | --- | --- |
| valid declared checkout | reuse exact disk path, head and policy | read back Git root, installed tree and write roots | emit the binding |
| missing declaration or hydration | guess no similar path and create nothing | record missing declaration/hydration evidence | workspace owner handoff |
| invalid identity, head or policy | refuse cached binding | record the conflicting root, revision or policy | owner repair, then a new read-only attempt |

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
| `gitPolicy` | object `{worktreeBranches, mutationBranch}`, the two fields of the declared route's `repository.gitPolicy` the binding is checked against | the policy the route declaration carries; a declaration that carries none is `INVALID_INPUT` at step 1, never a guessed policy | The branch law this binding is verified against; `forbidden` keeps every write on the mutation branch |
| `declaredWriteRoots` | list | empty | The only paths later work may write; anything dirty outside them is `CHECKOUT_DIRTY`, and so is anything dirty at all when the checkout sits on the mutation branch rather than a `session/<sessionId>` branch |
| `sharedInstall` | choice | false | The installed tree is shared through a junction on purpose; deleting inside it is forbidden |
| `resume` | token | null | The blocked branch's token when re-entering after a stop |

## Steps

| # | Step | Params | Reads | Writes | Stops with |
| --- | --- | --- | --- | --- | --- |
| 1 | Validate the gate and resume, and refuse every hint it carries | `resume` | `request/request.json`, its requirements and its frozen head | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Bind bootstrap and identity | — | @workspaces/device-state, the machine identity and the sealed credential roster, @tools/secrets | — | `IDENTITY_UNVERIFIED` |
| 3 | Inspect the exact declaration and checkout, classify it reusable, missing or invalid by identity and head, and resolve only a reusable declared route | `project`, `role`, `checkout` | @workspaces/projects/<project>/<role> for exactly this project and role, @workspaces/local/routes/<project>/<role>, @tools/git | — | `ROUTE_UNDECLARED`, `ROUTE_UNHYDRATED`, `ROUTE_MISMATCH` |
| 4 | Verify branch policy, clean tree, write roots and installed tree; record the exact owner delta for every invalid check and repair nothing here | `gitPolicy`, `declaredWriteRoots`, `sharedInstall` | @workspaces/local/routes/<project>/<role>, the resolved checkout, its branch, its head, its working tree and its `node_modules`, @tools/git, @tools/shell | — | `BRANCH_POLICY_VIOLATION`, `CHECKOUT_DIRTY` |
| 5 | Bind provenance and freshness, then emit | — | everything above, @workspaces/device-state | `response/response.md`, `response/data/route.json`, `response/response.json` | — |

Under `worktreeBranches` set to forbidden, a route binds only on the mutation branch and
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

The installed tree is part of what a checkout is, and step 4 observes it: `## Checkout` carries an
`Installed tree` row reading `own directory`, `absent`, or `junction to <target>` with the resolved
target. A `node_modules` junction whose target lies outside the checkout is one installed tree several
checkouts share, so a recursive delete inside such a checkout travels through the link and empties the
tree every other checkout is using; the binding is refused with `INVALID_INPUT` unless the request
declared `sharedInstall`, and a checkout that holds one is never deleted from by hand — a temporary
worktree is removed with `git worktree remove --force` and nothing else. The row is observed, never
asserted: the response validator reads the same link and compares.

The read-only selection command is `node scripts/workspace-checkout.mjs <project> <role> <sessionId>
<routed|session> [declaredWriteRoot ...] [--shared-install]`. It accepts repository-relative write ceilings, never a
checkout path. Its JSON is a checkout observation; the operator still binds identity and authority
roots to produce the complete route receipt. Step 4 checks the selected tree, and a session selection also requires the canonical
mutation checkout to be clean. The response validator independently repeats the selection and
compares the route fields; request validation checks session selection before dispatch and binds the
session id to its containing coordinate, session state and frozen request hash.

## Outputs

| Kind | File | Type | Required |
| --- | --- | --- | --- |
| `workspace-route-binding` | `response/response.md` | md | yes |
| `route` | `response/data/route.json` | data | yes |

## The best outcome

On `done`, print **The best outcome** as the resolved route table from `response/data/route.json`, including checkout, branch, revision and declared runtime coordinate when present, with `response/response.md` as the readable receipt. State clearly that a source binding does not prove a runtime is serving that revision; an ambiguous or invalid route shows the candidates or broken declaration and does not link a guessed workspace.

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

## Next

| When | Operator |
| --- | --- |
| the route is bound and the checkout carries a publication to push | `git.publish` |
| the route is bound and a promise must be decided against its source | `business.decide` |
| the route is bound and a boundary must be decided inside it | `architecture.decide` |
| the route is bound and a backend contract must be filled inside it | `backend.generate` |
| the route is bound and the pages and modals a feature needs must be named before one is generated per branch | `interface.plan` |
| the route is bound and the product journeys, actors, cases and fixture references must be frozen before identity and seed effects | `uat.plan` |
| the route is bound and the seeds a mission needs must be planned against its stores before one is placed per branch | `data.plan` |
| the route is bound and a frontend surface must be generated inside it | `interface.generate` |
| the route is bound and one finding on a generated surface must be repaired inside it | `interface.fix` |
| the route binds an explicitly authorized owner package whose existing behavior must be repaired and its release consumed | `library.update` |
| the route is bound and the runtime owner must serve its head before a surface can be observed | `runtime.serve` |
| the route is bound and a published head must be verified before it ships | `quality.verify` |
| the route is bound and a served surface must be observed | `interface.audit` |
