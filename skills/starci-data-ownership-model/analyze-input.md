# Analyze starci-data-ownership-model input

Global `@selection` has already selected this one-flow skill from prompt intent. Before any operator or Qdrant retrieval, validate the invocation and verify `selection.skillId` equals `starci-data-ownership-model`. Then perform these local checks:

1. Require an observed system model.
2. Reject generic datastore or resource identities.
3. Route unresolved source, business, and deployment contradictions.

Reject stale or missing authority/evidence, an ambiguous target, a write root outside scope, external mutation without approval, or an option outside the closed schema. Do not reconsider other skills here; return to global analysis if selection is wrong.

The fixed first state is `ownership`. Emit only normalized scope and facts as task-session data; do not choose a second mode or copy operator knowledge into context.

## Options

| Option | Values | Decision effect |
| --- | --- | --- |
| — | — | No additional option is loaded. |
