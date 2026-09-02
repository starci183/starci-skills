---
name: starci-uat-verify
description: Verify one product-decision flow and publish its canonical backend-owned UAT snapshot and result contract.
---

# starci-uat-verify

Verify one product-decision flow and publish its canonical backend-owned UAT snapshot and result contract.

For an authenticated local flow, consume a Control-Panel-issued account/Browser lease that proves one
fresh run-scoped learner was created in both Keycloak and the application database and broker-login
completed. Freeze its non-secret account record into `snapshot.json`. Never branch to user sign-in or
accept personal credentials; provisioning or authentication unavailability is `BLOCKED`.

Predeclare product-decision cases and consume runtime/template authority without editing it. Store canonical snapshots and results only under the routed backend Source at `.worktrees/uat/<feature>/<flow>/`; never write checkout-local UAT authority or add an extra project directory. A canonical ref is valid only when the exact `snapshot.json` or `result.json` exists, passes its template schema, and matches its returned content fingerprint. Independent Behavior, UX, and UI evidence determines the result.

Publish `complete` only from the final `test/uat-result-publish=passed` route. A fresh finding may
return to frontend only as typed FE-owned counterevidence bound to the current snapshot, unchanged
source, prior blind visual PASS, exact evidence fingerprint, and `reapply`. All ordinary failures
block; they never become completion or an untyped frontend retry.

The public output boundary reopens the exact canonical `result.json`, validates its schema and
feature/flow path, recomputes its semantic content fingerprint, and requires its stored outcome to
match the public verdict. A syntactically valid reference or fingerprint supplied only by the
caller cannot certify UAT; invocation and Quality ancestry remain owned by the validated
`test/uat-result-publish` RETURN route.

## Runtime continuation

Every peer call emits a typed CALL and is resumed only by consuming a correlated runtime `RETURN` receipt. Mission id, parent-child id, authority/source heads, resume state, and progress fingerprint must match. Repeated repair or peer-call fingerprints block as no-progress cycles.
