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

## Execution sequence

1. **Validate input and resume.** Apply `input.schema.json` and semantic validation. Reject stale
   source binding, unbound claim citations, a head that is not `features/<featureId>` below the businesses
   root, a duplicate consumer, an illegal target state for the observed head, and unchanged progress.
2. **Normalize the evidence.** Separate every claim into fact, intent, example, unknown, or
   contradiction, each cited by role, path, line range, and head. An unresolved contradiction stops
   the invocation with `CONTRADICTION_UNRESOLVED`; it is never averaged away.
3. **Check the published head.** Read the current head for the feature and classify it as absent,
   fresh, or stale against the frozen evidence and source head. The classification decides which
   lifecycle transition is legal, and an illegal transition is `LIFECYCLE_TRANSITION_INVALID`.
4. **Model the promise.** State the promise, its actor, and its eligibility in one sentence each, from
   fact claims only. Intent claims may shape wording; they never become enforcement.
5. **Freeze the coverage matrix.** Write exactly one row per dimension. Each row states its
   disposition, the enforcement owner, the enforcing source, its positive and negative proof, the
   consumers it disposes, and the claims behind it. Content-address the matrix and carry its
   fingerprint into the binding, so backend implementation, quality integration, and UAT can prove
   they consumed the same matrix rather than a paraphrase of it.
6. **Dispose legacy coexistence.** Legacy create, read, and settle each take their own row. A new sale
   path may retire legacy creation only while already-purchased rights stay readable and pending
   legacy settlement still completes, and the retirement carries proof that the creation path is
   closed.
7. **Reconcile when the target is implemented.** Compare delivered source against the frozen matrix.
   Any discrepancy stops the invocation with `RECONCILIATION_DISCREPANCY`; `implemented` is never
   published on the strength of a plan.
8. **Publish one head.** Write `model.json` at `<businessesRootRef>/features/<featureId>`, store the
   version under `objects/sha256/`, update `business-registry-v1.json` and `history/by-id.json`, then
   register the head and the matrix in `artifactRefs`. Rejection preserves lineage by
   naming the previous head rather than erasing it.
9. **Emit and stop.** Return one output conforming to `output.schema.json` with every fingerprint
   bound. Do not claim implementation, quality, or UAT proof.

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
