# Input for `quality.verify`

The input has two closed sections: `context`, which declares the exact existing material the operator
may read, and `input`, which declares the delivery to verify and the gate plan it must run. Undeclared
fields are invalid.

## Envelope

- `schemaVersion`: exactly `8`.
- `operatorId`: exactly `quality.verify`.
- `context`: predecessor and evidence bindings described by `context.md`.
- `input`: one frozen verification.

## Context bindings

`context.predecessors` carries at least one upstream receipt with its reference, type, fingerprint, and
observed head. Every head must equal every other and must equal `input.project.sourceHead`; a
disagreement is a mixed predecessor and is rejected before any gate runs.

`context.gateConfigRefs` binds the pinned configuration identity. `context.sourceRefs` must contain the
routed source, and its `sourceHead` must equal `input.project.sourceHead`.
`context.knowledgeRefs` and `context.approvalRefs` are evidence and may be empty.

## Gate plan

`input.gates` lists the gates to run, each once, from `format`, `lint`, `typecheck`, `build`,
`unit-coverage`, `integration`, `e2e`, and `sonar`. Each entry names its pinned `commandRef`, its
`configRef`, and whether it is `required`.

Two plan rules are enforced as input validity:

1. planning `e2e` while `input.explicitE2eRequest` is `false` is invalid, because the end-to-end suite
   runs only when the caller asked for it in this invocation;
2. planning `sonar` while `input.sonarScope` is `not-planned`, or omitting `sonar` while the scope is
   set, contradicts itself. The scope matters because a `new-code` gate says nothing about the project
   beneath it, and the receipt has to record which of the two was measured.

## Coverage thresholds

`input.thresholds` states the statement, line, function, and branch percentages the unit gate must
meet. Branches carry their own threshold rather than inheriting the statement figure, because a branch
threshold folded into the others is how an untested error path passes.

## Declared debt

`input.declaredDebts` may be empty. Each record names its identifier, the gate it covers, the approval
reference, the owner, and the expiry, and the expiry must be later than `input.observedAt`. An expired
approval is not a debt.

A `frontend` delivery may declare no debt at all. A frontend mission reaching quality is
verification-only by then, so a debt recorded here would be a repair decision taken in the wrong place.

## Resume input

`resume` is `null` for a new invocation. A resumed invocation supplies the exact blocked receipt, its
single-use token, and the references added since.

Project, source head, delivery, and gate plan must equal the blocked receipt. A resume that adds no
predecessor, gate, debt, or source delta is invalid as `NO_PROGRESS`. A repaired delivery arrives as a
new source head and a new predecessor fingerprint; the same fingerprint cannot produce a different
answer.
