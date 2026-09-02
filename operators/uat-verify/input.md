# Input for `uat.verify`

The input has two closed sections: `context`, which declares the exact existing material the operator
may read, and `input`, which declares the one flow to verify and the identity, fixtures, and cases
frozen for it. Undeclared fields are invalid.

## Envelope

- `schemaVersion`: exactly `8`.
- `operatorId`: exactly `uat.verify`.
- `context`: authority, admission, and runtime bindings described by `context.md`.
- `input`: one frozen product-decision flow.

## Context bindings

`context.backendSource` names the routed checkout that owns canonical UAT authority, and its
`sourceHead` must equal `input.sourceHead`. `context.protocol` and `context.templates` bind the
evidence law and the canonical file schemas by fingerprint. `context.admission` carries the final
blind visual PASS and the final quality PASS with the times they passed. `context.runtime` binds one
ready owner, its generation, and its exact origins.

## Flow identity

`input.feature` and `input.flow` are the canonical keys that address
`.worktrees/uat/<feature>/<flow>/`. One invocation verifies exactly one flow. A new flow exists only
when the actor or entry, the outcome or terminal, the semantic owner or side effect, or the recovery
topology materially differs; presentation and validation permutations remain cases inside this one.

`input.runId` isolates the account and every fixture this run owns.

## Identity

`input.identity` is either the non-secret account record or an explicit anonymous record.

The account record carries the account reference, the Keycloak and application-database record
references, the principal fingerprint, the fixture namespace, the provisioning owner and mode, the
credential custody mode, and the authenticated state. Every field is a constant, a fingerprint, or a
scheme-bound reference, so no field can hold a password, cookie, token, or OTP.

An account identity requires `input.lease`: the opaque Control-Panel Browser lease whose account,
principal fingerprint, fixture namespace, mission, runtime generation, and origin all equal this run.
Its `accountRecordRef` must address this feature and flow. An anonymous identity requires
`input.lease` to be `null`, because an anonymous journey that carries an authenticated lease is an
inherited session wearing an anonymous label.

A `consumer-materialized` lease must prove a discovered tab in this pass. A lease that could not
materialize runs in `broker-executed` mode and names its evidence broker instead.

## Fixtures

`input.fixture` declares the run namespace, the constraint preflight, the prepare references, and the
cleanup selector. The selector always carries both `is_uat=true` and the exact namespace; either alone
would reach records this run does not own.

Prepare may seed the smallest run-namespaced set needed for a meaningful render, and it finishes
before execution. It may never create the outcome under test.

## Cases

`input.cases` freezes every case before execution: its identifier, its position in the declared
sequential order, the actor kind, the entry, the precondition, the expected outcome, and the
checkpoints that require a capture. Orders form a contiguous sequence starting at one, because the
protocol declares the whole execution order in advance rather than discovering it.

A case whose actor is authenticated cannot appear under an anonymous run identity, and the reverse
holds too.

## Resume input

`resume` is `null` for a new invocation. A resumed invocation supplies the exact blocked receipt, its
single-use token, and the references added since. A resume that adds no admission, lease, evidence, or
case delta is invalid as `NO_PROGRESS`.
