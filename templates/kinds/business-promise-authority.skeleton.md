# business-promise-authority — feature-id

One paragraph: which promise was decided, for which feature, and against which evidence. Written by
`business.decide` as `response/response.md`; read by `backend.generate`, `quality.verify` and
`uat.verify`, which correlate against the same coverage fingerprint rather than a paraphrase of it.

## Binding

| Field | Value |
| --- | --- |
| Feature | `feature-id` |
| Mode | model |
| Target state | pending |
| Head | `.worktrees/businesses/features/feature-id` |
| Claims fingerprint | `sha256:0000000000000000000000000000000000000000000000000000000000000000` |
| Coverage fingerprint | `sha256:0000000000000000000000000000000000000000000000000000000000000000` |

## Promise

| Field | Value |
| --- | --- |
| Promise | one sentence: what the product promises, from fact claims only |
| Actor | one sentence: who the promise is made to |
| Eligibility | one sentence: what makes that actor eligible |

## Lineage

| Field | Value |
| --- | --- |
| Previous head | — on a first publication, otherwise the head this one replaces |
| Previous state | — on a first publication, otherwise pending, in-progress, implemented or rejected |
| Transition | absent->pending |

## Cited claims

| Claim | Kind | Role | Source | Lines | Head |
| --- | --- | --- | --- | --- | --- |
| `claim-id` | fact | what the claim observes | `src/path.ts` | 10-24 | `0000000000000000000000000000000000000000` |

## Coverage

| Dimension | Disposition | Statement | Consumers |
| --- | --- | --- | --- |
| `actor-eligibility` | preserve | who may hold the promise and why | `consumer-id` |
| `offer-entry` | preserve | where the promise is offered | — |
| `read-entry` | preserve | where the promise is read | — |
| `purchase-side-effect` | preserve | what the purchase changes | — |
| `settlement` | preserve | how the purchase settles | — |
| `idempotency` | preserve | what a repeated call does | — |
| `entitlement-consumer` | preserve | which guards read the entitlement | — |
| `denial` | preserve | how the promise is denied when it does not hold | — |
| `renewal` | defer | postponed to a named owner | — |
| `refund` | not-applicable | no refund path exists for this promise | — |
| `legacy-create` | retire | the legacy creation path is closed | — |
| `legacy-read` | preserve | already-purchased rights stay readable | — |
| `legacy-settle` | preserve | pending legacy settlement still completes | — |

## Reconciliation

| Dimension | Delivered evidence | Discrepancy |
| --- | --- | --- |

## Findings

| Code | Severity | Dimension | Statement |
| --- | --- | --- | --- |
| `LEGACY_COEXISTENCE` | info | `legacy-create` | what was observed but not enforced |
