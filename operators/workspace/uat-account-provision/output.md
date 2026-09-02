# `workspace/uat-account-provision` output

- `output.outcome`: `provisioned` or `blocked`.
- `output.accountRecord`: complete non-secret account record for the canonical UAT snapshot.
- `output.browserLeaseRef`: opaque authenticated Browser lease reference, or null when blocked.
- `output.evidenceRefs`: exact Keycloak, database, and broker-authentication evidence references.
- `output.reason`: exact blocker explanation, otherwise null.

Return `provisioned` only with both store proofs and broker authentication. Return `blocked` without
partial authority when any store or broker authentication fails.
