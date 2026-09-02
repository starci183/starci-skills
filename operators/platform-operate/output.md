# Output of `platform.operate`

The operator returns one closed envelope with `outcome` equal to `operated` or `blocked`. It never
emits a handoff or free-form routing instruction.

## Operated receipt

An operated receipt contains:

- exact project, source, service, plan, knowledge, inventory, input, and progress bindings;
- the convergence result, `converged` or `already-converged`;
- the resources that were inventoried before anything changed, and the port holders observed;
- every applied effect with the resource it touched and its before and after revision;
- the branch's complete proof set, every check passed, each with its own evidence;
- findings for the inventory, an already-converged no-op, a partial application, and any declined
  product deployment.

The receipt proves the shared service reached the approved state. It does not prove any product is
released, healthy, or accepted, and it carries no verdict on product behaviour.

## Convergence

`already-converged` means the service already matched the approved plan. It is a success, and it
reports no mutation at all. `converged` means at least one effect was applied, so a `converged`
receipt with no mutation is rejected: one of the two statements is false.

## Ports

`operation.observedPortHolders` echoes who held each claimed port at inventory time. No mutation may
target one of those holders. A conflict is reported as a `PORT_COORDINATION_REQUIRED` finding that
names both the port and its holder, and it can only appear on a blocked receipt carrying
`PORT_CONFLICT`. There is no outcome in which this operator reclaimed a port.

## Blocked receipt

A blocked receipt has no operation. It contains one typed failure, the exact resources and references
involved, the owning domain, retryability, and, only when retryable, a single-use resume token with
the required material delta. Findings still travel on a blocked receipt, which is how a port conflict
reaches the two owners who must coordinate.

## Failure codes

| Code | Owning issue | Valid material delta |
| --- | --- | --- |
| `INVALID_INPUT` | Closed input contract failed. | Corrected input. |
| `SOURCE_DRIFT` | The observed source no longer matches the frozen head. | Refreshed source binding. |
| `AUTHORITY_DRIFT` | The approval or plan hash no longer matches the requested delta. | A fresh approval for the exact plan. |
| `INVENTORY_DRIFT` | A declared resource moved since the inventory was bound. | A re-observed inventory with a new fingerprint. |
| `CAPABILITY_MISSING` | The capability the branch needs is absent or has no custody evidence. | The missing capability handle. |
| `PORT_CONFLICT` | A claimed port is held by another declared process. | An agreed port, or the holder's owner releasing it. |
| `EFFECT_UNAUTHORIZED` | A required effect lies outside the approved set. | An approval that covers it, or a narrower plan. |
| `SERVICE_UNAVAILABLE` | The shared service or its provider cannot be reached. | The restored provider. |
| `PROOF_FAILED` | A required check failed or could not be read after apply. | The repaired service, then a new invocation. |
| `NO_PROGRESS` | A resume adds no effective delta. | Materially new authority, inventory, desired state, or scope. |

`PORT_CONFLICT` is the expected outcome on a busy shared machine, not a defect in the plan. It is
owned by the two service owners together, and coordinating the port is the correct next step.

## Cross-field invariants

- `outcome="operated"` requires `receipt.status="operated"`, non-null `operation`, null `failure`,
  and null `resume`.
- `outcome="blocked"` requires `receipt.status="blocked"`, null `operation`, and non-null `failure`.
  A retryable failure requires a resume; a non-retryable failure forbids one.
- Every mutation effect belongs to the bound service kind.
- Every mutation effect appears in `appliedEffects`, every applied effect records at least one
  mutation, and `appliedEffects` never repeats.
- Every mutated resource appears in `inventoriedResourceRefs`.
- No mutation targets a resource observed holding a claimed port.
- Every check belongs to the bound service kind, names an inventoried resource, and is recorded once.
- An operated outcome requires the branch's complete proof set, every check passed.
- `already-converged` forbids mutations; `converged` requires at least one.
- A `PORT_COORDINATION_REQUIRED` finding names both port and holder, forbids an operated outcome, and
  requires the `PORT_CONFLICT` failure.
- Every finding names an inventoried resource.
- No string anywhere in the output carries a capability handle or credential-shaped token.
- `artifactRefs` registers the operation receipt artifact.
- `handoff` is always `null`.

## Practical outcomes

Converge the metrics stack: the scrape configuration and the remote-write destination are updated on
an inventoried Prometheus, all seven checks pass on their own evidence, and the receipt records both
revisions of each change.

Operate a Grafana that wants a port the product web service already holds: nothing is mutated, the
finding names port and holder, and the receipt returns `PORT_CONFLICT` with a resume that waits for an
agreed port.
