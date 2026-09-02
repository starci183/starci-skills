# Input for `platform.operate`

The input has two closed sections: `context`, which declares the exact existing material the operator
may read, and `input`, which declares the one service to operate and the boundary it may change.
Undeclared fields are invalid.

## Envelope

- `schemaVersion`: exactly `8`.
- `operatorId`: exactly `platform.operate`.
- `context`: authority and evidence bindings described by `context.md`.
- `input`: one frozen service operation.

## Context bindings

`context.knowledge` binds the platform index plus one record per service kind, each at most once. The
record for the requested kind must be present; operating a Sonar service without the Sonar record is
operating without published law.

`context.authority` binds the approval, the approved plan hash, the allowed effect classes, and its
evidence. `context.capabilities` binds one opaque handle per credential the kind requires.
`context.inventory` binds what the service is now. `context.sourceRefs` must contain the routed
workspace source whose `sourceHead` equals `input.project.sourceHead`. `context.auditRefs` is
evidence and may be empty.

## One job, three branches

`input.service.kind` selects the branch: `observability`, `sonar`, or `tunnel`. These are branches of
one job, not three operators. The branch decides three closed sets, and each is enforced:

| Branch | Effects | Required proof | Capability |
| --- | --- | --- | --- |
| `observability` | config, service restart, dashboard, remote-write | health, target and label boundary, delivery, ordering, retry, sensitive-data filtering | `metrics:remote-write` |
| `sonar` | project, profile, gate, enforcement | availability, project, source revision, profile, gate, enforcement | `sonar:project-admin` |
| `tunnel` | tunnel, route, proxied DNS | DNS target, tunnel route, TLS, public HTTPS | `tunnel:write`, `dns:write` |

An effect or a check filed under the wrong branch is invalid input rather than a warning, because a
cross-filed effect is how an unapproved change acquires the appearance of authority.

## Desired state

`input.desiredState` binds the plan hash, the resources to converge, the effects to apply, and the
proof the operation must produce. Three rules bound it:

1. `planSha256` must equal the approved `context.authority.planSha256`.
2. Every effect must belong to the branch and appear in the approved effect set.
3. `requiredCheckNames` must be the branch's complete proof set. The caller cannot ask for less; a
   green dashboard alone never proved delivery, ordering, or redaction.

Every resource named must already appear in the bound inventory, under the same service kind, and
inside `input.scope.mutableResourceRefs`.

## Ports

`input.portClaims` states which ports the desired state needs and for which resource it needs them. A
claim may only name a resource this operation owns. Whether a claimed port is free is not decided
here: the inventory records who holds it, and the execution decides what that means.

## Scope

`input.scope` partitions resources that may change from resources that may only be observed. The sets
are disjoint, the operated service is mutable, and every desired resource is mutable. A product
service that happens to appear in the inventory belongs in the observation-only set.

## Resume input

`resume` is `null` for a new invocation. A resumed invocation supplies the exact blocked receipt, its
single-use token, and the references added since. Project, source head, service, plan hash, and scope
must equal the blocked receipt. A resume that adds no authority, inventory, desired-state, or scope
delta is invalid as `NO_PROGRESS`.
