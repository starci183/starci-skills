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

## Execution sequence

1. **Validate input and resume.** Apply `input.schema.json` and semantic validation. Reject a route
   that declares another identity, a source route carrying a directory, a sibling route that
   traverses, a hydrated route with a foreign workspace root, an observation of a different
   checkout, a runtime bound without need, and an unchanged resume.
2. **Bind bootstrap and identity.** Confirm the bootstrap entries and agent discovery for this
   Source, then the machine identity and its encrypted credential roster. An unverified identity is
   `IDENTITY_UNVERIFIED`. No credential is read, copied, or recorded; only the sealed roster
   reference is bound, and `IDENTITY_ROSTER_SEALED` states that.
3. **Resolve the route.** Read the portable declaration for exactly the requested project and role.
   A declaration that does not exist is `ROUTE_UNDECLARED`; the repair belongs to the workspace
   owner, never to this operator. Hydrate it, and record
   `ROUTE_HYDRATED_FROM_PORTABLE` naming the local route. A missing hydrated route is
   `ROUTE_UNHYDRATED`; a hydrated route that disagrees with the closed portable route on repository,
   branch, or disk path is `ROUTE_MISMATCH`.
4. **Reject every hint.** Record one `HINT_REJECTED` finding per supplied hint, naming what it was
   and why it decided nothing.
5. **Verify the checkout.** Compare the observed head with `input.frozenSourceHead`; a difference is
   `SOURCE_DRIFT`. Confirm the branch against the routed Git policy; under
   `worktreeBranches: forbidden` any branch other than `mutationBranch` is
   `BRANCH_POLICY_VIOLATION`, and the bound route records `WORKTREE_BRANCH_FORBIDDEN`. Confirm that
   nothing dirty lies outside the declared write roots, or return `CHECKOUT_DIRTY`. Derive
   `authorityRoots.businesses` as `<gitRoot>/.worktrees/businesses` when that worktree exists on a
   source checkout, otherwise `null`; it is never accepted from input, because a typed authority root
   is how a second business tree is born.
6. **Bind the runtime when the caller consumes it.** Resolve the owner registry, its generation, and
   its health evidence. Recompute nothing: the `endpointBinding` fingerprint either matches the
   closed `workspace-route-port-projection` or it is `ENDPOINT_AUTHORITY_STALE`. Accept only
   origin-only `http://localhost:<canonical-port>` values. A registry that is missing, stale,
   `starting`, `degraded`, or `stopped` is `RUNTIME_NOT_READY`.
7. **Bind provenance and freshness.** Attach the redacted conversation head when one is supplied and
   record `PROVENANCE_HEAD_BOUND`. When a cached receipt matches the same identity tuple and
   fingerprints, record `CACHED_ROUTE_REUSED`; a stale or invalid cached receipt is evidence, never
   a repair target.
8. **Emit and stop.** Write the route receipt under `input.artifactRootRef`, emit one output
   conforming to `output.schema.json`, and bind every fingerprint.

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
