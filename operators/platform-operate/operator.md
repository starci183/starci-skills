# platform.operate

## Job

Operate one bounded shared observability, Sonar, or tunnel service from exact evidence: inventory it,
converge only the approved delta, prove every check the bound knowledge requires, and stop at the
smallest owning gap instead of taking product deployment ownership.

## Shared infrastructure, not product

This operator serves shared infrastructure and never takes product deployment ownership. That
boundary is not advice: a resource can only be changed if the bound inventory lists it under the same
service kind, and a product deployment target is never an observability, Sonar, or tunnel resource. A
plan that reaches for one is invalid input rather than a judgement call at execution time, and a
request to restart a product service to make room for a shared one leaves through a
`PRODUCT_DEPLOYMENT_DECLINED` finding rather than through a mutation.

## One job, three branches

The service kind the inventory records selects the branch, and the three are branches of one job
rather than three operators.
Each branch publishes three closed sets, and each is enforced. Observability applies `update-config`,
`restart-service`, `upsert-dashboard` and `update-remote-write`, proves `service-health`,
`target-boundary`, `label-boundary`, `remote-write-delivery`, `sample-ordering`, `retry-backoff` and
`sensitive-data-filter`, and needs `metrics:remote-write`. Sonar applies `create-project`,
`assign-profile`, `assign-gate` and `enforce-setting`, proves `service-available`, `project-exists`,
`source-revision`, `profile-assigned`, `gate-assigned` and `enforcement-active`, and needs
`sonar:project-admin`. Tunnel applies `create-tunnel`, `update-tunnel-route` and `upsert-proxied-dns`,
proves `dns-target`, `tunnel-route`, `tls` and `public-https`, and needs `tunnel:write` and
`dns:write`. An effect or a check filed under the wrong branch is invalid input rather than a
warning, because a cross-filed effect is how an unapproved change acquires the appearance of
authority. The required proof set is the whole set the branch publishes: the caller cannot ask for
less, because a green dashboard alone never proved delivery, ordering, or redaction.

## Inventory before change

A shared service is inventoried before it is changed. The inventory is bound by fingerprint, so the
receipt states exactly what the service was when the decision was made, and a concurrent revision
becomes visible as `INVENTORY_DRIFT` rather than being silently overwritten. The recheck happens
before any mutation, so a differing revision stops the invocation while nothing has changed yet.
Anything mutated appears in the inventory echo, so a change to a resource nobody looked at first
cannot be reported as an operation at all. An already-converged service is a proved no-op with no
mutation, not a failure and not a rewrite, and a converged operation that reports no mutation is
refused because one of its two statements is false. Application touches only effects inside the
approved set, one resource at a time, recording the before and after revision of each; a partial
application is reported as `PARTIAL_MUTATION` with exact revisions and is never hidden behind a
generic blocker.

## A port in use is a coordination finding

A port already bound by another process is a fact about a shared machine, not permission to reclaim
it. The operation records `PORT_COORDINATION_REQUIRED` naming both the port and the process that
holds it, returns `PORT_CONFLICT`, and stops. It does not stop, kill, restart, or reconfigure the
holder, and no mutation may target a process observed holding a claimed port. Coordination is the
required next step and it belongs to the two owners, not to this invocation; `PORT_CONFLICT` is the
expected outcome on a busy shared machine, not a defect in the plan.

## Credentials are resolved, never recorded

A capability is a handle and its custody evidence. The credential behind it is resolved for use at
the moment of the call and is never logged, echoed into evidence, or persisted. The receipt refuses
the handle as well as the value, because a receipt is durable and a durable record of a capability is
a leaked credential with a delay; a string carrying credential material anywhere in the request or
the response is refused as malformed.

## The desired state is one approved declaration

`desiredState` is the whole of what the person asks for: the approved plan hash, the service kind the
plan was written against, the resources to converge, the effects to apply, and the two scope sets that
say which resources may change and which may only be observed. Keeping it as one declaration is what
makes the approval mean something: `approval` covers that declaration, hash and all, so a field
edited afterwards no longer matches the hash the approval named. `approval` has no default because
this is a runtime other sessions and other people share, and changing what a shared service does is
never something an agent decides alone. `portClaims` defaults to the empty list, because most
operations need no port at all and a claim nobody made cannot collide with anybody.

## Boundary

