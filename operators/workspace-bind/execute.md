# Execute `workspace.bind`

## Single job

Turn one project and role into one verified checkout identity, its exact source head, and the closed
runtime binding the caller may consume, and return that as a typed route receipt. This is one linear
operator invocation. It does not call another operator, route a workflow, pause internally, or return
a free-form instruction.

Everything this operator produces is a binding. It makes no product decision, repairs no route,
initializes no workspace, provisions no account, and publishes nothing.

## Declaration is the only authority

A route exists because a portable declaration in `.workspaces/projects/<project>/<role>.json` says so
and a hydrated local route projects it onto this machine's disk. Four things routinely resemble a
route and are none of it: a directory whose name matches the project, a sibling checkout that sits
next to the Source, the current working directory, and the origin open in a browser.

Those arrive as `context.hints`, each carrying `authoritative: false` as a constant, and each is
recorded as `HINT_REJECTED` rather than consulted. Naming them is the point. A hint that is never
written down is a hint that gets followed the moment the declared route looks inconvenient.

## Sequence

| # | Step | Reads | Writes | Stops with |
| --- | --- | --- | --- | --- |
| 1 | Validate input and resume | input, `@workspaces/local/routes/<project>/<role>` (the observed Source head) | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Bind bootstrap and identity | `@workspaces/device-state` (machine identity and the sealed credential roster), input (Source bootstrap entries, agent discovery) | — | `IDENTITY_UNVERIFIED` |
| 3 | Resolve the route | `@workspaces/projects/<project>/<role>` (the portable declaration for exactly this project and role), `@workspaces/local/routes/<project>/<role>` (the hydrated local route) | — | `ROUTE_UNDECLARED`, `ROUTE_UNHYDRATED`, `ROUTE_MISMATCH` |
| 4 | Reject every hint | input (`context.hints`) | — | — |
| 5 | Verify the checkout | `@workspaces/local/routes/<project>/<role>` (the resolved route, the observed checkout, the routed Git policy, the working tree) | — | `BRANCH_POLICY_VIOLATION`, `CHECKOUT_DIRTY` |
| 6 | Bind the runtime the caller consumes | `@worktrees/sessions/central-runtime` (the owner registry, its generation and health evidence), `@workspaces/ports/<project>` (`workspace-route-port-projection`) | — | `ENDPOINT_AUTHORITY_STALE`, `RUNTIME_NOT_READY` |
| 7 | Bind provenance and freshness | input (the redacted conversation head), `@dynamic/workspace-route-binding.json` (the cached receipt) | — | — |
| 8 | Emit and stop | everything above | `@dynamic/workspace-route-binding.json` | — |

Validation rejects a route that declares another identity, a source route carrying a directory, a
sibling route that traverses, a hydrated route with a foreign workspace root, an observation of a
different checkout, a runtime bound without need, and an unchanged resume.

No credential is read, copied, or recorded; only the sealed roster reference is bound, and
`IDENTITY_ROSTER_SEALED` states that. Hydration records `ROUTE_HYDRATED_FROM_PORTABLE` naming the
local route, and a declaration that does not exist is repaired by the workspace owner, never by this
operator. Each supplied hint gets one `HINT_REJECTED` finding naming what it was and why it decided
nothing.

Under `worktreeBranches: forbidden` any branch other than `mutationBranch` is a policy violation, and
the bound route records `WORKTREE_BRANCH_FORBIDDEN`. `authorityRoots.businesses` is derived as
`<gitRoot>/.worktrees/businesses` when that worktree exists on a source checkout and is `null`
otherwise; it is never accepted from input, because a typed authority root is how a second business
tree is born. The runtime step recomputes nothing: the `endpointBinding` fingerprint either matches
the closed projection or the invocation stops, and only origin-only
`http://localhost:<canonical-port>` values are accepted. A redacted conversation head records
`PROVENANCE_HEAD_BOUND`, and a cached receipt matching the same identity tuple and fingerprints
records `CACHED_ROUTE_REUSED`; a stale or invalid cached receipt is evidence, never a repair target.

## The caller consumes the runtime; it never owns it

The shared local FE, API, and identity processes belong to exactly one delegated owner task. This
operator binds the caller to that owner's endpoints with `consumerRole: "consumer"`, which is a
constant. There is no representable output in which the caller owns a port, a PID, or a process
lifecycle.

`EADDRINUSE`, an unexpected authenticated session, and a failing probe are all evidence to report.
None of them authorises starting, stopping, restarting, replacing, or killing a process, and a port
that merely listens proves nothing about readiness. When the runtime is not ready the invocation
blocks, and the caller raises one coordination request to the registered owner.

## Resume execution

A resume begins again at validation, reuses only unchanged fingerprinted observations, and consumes
the exact delta. A resume that adds no route, identity, runtime, or provenance change returns
`NO_PROGRESS`. A republished route must arrive as a new route fingerprint; the same fingerprint
cannot yield a different binding.

## Mandatory attacks

The operator cannot bind while any applicable item remains unresolved:

- a hint was supplied and no finding records that it decided nothing;
- the portable and hydrated routes disagree on repository, branch, or path;
- the hydrated route names a Source other than this one;
- the observed checkout is not the checkout the route resolved to;
- the observed head differs from the frozen head;
- a route is reported mutation-ready on a branch the policy does not permit;
- a runtime is bound while its owner generation is not ready;
- an endpoint is anything other than an origin-only localhost projection;
- a credential, token, cookie, or password would enter the receipt or any evidence.
