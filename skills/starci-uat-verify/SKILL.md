---
name: starci-uat-verify
description: Verify one product-decision flow and publish its canonical backend-owned UAT snapshot and result contract.
---

# starci-uat-verify

Verify one product-decision flow and publish its canonical backend-owned UAT snapshot and result contract.

Predeclare product-decision cases and consume runtime/template authority without editing it. Store canonical snapshots and results only under the routed backend Source at `.worktrees/uat/<feature>/<flow>/`; never write checkout-local UAT authority or add an extra project directory. Independent Behavior, UX, and UI evidence determines the result.

## Runtime continuation

Every peer call emits a typed CALL and is resumed only by consuming a correlated runtime `RETURN` receipt. Mission id, parent-child id, authority/source heads, resume state, and progress fingerprint must match. Repeated repair or peer-call fingerprints block as no-progress cycles.
