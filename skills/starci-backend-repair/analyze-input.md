# Analyze starci-backend-repair input

Global `@selection` has already selected this one-flow skill from prompt intent. Before any operator or Qdrant retrieval, validate the invocation and verify `selection.skillId` equals `starci-backend-repair`. Then perform these local checks:

1. Resolve the approved plan hash, finding and current source baseline.
2. Confirm every write remains inside the approved backend boundary.
3. Route source or boundary drift back to planning.

Reject stale or missing authority/evidence, an ambiguous target, a write root outside scope, external mutation without approval, or an option outside the closed schema. Do not reconsider other skills here; return to global analysis if selection is wrong.

The fixed first state is `route`. Emit only normalized scope and facts as task-session data; do not choose a second mode or copy operator knowledge into context.

## Options

| Option | Values | Decision effect |
| --- | --- | --- |
| `deploymentMode` | `none` / `handoff` | Stop after source proof or hand off to deployment. |
