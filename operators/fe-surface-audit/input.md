# Input for `fe.surface.audit`

The input has two closed sections: `context`, which declares the exact existing material the operator
may read, and `input`, which declares the surface to observe and the conditions to observe it under.
Undeclared fields are invalid.

## Envelope

- `schemaVersion`: exactly `8`.
- `operatorId`: exactly `fe.surface.audit`.
- `context`: authority and evidence bindings described by `context.md`.
- `input`: one frozen surface observation.

## Context bindings

`context.knowledge` and `context.applied` are always required. `context.sourceRefs` must contain the
routed frontend source, and its `sourceHead` must equal `input.project.sourceHead`.

`context.knowledge.topics` binds one entry per rule family, each with its reference, fingerprint,
rule prefix, and the complete list of identifiers it publishes. A topic appears at most once, a prefix
belongs to one topic, and every identifier carries the prefix of the topic that publishes it.

`context.applied` binds the application receipt: its reference, fingerprint, the head the source was
applied at, the contract emission mode, and one claim entry per claiming node. `appliedSourceHead`
must equal `input.project.sourceHead`, because a surface observed at a different head is not the
surface that was applied.

`context.auditRefs` is evidence and may be empty.

## Claims may name anything

A claim entry lists identifier strings, not validated rule identifiers. This is deliberate: an
identifier the bound knowledge does not publish is one of the three findings this audit exists to
produce, so rejecting it at the input boundary would hide the very defect being hunted.

The audit resolves each claimed identifier against the bound inventory and reports the ones that
resolve to nothing.

## Observation boundary

- `input.project` binds the verified frontend source and the artifact write root for the receipt and
  its captures.
- `input.target` identifies exactly one page, layout, modal, drawer, flow, block, or component, and
  its owner must be inside `input.scope.observedOwnerRefs`.
- `input.runtime` binds the endpoint that serves the surface, the exact route path, and how much must
  be served before a capture counts as ready.
- `input.matrix` declares every viewport, color scheme, and state to capture. Each entry has its own
  id, and no two entries describe the same condition: two ids for one condition would let a single
  capture stand in for two.
- `input.scope.observedOwnerRefs` lists every owner whose nodes may be measured. There is no mutable
  set, because this operator writes no product source at all.

## Readiness

`readinessProbe` decides when a capture may be taken. `route-served` waits for the route to render.
`route-and-data-served` additionally waits for the data the surface depends on, which is the correct
choice whenever a measured value would otherwise be taken from a skeleton.

A capture taken before readiness measures the wrong surface, which is why readiness is declared rather
than assumed.

## Resume input

`resume` is `null` for a new invocation. A resumed invocation supplies the exact blocked receipt, its
single-use token, and the references added since.

Project, source head, target, and applied receipt fingerprint must equal the blocked receipt. A resume
that adds no knowledge, applied source, matrix, or runtime delta is invalid as `NO_PROGRESS`.
Republished knowledge arrives as a new topic fingerprint: the same fingerprint cannot produce a
different verdict.
