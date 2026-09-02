# Input for `backend.implement`

The input has two closed sections: `context`, which declares the exact existing material the operator
may read, and `input`, which declares the outcome to implement and the boundary it may write.
Undeclared fields are invalid.

## Envelope

- `schemaVersion`: exactly `8`.
- `operatorId`: exactly `backend.implement`.
- `context`: authority and evidence bindings described by `context.md`.
- `input`: one frozen backend implementation.

## Context bindings

`context.authority` and `context.patterns` are always required. `context.sourceRefs` must contain the
routed backend source, and its `sourceHead` must equal `input.project.sourceHead`.

`context.authority.decisions` lists every approved business statement, each with an identifier and the
statement itself. An identifier appears once. `context.patterns` binds one reference per aspect, and
an aspect appears at most once, because two families bound for one aspect means no family is bound.

`context.knowledgeRefs` and `context.priorReceiptRefs` are evidence and may be empty.

## The frozen contract

`input.contract` carries `status: "frozen"`, its reference and fingerprint, and at least one operation.
Each operation declares:

- `operationId` and `name`, unique within the contract;
- `transport`: `graphql-mutation`, `graphql-query`, `rest`, `worker`, `cron`, or `event-consumer`;
- `writerRef`: the single file that performs the write, which must lie inside the mutable ceiling;
- `storeRefs`: the stores the operation touches;
- `transactionBoundary`: `single-transaction`, `per-item`, `read-only`, or `none`;
- `idempotencyKind`: `none`, `natural-key`, `request-token`, or `event-id`;
- `migrationRefs`: the migrations this operation ships, possibly empty;
- `authorityDecisionIds`: the approved decisions it implements, at least one;
- `facets`: the contract facets conformance must cover;
- `proofKinds`: the proofs that will measure it.

Four consistency rules are enforced as input validity rather than reported later:

1. an operation whose `writerRef` sits outside `input.scope.mutableFileRefs` names a writer the
   invocation cannot legally touch;
2. an operation shipping migrations must declare the `migration` facet and the `migration-replay`
   proof, because a migration without a replay proof is a schema change nobody re-ran;
3. a `read-only` operation may not ship a migration, because that is a mutation arriving through a
   boundary declared not to mutate;
4. an `event-consumer` with `idempotencyKind: "none"` will apply twice on redelivery, so the contract
   is rejected rather than the duplicate discovered in production.

## Implementation boundary

- `input.project` binds the verified backend source and the only artifact write root.
- `input.outcome` states the one thing being implemented and its kind: `feature`, `repair`,
  `migration`, or `integration`.
- `input.scope` partitions mutable and observation-only files. The sets are disjoint, and every
  contract writer is mutable.

## Resume input

`resume` is `null` for a new invocation. A resumed invocation supplies the exact blocked receipt, its
single-use token, and the references added since.

Project, source head, outcome, contract fingerprint, and mutable ceiling must equal the blocked
receipt. A resume that adds no authority, contract, pattern, or scope delta is invalid as
`NO_PROGRESS`. An approved business decision arrives as a new authority fingerprint: the same
fingerprint cannot produce a different answer.
