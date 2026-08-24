# Analyze starci-deployment-monitor input

Global `@selection` has already selected this one-flow skill from prompt intent. Before any operator or Qdrant retrieval, validate the invocation and verify `selection.skillId` equals `starci-deployment-monitor`. Then perform these local checks:

1. Resolve one existing release and rollout identity.
2. Confirm observation is the starting action.
3. Keep recovery and rollback bound to the same release.

Reject stale or missing authority/evidence, an ambiguous target, a write root outside scope, external mutation without approval, or an option outside the closed schema. Do not reconsider other skills here; return to global analysis if selection is wrong.

The fixed first state is `monitor`. Emit only normalized scope and facts as task-session data; do not choose a second mode or copy operator knowledge into context.

## Options

| Option | Values | Decision effect |
| --- | --- | --- |
| `reconcileBusiness` | `boolean` | Reconcile final proof into the business head. |
