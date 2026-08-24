# Analyze starci-deployment input

Global `@selection` has already selected this one-flow skill from prompt intent. Before any operator or Qdrant retrieval, validate the invocation and verify `selection.skillId` equals `starci-deployment`. Then perform these local checks:

1. Resolve environment, manifest, artifact and provider identities.
2. Confirm a new rollout is the outcome.
3. Flag new resources, destructive changes and credential rotation for approval.

Reject stale or missing authority/evidence, an ambiguous target, a write root outside scope, external mutation without approval, or an option outside the closed schema. Do not reconsider other skills here; return to global analysis if selection is wrong.

The fixed first state is `route`. Emit only normalized scope and facts as task-session data; do not choose a second mode or copy operator knowledge into context.

## Options

| Option | Values | Decision effect |
| --- | --- | --- |
| `reconcileBusiness` | `boolean` | Reconcile final proof into the business head. |
