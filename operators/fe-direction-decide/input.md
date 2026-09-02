# Input for `fe.direction.decide`

The input has two closed sections: `context`, which declares the exact existing material the operator
may read, and `input`, which declares the decision boundary to execute. Undeclared fields are invalid.

## Envelope

- `schemaVersion`: exactly `8`.
- `operatorId`: exactly `fe.direction.decide`.
- `context`: authority and evidence bindings described by `context.md`.
- `input`: one frozen frontend direction decision.

## Context bindings

`context.business` and `context.grammar` are always required. `context.backend` and
`context.architecture` are either complete accepted bindings or `null`; reference-only or
fingerprint-only partial bindings are invalid.

Knowledge, source, UAT, audit, visual, previous-direction, and external-reference entries use the same
immutable record: exact `ref`, content `fingerprint`, optional `sourceHead`, and `observedAt`. The array
containing a record defines its role. Every source observation uses the source head actually observed.

## Decision boundary

- `input.project` binds the verified frontend source and the only artifact write root.
- `input.target` identifies exactly one page, layout, modal, drawer, flow, block, or component.
- `input.intent` is `create`, `modify`, `audit-repair`, or `reconcile`.
- `input.changeLevel` is exactly one of `new`, `reconstruct`, or `refine`.
- `input.scope.ownerCeiling` partitions mutable and observation-only owners. These sets are unique and
  disjoint; the target owner is mutable.
- `input.constraints` contains only already-authorized constraints. It cannot introduce behavior.

## Direction policy

`decisionPolicy.mode` is:

- `preserve` for `refine`, or for exact reuse of an already approved `new`/`reconstruct` direction;
- `dominant` for the default one-direction decision;
- `compare` only for an explicit comparison request or proven material ambiguity after Grammar is
  complete.

`compare` requires `alternativeCount` of `3` or `4`. Other modes require `null`.

An approved direction is valid only as the exact triple of `directionRef`, `directionFingerprint`,
and direction-specific `approvalRef`. It must use `preserve` mode. Generic approval cannot authorize
reuse.

## Change-level invariants

- `create` and `new` occur together.
- `modify`, `audit-repair`, and `reconcile` use `reconstruct` or `refine`.
- `refine` uses `preserve`, supplies no generated or approved-direction reuse object, and locks region
  ownership, order, navigation, task sequence, interaction container, responsive structure, and
  primary/secondary spans.
- `reconstruct` may replace the existing UI structure but cannot change business/backend authority.

## Resume input

`resume` is `null` for a new invocation. A resumed invocation supplies the exact blocked receipt,
single-use token, newly added context references, and optionally one selected alternative ID.

The mission, project, source, target, change level, owner ceiling, and unchanged authority fingerprints
must equal the blocked receipt. A selected ID must occur in that receipt. A resume that adds no
effective authority, evidence, refreshed source binding, published Grammar, or exact selection is
invalid as `NO_PROGRESS`.

