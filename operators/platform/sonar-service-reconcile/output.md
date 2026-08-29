# `platform/sonar-service-reconcile` output

- `output.outcome`: `proved` or `blocked`.
- `output.receiptRef`: fresh proof only for complete convergence.
- `output.mutations`: exact Sonar effects and before/after revisions.
- `output.checks`: service plus reread project/profile/gate/enforcement checks.
- `output.reason`: one blocker, otherwise null.
- `output.evidenceRefs`: approval, provider, mutation, and reread evidence.

The Skill machine owns routing; the runtime owns cleanup.
