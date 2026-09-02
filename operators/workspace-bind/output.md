# Output of `workspace.bind`

The operator returns one closed envelope with `outcome` equal to `bound` or `blocked`. It never emits
a handoff or a free-form routing instruction.

## Bound receipt

A bound receipt contains:

- exact project, role, portable route, hydrated route, identity, head, input, and progress bindings;
- the resolved checkout with its disk path, Git root, repository, branch, repository kind, and head;
- the routed Git policy and whether mutation is ready on the observed branch;
- the declared write roots;
- the runtime the caller may consume, or null;
- the provenance head reference, or null;
- findings for the hydration, every rejected hint, the sealed roster, the consumed runtime, the
  forbidden worktree policy, and any reused cached route.

The receipt authorises later work to open exactly this checkout at exactly this head. It proves
nothing about the product, and it carries no verdict, score, or pass claim.

## Route

| Field | Meaning |
| --- | --- |
| `checkout` | The one verified repository this project and role resolve to. |
| `gitPolicy` | The routed worktree policy and the declared mutation branch. |
| `mutationReadiness` | `ready` only on the mutation branch; `read-only` otherwise. |
| `writeRoots` | The only paths later work may write. |
| `authorityRoots` | `businesses`: the business authority root derived from the checkout, or null. `business.decide` copies it as its `businessesRootRef`. |
| `runtime` | The owner's endpoints, consumed as `consumer`, or null. |
| `provenanceHeadRef` | The redacted conversation head, or null. |

`consumerRole` is the constant `consumer`. There is no output in which the caller owns a port, a
process, or a runtime generation.

## Findings

| Code | Meaning |
| --- | --- |
| `ROUTE_HYDRATED_FROM_PORTABLE` | The portable declaration resolved to this local route. Required on every bound route. |
| `HINT_REJECTED` | A similar name, sibling directory, working directory, or browser URL was supplied and decided nothing. |
| `IDENTITY_ROSTER_SEALED` | The credential roster was bound by reference and never read. |
| `RUNTIME_CONSUMED_NOT_OWNED` | The caller consumes the owner's endpoints and owns no lifecycle. Required whenever a runtime is bound. |
| `WORKTREE_BRANCH_FORBIDDEN` | The routed policy forbids task, feature, and worktree branches. Required whenever that policy binds. |
| `PROVENANCE_HEAD_BOUND` | A redacted conversation head was attached. Required whenever one is present. |
| `CACHED_ROUTE_REUSED` | A cached receipt with matching identity and fingerprints was reused. |

## Blocked receipt

A blocked receipt has no route. It contains one typed failure, the exact subjects and references
involved, the owning domain, retryability, and, only when retryable, a single-use resume token with
the required material delta.

## Failure codes

| Code | Owning issue | Owner | Valid material delta |
| --- | --- | --- | --- |
| `INVALID_INPUT` | Closed input contract failed. | caller | Corrected input. |
| `ROUTE_UNDECLARED` | No portable declaration for this project and role. | workspace | The declared route. |
| `ROUTE_UNHYDRATED` | The declaration exists but no local route projects it here. | workspace | The hydrated route. |
| `ROUTE_MISMATCH` | The hydrated route disagrees with the closed portable route. | workspace | A corrected hydration. |
| `IDENTITY_UNVERIFIED` | Machine identity or its encrypted roster is missing or stale. | identity | The verified identity. |
| `BRANCH_POLICY_VIOLATION` | The active branch violates the routed worktree policy. | workspace | A checkout returned to the mutation branch. |
| `CHECKOUT_DIRTY` | Something is dirty outside the declared write roots. | source | A clean boundary, or corrected write roots. |
| `SOURCE_DRIFT` | The observed head differs from the frozen head. | source | A refreshed head binding. |
| `ENDPOINT_AUTHORITY_STALE` | The endpoint binding is not the closed projection, or its fingerprint is stale. | runtime | A recomputed authority fingerprint. |
| `RUNTIME_NOT_READY` | The owner registry is missing, stale, or not ready. | runtime | A ready owner generation. |
| `NO_PROGRESS` | A resume adds no effective delta. | caller | Materially new route, identity, runtime, or provenance. |

`ROUTE_UNDECLARED` and `ROUTE_UNHYDRATED` are the expected outcomes when the workspace has not been
prepared, not defects in the request. Initialization and route repair are separate work, never silent
behaviour inside this operator.

## Cross-field invariants

- `outcome="bound"` requires `receipt.status="bound"`, non-null `route`, null `failure`, and null
  `resume`.
- `outcome="blocked"` requires `receipt.status="blocked"`, null `route`, and non-null `failure`. A
  retryable failure requires a resume; a non-retryable failure forbids one.
- Every failure code carries its own owning domain; a workspace, source, identity, or runtime defect
  can never be filed against the caller.
- `binding.sourceHead` equals `route.checkout.sourceHead`.
- A `source` checkout reports a null directory; a `sibling` checkout reports its relative directory.
- `mutationReadiness="ready"` requires the checkout branch to equal `gitPolicy.mutationBranch`.
- A `forbidden` worktree policy binds only on the mutation branch and always records
  `WORKTREE_BRANCH_FORBIDDEN`.
- Every bound route records `ROUTE_HYDRATED_FROM_PORTABLE` naming `binding.hydratedRouteRef`.
- A non-null `provenanceHeadRef` records `PROVENANCE_HEAD_BOUND` naming that head.
- A bound runtime has `status="ready"`, records `RUNTIME_CONSUMED_NOT_OWNED` naming its owner task,
  belongs to the bound project, has distinct service keys, and exposes three origin-only
  `http://localhost:<port>` endpoints on distinct ports.
- A blocked receipt records neither `ROUTE_HYDRATED_FROM_PORTABLE` nor `RUNTIME_CONSUMED_NOT_OWNED`.
- No finding repeats a code and subject pair.
- `artifactRefs` registers the route receipt artifact.
- `handoff` is always `null`.

## Practical outcomes

Bind `starci-academy/be` on the mutation branch with the shared runtime: the receipt names the Source
root as the checkout, reports mutation ready, rejects the two supplied hints, and binds the owner's
frontend, api, and identity origins as a consumer.

Bind a project whose runtime owner is still starting: the invocation returns `RUNTIME_NOT_READY`
owned by the runtime domain, no route is emitted, and the caller raises one coordination request
rather than starting a server.
