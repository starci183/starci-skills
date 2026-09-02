# Output of `business.decide`

The operator returns one closed envelope with `outcome` equal to `published` or `blocked`. It never
emits a handoff or a free-form routing instruction.

## Published receipt

A published receipt contains:

- exact project, source, authority root, feature, objective, evidence, discovery, coverage, input, and
  progress bindings;
- the promise, its actor, and its eligibility, each stated once;
- the lineage: the previous head, the previous state, and the named transition;
- every claim the decision cites, with its kind, role, path, line range, and head;
- the coverage matrix reference, its fingerprint, the discovered surface it answers, and one row per
  coverage dimension;
- the reconciliation against delivered source when the published state is `implemented`;
- findings for legacy coexistence, deferrals, and anything observed but not enforced.

The receipt authorises backend implementation, quality integration, and UAT to consume the same
coverage fingerprint. It does not prove that the promise is implemented and carries no verdict.

## The coverage matrix

The matrix is the durable part of this operator. It is a closed table of eighteen dimensions:

`actor-eligibility`, `offer-entry`, `read-entry`, `purchase-side-effect`, `external-payment`,
`settlement`, `idempotency`, `entitlement-consumer`, `quota-consumer`, `renewal`, `cancellation`,
`expiry`, `denial`, `recovery`, `refund`, `legacy-create`, `legacy-read`, `legacy-settle`.

Every dimension appears exactly once. A dimension nobody considered cannot simply be missing from the
table, which is how the previous release published a promise its consumers did not keep.

Each row names its disposition — `preserve`, `replace`, `retire`, `defer`, or `not-applicable` — plus
the enforcement owner, the enforcing source, the positive and negative proof, the consumers it
disposes, and the claims behind it. A row that asserts enforcement rests on at least one `fact` claim.

## Blocked receipt

A blocked receipt has no decision and freezes no coverage fingerprint. It contains one typed failure,
the dimensions and references involved, the owning domain, retryability, and, only when retryable, a
single-use resume token with the required material delta.

## Failure codes

| Code | Owning issue | Valid material delta |
| --- | --- | --- |
| `INVALID_INPUT` | Closed input contract failed. | Corrected input. |
| `SOURCE_DRIFT` | The observed backend source no longer matches the frozen head. | Refreshed source binding. |
| `EVIDENCE_MISSING` | A dimension has no observation behind it at all. | The observed claim. |
| `CONTRADICTION_UNRESOLVED` | Two claims about the same behaviour disagree. | The owner's resolution. |
| `COVERAGE_INCOMPLETE` | A dimension carries no disposition. | The missing disposition. |
| `CONSUMER_UNPROVEN` | A discovered consumer has no disposition or no proof. | The disposition with positive and negative proof. |
| `LIFECYCLE_TRANSITION_INVALID` | The requested state is unreachable from the observed head. | A legal transition, or the intermediate publication. |
| `AUTHORITY_CONFLICT` | The head or root contradicts published authority. | Corrected authority binding. |
| `RECONCILIATION_DISCREPANCY` | Delivered source differs from the frozen matrix. | Corrected source, or a revised matrix. |
| `APPROVAL_REQUIRED` | The transition needs an owner approval that was never bound. | The approval reference. |
| `NO_PROGRESS` | A resume adds no effective delta. | Materially new evidence, authority, discovery, or approval. |

`CONSUMER_UNPROVEN` is the expected outcome when discovery outruns proof. It is owned by business, and
publishing the same promise again after the consumer is disposed is the correct next step.

## Cross-field invariants

- `outcome="published"` requires `receipt.status="published"`, a non-null decision, null `failure`,
  null `resume`, and no open error finding.
- `outcome="blocked"` requires `receipt.status="blocked"`, a null decision, a typed failure, and a null
  `coverageFingerprint`. A retryable failure requires a resume; a non-retryable failure forbids one.
- `receipt.evidenceRefs` and `output.evidenceRefs` are the same set.
- The head is exactly `<businessesRootRef>/features/<featureId>`, is registered in `artifactRefs`, and every
  artifact reference stays under the businesses root.
- `binding.featureId`, `binding.targetState`, and `binding.coverageFingerprint` equal the decision's
  feature, state, and matrix fingerprint.
- The lineage transition agrees with both the previous state and the published state; a first
  publication names no previous head, and every later transition does.
- `implemented` requires a reconciliation with no discrepancy.
- Exactly one row per coverage dimension, and all eighteen present.
- A mandatory dimension is never `not-applicable`, and neither is a discovered lifecycle branch.
- `preserve` and `replace` carry owner, source, positive proof, and negative proof; `retire` carries
  owner, source, and closure proof; `defer` carries a deferral reference and no proof; `not-applicable`
  carries nothing at all.
- Every row claim exists in `citedClaims`, and every enforcing row cites at least one `fact`.
- Every discovered consumer is disposed exactly once, under the dimension it was discovered in, and no
  row disposes a consumer that was never discovered.
- `artifactRefs` registers the coverage matrix.
- `handoff` is always `null`.

## Practical outcomes

Publish a paid access promise: the matrix disposes the course and community guards under
`entitlement-consumer`, the AI meter under `quota-consumer`, the payment webhook under `settlement`,
retires legacy checkout creation while keeping legacy read and legacy settlement enforced, defers
failed-settlement recovery to a named objective, and marks refund not applicable. The head advances
from `pending` to `in-progress` and carries its previous head.

Publish the same promise while one entitlement consumer was found but never disposed: the invocation
returns `CONSUMER_UNPROVEN` naming that consumer, no head is written, and no coverage fingerprint is
frozen.
