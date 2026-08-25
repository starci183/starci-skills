# Execute `delivery/mission-proof`

## Step 1 — Bind role proofs

**Read:** Validate the mission, impact, product-proof and optional backend-proof receipts.

**Context:** Require backend proof exactly when the impact receipt names the backend role; reject unrelated or extra role claims.

## Step 2 — Join delivery evidence

Verify final routed source heads, approved business identity and proof coverage, then emit one immutable mission-delivery proof for business reconciliation.

**Session write:** Store the joined proof receipt and exact contributing evidence refs until the parent skill terminates.

**Stop:** Block on a missing required proof, stale source head, conflicting authority or unclassified role.

The orchestration profile may parallelize independent proof verification; joining and emitting the mission result remains deterministic.
