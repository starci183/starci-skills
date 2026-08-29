# `platform/observability-reconcile` output

- `output.outcome`: `proved` or `blocked`.
- `output.receiptRef`: fresh bounded proof only when every postcondition passes.
- `output.mutations`: exact effects and before/after revisions.
- `output.checks`: service health, target and label boundaries, delivery, ordering, retry, and sensitive-data filtering.
- `output.reason`: one blocker, otherwise null.
- `output.evidenceRefs`: approval, mutation, health, delivery, and filtering evidence.

The Skill machine owns routing; the runtime owns cleanup.
