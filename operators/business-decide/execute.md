# Execute `business.decide`

## Single job

Turn one bounded evidence set into one published business promise whose enforcement is completely
disposed. This is one linear operator invocation. It does not call another operator, route a workflow,
pause internally, or return a free-form control instruction.

The five v7 stages — normalize evidence, model the feature, check head staleness, publish the head,
and reconcile delivered source — are steps inside the sequence below, not separate operators.

## No promise without coverage

A promise is publishable only when every one of the eighteen coverage dimensions carries exactly one
disposition, and every consumer and lifecycle branch the caller discovered is disposed by name.

That rule exists because "full access" was modelled, implemented, and published while its downstream
course, community, blog, AI, mock-interview, legacy-sale, quota, settlement, renewal, cancellation,
and recovery consumers had never all been proved. The promise was true in the offer and false at the
guard. Four prohibitions carry the repair, and each is enforced rather than advised:

1. A discovered consumer with no matrix row is `CONSUMER_UNPROVEN`. It is not a warning.
2. A mandatory dimension — actor and eligibility, offer entry, read entry, purchase side effect,
   settlement, idempotency, entitlement consumer, denial — can never be `not-applicable`.
3. A dimension whose branch was observed in source can never be `not-applicable` either. It was found;
   it applies.
4. A `preserve` or `replace` disposition without a negative proof is rejected. Positive proof alone
   shows the promise is granted, never that it is denied when it should be.

The operator never invents an actor, entitlement, quota, payment, settlement, or lifecycle behaviour.
Missing substance is reported as a failure and returned to its owner.

## Sequence

| # | Step | Reads | Writes | Stops with |
| --- | --- | --- | --- | --- |
| 1 | Validate input and resume | input, `@workspaces/be` (the frozen head binding) | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Normalize the evidence | `@workspaces/be` (every claim with its role, path, line range, and head), `@dynamic/architecture-decision.json` (architecture evidence only) | — | `EVIDENCE_MISSING`, `CONTRADICTION_UNRESOLVED` |
| 3 | Check the published head | `@worktrees/businesses/<featureId>` (the current head and the frozen evidence), input (the requested target state) | — | `LIFECYCLE_TRANSITION_INVALID`, `AUTHORITY_CONFLICT`, `APPROVAL_REQUIRED` |
| 4 | Model the promise | `@workspaces/be` (fact claims only) | — | — |
| 5 | Freeze the coverage matrix | input (dimensions), `@workspaces/be` (discovered consumers, normalized claims) | `@dynamic/coverage-matrix.json` | `COVERAGE_INCOMPLETE`, `CONSUMER_UNPROVEN` |
| 6 | Dispose legacy coexistence | `@dynamic/coverage-matrix.json` (legacy create, read, and settle rows and their proof) | — | — |
| 7 | Reconcile when the target is implemented | `@workspaces/be` (delivered source), `@dynamic/coverage-matrix.json` (the frozen matrix) | — | `RECONCILIATION_DISCREPANCY` |
| 8 | Publish one head | `@dynamic/coverage-matrix.json`, `@worktrees/businesses/<featureId>` (the previous head) | `@worktrees/businesses/<featureId>` (the new `model.json` head) | — |
| 9 | Emit and stop | everything above | `@dynamic/business-promise-authority.json` | — |

Validation rejects a stale source binding, unbound claim citations, a head that is not
`features/<featureId>` below the businesses root, a duplicate consumer, an illegal target state for
the observed head, and unchanged progress. Normalization separates every claim into fact, intent,
example, unknown, or contradiction; an unresolved contradiction stops the invocation and is never
averaged away. The head is classified absent, fresh, or stale against the frozen evidence and source
head, and that classification decides which lifecycle transition is legal.

The promise, its actor, and its eligibility are one sentence each and come from fact claims only:
intent claims may shape wording, but they never become enforcement. The coverage matrix carries
exactly one row per dimension, each stating its disposition, the enforcement owner, the enforcing
source, its positive and negative proof, the consumers it disposes, and the claims behind it. It is
content-addressed and its fingerprint travels in the binding, so backend implementation, quality
integration, and UAT can prove they consumed the same matrix rather than a paraphrase of it.

Legacy create, read, and settle each take their own row. A new sale path may retire legacy creation
only while already-purchased rights stay readable and pending legacy settlement still completes, and
the retirement carries proof that the creation path is closed. `implemented` is never published on
the strength of a plan: delivered source is compared against the frozen matrix first.

Publication writes `model.json` at `<businessesRootRef>/features/<featureId>`, stores the version
under `objects/sha256/`, updates `business-registry-v1.json` and `history/by-id.json`, and registers
the head and the matrix in `artifactRefs`. Rejection preserves lineage by naming the previous head
rather than erasing it. Emission returns one output conforming to `output.schema.json` with every
fingerprint bound, and claims no implementation, quality, or UAT proof.

## Dispositions

| Disposition | Meaning | Required substance |
| --- | --- | --- |
| `preserve` | The existing enforcement stays and is proved. | Owner, source, positive proof, negative proof, one fact claim. |
| `replace` | The enforcement changes and the new path is proved. | Owner, source, positive proof, negative proof, one fact claim. |
| `retire` | The path is closed on purpose. | Owner, source, proof the path is closed, one fact claim. |
| `defer` | The branch is knowingly postponed to a named owner. | A deferral reference, and no proof claim at all. |
| `not-applicable` | The branch cannot occur for this promise. | Nothing: no owner, no source, no proof, no consumer, no claim. |

`defer` is a disposition, so a deferred branch does not block publication. What blocks publication is
silence. A deferred row that also claims proof is rejected, because proof for work that has not
happened is the most convincing kind of false pass.

## Resume execution

A resume begins again at validation, reuses only unchanged fingerprinted observations, and consumes
the exact delta. A resume that adds no evidence, authority, discovery, or approval change returns
`NO_PROGRESS`. Republished evidence must arrive as a new fingerprint; the same fingerprint cannot
yield a different answer.

## Mandatory attacks

The operator cannot publish while any applicable item remains unresolved:

- a discovered consumer or lifecycle branch has no disposition;
- a mandatory dimension is marked not applicable;
- an enforcement claim rests only on an example, a screenshot, or an owner's intent;
- a granted path is proved and its denial is not;
- the published state was reached through a transition the lifecycle does not allow;
- `implemented` is claimed while delivered source still differs from the matrix;
- the coverage fingerprint in the binding differs from the matrix that was written;
- an error finding is still open.
