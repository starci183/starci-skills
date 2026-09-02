# Input for `business.decide`

The input has two closed sections: `context`, which declares the exact existing material the operator
may read, and `input`, which declares the promise to decide and the boundary it may write. Undeclared
fields are invalid.

## Envelope

- `schemaVersion`: exactly `8`.
- `operatorId`: exactly `business.decide`.
- `context`: authority and evidence bindings described by `context.md`.
- `input`: one frozen business decision.

## Context bindings

`context.evidence` binds the normalized claim set. Each claim carries its identifier, kind, role,
statement, source reference, path, line range, and observed head. A claim appears once, its line range
runs forwards, its source is one of `context.sourceRefs`, and a `fact` claim binds a head.

`context.authority` binds the flat businesses root, its fingerprint, and every published head with its
current state. `context.sourceRefs` must contain the routed backend source, and its `sourceHead` must
equal `input.project.sourceHead`. `context.architectureRefs` is evidence and may be empty.

## Decision boundary

- `input.project` binds the verified backend source and the one authority root this invocation writes.
- `input.objective` names the objective reference, the single `featureId`, and the intent: `create`,
  `revise`, `reconcile`, or `retire`.
- `input.publication` names the target state and the head reference. The head must be exactly
  `<businessesRootRef>/features/<featureId>`. `approvalRef` is the owner approval when the transition needs one.

A `retire` intent may only target `rejected`. A `pending` publication is refused when a live head
already exists in any state other than `rejected`, because pending would overwrite published
authority. Every other target state requires an existing head to transition from.

## Discovery

`input.discovery` is the surface the caller actually found in routed source, and it is the reason this
operator exists.

- `consumers` lists every enforcement consumer observed: each with its identifier, the coverage
  dimension it belongs to, and the source it was observed in. Identifiers are unique and each source
  must be bound.
- `lifecycleBranches` lists every lifecycle branch observed in source, such as renewal, cancellation,
  expiry, recovery, or legacy settlement.

Discovery enters the decision as an obligation, not as a suggestion. A consumer declared here must
receive a disposition in the published matrix, and a lifecycle branch declared here may never be
published as not applicable.

## Resume input

`resume` is `null` for a new invocation. A resumed invocation supplies the exact blocked receipt, its
single-use token, and the references added since.

Project, source head, feature, objective, and authority root must equal the blocked receipt. A resume
that adds no evidence, authority, discovery, or approval delta is invalid as `NO_PROGRESS`. Republished
evidence arrives as a new evidence fingerprint; the same fingerprint cannot produce a different answer.
