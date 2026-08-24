# Backend delivery proof

| Field | Value |
| --- | --- |
| Knowledge ID | `be.delivery-proof` |
| Operators | `delivery-proof` |
| Search tags | `backend, proof, evidence, hashes, boundary, completion` |
| Dependencies | `be.verification` |

## Record

Close a backend run by reconciling approved revision, final source boundary, mutation receipts, test evidence, gate evidence, business authority, and final commit identity. Proof aggregates validated evidence; it does not replace or rerun missing verification.

## Completion law

Every planned path must appear with the expected change kind and final hash. Every approved test and gate must have a fresh passing receipt bound to the same revision and commit. No unapproved production path may appear. Product-facing work reconciles its exact business head; technical-only work leaves implemented authority unchanged.

Any missing receipt, hash mismatch, stale source revision, boundary escape, unresolved external blocker, or business-head mismatch returns a blocked proof. Completion is emitted only when the evidence closure is exact.
