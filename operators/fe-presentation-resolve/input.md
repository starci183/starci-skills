# Input for `fe.presentation.resolve`

The input has two closed sections: `context`, which declares the exact existing material the operator
may read, and `input`, which declares the tree to resolve and the boundary it may write. Undeclared
fields are invalid.

## Envelope

- `schemaVersion`: exactly `8`.
- `operatorId`: exactly `fe.presentation.resolve`.
- `context`: authority and evidence bindings described by `context.md`.
- `input`: one frozen presentation resolution.

## Context bindings

`context.knowledge` and `context.grammar` are always required. `context.sourceRefs` must contain the
routed frontend source, and its `sourceHead` must equal `input.project.sourceHead`.

`context.knowledge.topics` binds one entry per presentation property, each with its reference,
fingerprint, and the complete list of identifiers it publishes. A topic appears at most once. An
identifier appears under exactly one topic and must carry that topic's prefix.

`context.grammar.ownedRelationships` names each component that already owns a property, and the rule
that ownership satisfies. Every identifier there must occur in the knowledge inventory.

`context.directionRefs` and `context.auditRefs` are evidence and may be empty.

## Resolution boundary

- `input.project` binds the verified frontend source and the only artifact write root.
- `input.target` identifies exactly one page, layout, modal, drawer, flow, block, or component.
- `input.tree` binds the composed tree by reference, fingerprint, format, and node count. The tree is
  the subject of the invocation and is never restructured.
- `input.scope` partitions mutable and observation-only owners. The sets are disjoint, and the target
  owner is mutable.

## Contract emission

`input.contractEmission` selects where the claims are published.

- `attribute` writes `data-contract` onto each application-owned node in the resolved tree, as a
  space-separated token list, and also records every claim in the receipt.
- `receipt-only` writes no attribute. The receipt alone carries the claims, which is the correct
  choice when the resolved tree is a production artifact.

Both modes produce the same claims. The mode changes where an auditor reads them, never whether they
exist.

## Resume input

`resume` is `null` for a new invocation. A resumed invocation supplies the exact blocked receipt, its
single-use token, and the references added since.

Project, source head, target, tree fingerprint, and owner ceiling must equal the blocked receipt. A
resume that adds no knowledge, Grammar, tree, or scope delta is invalid as `NO_PROGRESS`. Republished
knowledge arrives as a new topic fingerprint: the same fingerprint cannot produce a different answer.
