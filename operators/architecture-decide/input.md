# Input for `architecture.decide`

The input has two closed sections: `context`, which declares the exact existing material the operator
may read, and `input`, which declares the decision to take and the boundary it may write. Undeclared
fields are invalid.

## Envelope

- `schemaVersion`: exactly `8`.
- `operatorId`: exactly `architecture.decide`.
- `context`: authority and evidence bindings described by `context.md`.
- `input`: one frozen architecture decision.

## Context bindings

`context.businessRefs` binds the promise the architecture serves and may not be empty.
`context.sourceRefs` must contain the routed source, and its `sourceHead` must equal
`input.project.sourceHead`.

`context.inventory` binds the observed stack: its reference, its fingerprint, and one entry per
component with its layer, name, version, and the exact file that evidences it. Component identifiers
are unique, and every evidence reference must be one of the bound sources.

`context.patternRefs` and `context.priorDecisionRefs` are evidence and may be empty.

## Decision boundary

- `input.project` binds the verified source and the only artifact write root.
- `input.objective` names the objective, the single `decisionId`, and `tradeoffAxes`: the
  cross-boundary axes that make this decision worth taking. At least one axis is required, and every
  alternative is later assessed on all of them.

## Constraints

`input.constraints` separates the material by kind:

- `fixed-intent` — what the decision must achieve, not negotiable;
- `measurable` — a stated threshold, count, or limit that an alternative can fail;
- `preference` — what people would like, which never decides anything alone;
- `assumption` — believed but unmeasured, and carried into the output as a known weakness;
- `unknown` — explicitly missing, and never quietly filled in.

At least one `fixed-intent` and one `measurable` constraint are required. A preference that appears in
the comparison as though it were a measurement is the failure this separation exists to prevent.

## Selection policy

`input.selectionPolicy` is `approval-required` or `automatic`.

`approval-required` means product authority chooses. The choice arrives in `input.approval`, naming
the approved alternative and its fingerprint, and the decision must select exactly that alternative.
When no approval is bound, the invocation blocks with `CHOICE_REQUIRED` rather than choosing.

`automatic` means the input itself declared that the operator may bind the surviving alternative. An
automatic policy therefore carries no approval; supplying both would hide which one actually decided.

## Resume input

`resume` is `null` for a new invocation. A resumed invocation supplies the exact blocked receipt, its
single-use token, and the references added since.

Project, source head, decision, objective, and trade-off axes must equal the blocked receipt. A resume
that adds no evidence, constraint, inventory, or approval delta is invalid as `NO_PROGRESS`. A
re-observed system arrives as a new inventory or source fingerprint; the same fingerprint cannot
produce a different answer.
