# Execute `platform.operate`

## Single job

Bring one shared observability, Sonar, or tunnel service to its approved state and prove the result.
This is one linear operator invocation. It does not call another operator, route a workflow, pause
internally, or emit free-form control instructions.

The v7 shape split this work across `observability-reconcile`, `sonar-service-reconcile`,
`tunnel-plan`, and `tunnel-apply`. Those are now steps and branches inside one execute sequence.
Planning is no longer a separate operator: the plan is derived from the inventory inside the same
pass that applies it, and the approved plan hash is what makes that safe.

## Shared infrastructure, not product

This operator serves shared infrastructure and never takes product deployment ownership. It has no
deploy effect to reach for, and the only resources it can touch are the ones the bound inventory
lists under the requested service kind. A request to restart a product service to make room for a
shared one leaves through `PRODUCT_DEPLOYMENT_DECLINED` as a finding, not through a mutation.

## Inventory before change

A shared service is inventoried before it is changed. The inventory is bound by fingerprint, and the
receipt echoes exactly which resources were inventoried. Anything mutated must appear in that echo,
so a change to a resource nobody looked at first cannot be reported as an operation at all.

## A port in use is a coordination finding

A port already bound by another process is a fact about a shared machine, not permission to reclaim
it. The operation records `PORT_COORDINATION_REQUIRED` naming the port and the process that holds it,
returns `PORT_CONFLICT`, and stops. It does not stop, kill, restart, or reconfigure the holder, and
the output contract refuses any mutation aimed at a process observed holding a claimed port.

Coordination is the required next step and it belongs to the two owners, not to this invocation.

## Credentials are resolved, never recorded

The credential behind a capability handle is resolved for use at the moment of the call and is never
logged, echoed into evidence, or persisted. The receipt refuses the handle as well as the value: a
receipt is durable, and a durable record of a capability is a leaked credential with a delay.

## Execution sequence

1. **Validate input and resume.** Apply `input.schema.json` and semantic validation. Reject a stale
   source binding, a cross-filed effect or check, a narrowed proof set, an uninventoried resource, a
   missing capability, credential material in the contract, and unchanged progress.
2. **Bind authority.** Bind the knowledge record for the branch, the approval and its plan hash, each
   capability handle with its custody evidence, the inventory fingerprint, and the routed source head.
3. **Recheck the inventory.** Re-observe the declared resources once. A revision that differs from the
   bound inventory is `INVENTORY_DRIFT` and stops the invocation before any mutation.
4. **Resolve the port claims.** Compare each claimed port against the observed holders. A conflict
   becomes a coordination finding and `PORT_CONFLICT`; a free port is simply bound by the effect that
   needs it.
5. **Derive the delta.** Compare desired against observed and keep only the effects still required. An
   already-converged service is a proved no-op with no mutations, not a failure and not a rewrite.
6. **Apply the approved delta.** Apply only effects inside the approved set, one resource at a time,
   recording the before and after revision of each. A partial application is reported as
   `PARTIAL_MUTATION` with exact revisions; it is never hidden behind a generic blocker.
7. **Prove every required check.** Re-read the service and run the branch's complete proof set. A
   check that is missing, unreadable, or failed cannot end in an operated outcome.
8. **Emit and stop.** Write the receipt under `input.project.artifactRootRef`, emit one output
   conforming to `output.schema.json`, and bind every fingerprint. Do not claim product readiness,
   release approval, or UAT proof.

## Resume execution

A resume begins again at validation, reuses only unchanged fingerprinted observations, and consumes
the exact delta. A resume that adds no authority, inventory, desired-state, or scope change returns
`NO_PROGRESS`. A re-observed inventory must arrive as a new fingerprint; the same fingerprint cannot
yield a different answer.

## Mandatory attacks

The operation cannot be reported as operated while any applicable item remains unresolved:

- a resource was mutated that the inventory echo does not contain;
- an applied effect is outside the approved set or outside the branch;
- a required check is absent, unreadable, or failed;
- a claimed port is held by another process and no coordination finding names its holder;
- a mutation targets a process that was observed holding a claimed port;
- a capability handle or credential-shaped token appears anywhere in the receipt;
- a partial application is reported without both revisions.
