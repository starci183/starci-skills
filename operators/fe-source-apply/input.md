# Input for `fe.source.apply`

The input has two closed sections: `context`, which declares the exact existing material the operator
may read, and `input`, which declares the frozen boundary it may write. Undeclared fields are invalid.

## Envelope

- `schemaVersion`: exactly `8`.
- `operatorId`: exactly `fe.source.apply`.
- `context`: authority and evidence bindings described by `context.md`.
- `input`: one frozen source application.

## Context bindings

`context.resolution` is always required. It binds the resolution receipt by reference, id, and
fingerprint; the resolved tree by reference and fingerprint; the contract emission mode the resolution
chose; the complete list of class strings it published; and the complete list of rule identifiers it
applied.

`context.sourceRefs` must contain the routed frontend source, and its `sourceHead` must equal
`input.project.sourceHead`. `context.directionRefs` and `context.auditRefs` are evidence and may be
empty.

## Application boundary

- `input.project` binds the verified frontend source and the artifact write root for the receipt.
- `input.target` identifies exactly one page, layout, modal, drawer, flow, block, or component.
- `input.resolution` repeats the receipt reference and fingerprint the caller believes it bound, and
  must equal `context.resolution`. A caller that names one receipt and binds another is rejected
  before any file is opened.
- `input.scope.mutableOwners` names each writable owner and the exact root path it owns.
  `input.scope.observationOnlyOwnerRefs` names the owners that may be read and never written. The two
  sets are disjoint, and the target owner is mutable.
- `input.writeSet` is the exact, complete file set this invocation may touch. Each entry names its
  path, its owner, and whether the path is expected to be created or modified.

## Write set rules

A path appears at most once. Every path is relative, uses forward slashes, and contains no traversal
segment.

Every entry names a mutable owner, and the path must lie under that owner's declared root. Owner
membership alone is not the ceiling: a mutable owner ref attached to a path outside its own root is
exactly how a write escapes the ceiling while still looking authorised.

The write set is a ceiling, not a plan. A declared path that the resolution gives nothing to write is
left untouched and reported as unused; it is never filled with invented content to justify its
declaration.

## Resume input

`resume` is `null` for a new invocation. A resumed invocation supplies the exact blocked receipt, its
single-use token, and the references added since.

Project, source head, target, and resolution fingerprint must equal the blocked receipt. A resume that
adds no resolution, write set, or scope delta is invalid as `NO_PROGRESS`. A re-resolved tree arrives
as a new resolution fingerprint: the same fingerprint cannot produce a different write.
