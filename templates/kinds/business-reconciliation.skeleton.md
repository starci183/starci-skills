# business-reconciliation — feature-id

One paragraph: which published promise was compared against which delivered source, dimension by
dimension, and what stands between them. Written by `business.reconcile` as `response/response.md`;
read by `git.publish`, which publishes a delivery only once the head it carries has been reconciled.

## Binding

| Field | Value |
| --- | --- |
| Feature | `feature-id` |
| Target state | implemented |
| Head | `.worktrees/businesses/features/feature-id` |
| Claims fingerprint | `sha256:0000000000000000000000000000000000000000000000000000000000000000` |
| Coverage fingerprint | `sha256:0000000000000000000000000000000000000000000000000000000000000000` |
| Delivered source | `step-1/parallel-2/response/response.md` |

## Lineage

| Field | Value |
| --- | --- |
| Previous head | `.worktrees/businesses/features/feature-id` |
| Previous state | in-progress |
| Transition | in-progress->implemented |

## Cited claims

| Claim | Kind | Role | Source | Lines | Head |
| --- | --- | --- | --- | --- | --- |
| `claim-id` | fact | the guard the delivered source enforces the promise with | `src/path.ts` | 10-24 | `0000000000000000000000000000000000000000` |

## Reconciliation

| Dimension | Delivered evidence | Discrepancy |
| --- | --- | --- |
| `entitlement-consumer` | `src/course/guard.ts` | — |

## Findings

| Code | Severity | Dimension | Statement |
| --- | --- | --- | --- |
| `LEGACY_COEXISTENCE` | info | `legacy-create` | what was observed but not enforced |