Context is read-only apart from the approved delta. The operator applies only the approved effect
delta on the inventoried shared service, under an exclusive lease on
`@worktrees/sessions/central-runtime`, and writes only `response/` of its own branch:
`data/delta.json`, `data/checks.json`, `response.md` and `response.json`. It does not deploy,
restart, migrate, or otherwise take ownership of a product service; does not mutate a resource the
bound inventory does not list; does not emit an effect or a check the bound service kind does not
publish; does not free a port by stopping, killing, or reconfiguring the process that already holds
it; does not record a credential value, capability handle, or secret-shaped token anywhere in the
output; does not edit knowledge or grant its own approval; and does not claim an operated outcome
while any required check is absent or failed, nor any product readiness, release approval, or UAT
proof.

## Context

| Alias | Bind | Required |
| --- | --- | --- |
| `@worktrees/sessions/central-runtime` | the shared runtime owner: inventory, generation and health, bound by fingerprint and generation, written only under an exclusive lease | yes |
| `@workspaces/ports/<project>` | the port projection the runtime binds to | yes |
| `@workspaces/device-state` | capability handles by name and their custody; values never appear | yes |
| `@workspaces/projects/<project>/<role>` | which projects the shared services serve | no |

## Inputs

| Kind | From | Required |
| --- | --- | --- |

## Requirements

| Field | Type | Default | Ask |
| --- | --- | --- | --- |
| `service` | id | — | The one shared service being operated |
| `desiredState` | `{planSha256, serviceKind, resourceRefs, effects, mutableResourceRefs, observationOnlyResourceRefs}` | — | The approved declaration: which plan, which branch, which resources, which effects, and what may change against what may only be observed |
| `portClaims` | list of `{port, resourceRef}` | [] | Which ports the desired state needs, and for which owned resource |
| `approval` | id | — | The approval that covers this desired state; changing a shared runtime always needs a person |
| `resume` | token | null | The blocked branch's token when re-entering after a stop |

## Steps

| # | Step | Params | Reads | Writes | Stops with |
| --- | --- | --- | --- | --- | --- |
| 1 | Validate the gate and resume | `resume` | `request/request.json`, @worktrees/sessions/central-runtime at the frozen generation | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Bind the authority: the runtime, the device state, the projects and the approval | `service`, `approval` | @worktrees/sessions/central-runtime for the inventory fingerprint and generation, @workspaces/device-state for each capability handle with its custody evidence, @workspaces/projects/<project>/<role> | — | `AUTHORITY_DRIFT`, `CAPABILITY_MISSING` |
| 3 | Recheck the inventory once before anything changes | — | @worktrees/sessions/central-runtime, the declared resources re-observed once | — | `INVENTORY_DRIFT` |
| 4 | Resolve the port claims | `portClaims` | @workspaces/ports/<project> for the claimed ports, @worktrees/sessions/central-runtime for their observed holders | — | `PORT_CONFLICT` |
| 5 | Derive the delta between what is observed and what is desired | `desiredState` | @worktrees/sessions/central-runtime for the observed state, `request/request.json` for the desired state | `response/data/delta.json` | — |
| 6 | Apply the approved delta, one resource at a time, under an exclusive lease | — | @worktrees/sessions/central-runtime, @workspaces/device-state for the handles by name | @worktrees/sessions/central-runtime, `response/data/delta.json` | `EFFECT_UNAUTHORIZED`, `SERVICE_UNAVAILABLE` |
| 7 | Prove every required check | — | @worktrees/sessions/central-runtime re-read against the branch's complete proof set | `response/data/checks.json` | `PROOF_FAILED` |
| 8 | Write the receipt and emit | — | everything above | `response/response.md`, `response/response.json` | — |

A resume begins again at validation, reuses only unchanged fingerprinted observations, and consumes
the exact delta; a resume that adds no authority, inventory, desired-state or scope change is
`NO_PROGRESS`, and a re-observed inventory must arrive as a new fingerprint because the same
fingerprint cannot yield a different answer.

## Outputs

| Kind | File | Type | Required |
| --- | --- | --- | --- |
| `platform-operation-receipt` | `response/response.md` | md | yes |
| `delta` | `response/data/delta.json` | data | yes |
| `checks` | `response/data/checks.json` | data | yes |

## Stops

| Code | Disposition |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `SOURCE_DRIFT` | terminate |
| `NO_PROGRESS` | terminate |
| `AUTHORITY_DRIFT` | terminate |
| `CAPABILITY_MISSING` | terminate |
| `INVENTORY_DRIFT` | terminate |
| `PORT_CONFLICT` | terminate |
| `EFFECT_UNAUTHORIZED` | terminate |
| `SERVICE_UNAVAILABLE` | terminate |
| `PROOF_FAILED` | terminate |

## Next

| When | Operator |
| --- | --- |
| the routed checkout or its head no longer matches the frozen binding | `workspace.bind` |
| the runtime a frontend surface must be audited against is now serving | `frontend.surface.audit` |
| the shared service is operated and the release that waited on it may continue | `release.deploy` |
