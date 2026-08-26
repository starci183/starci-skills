# Analyze starci-backend-contract-plan input

Global `@selection` has already selected this one-flow skill from prompt intent. Before any operator or Qdrant retrieval, validate the invocation and verify `selection.skillId` equals `starci-backend-contract-plan`. Then perform these local checks:

1. Require an approved backend solution and data-ownership matrix.
2. Reject unqualified writes and cross-store atomicity fiction.
3. Emit one reviewable contract handoff.

Reject stale or missing authority/evidence, an ambiguous target, a write root outside scope, external mutation without approval, or an option outside the closed schema. Do not reconsider other skills here; return to global analysis if selection is wrong.

The fixed first state is `contract`. Emit only normalized scope and facts as task-session data; do not choose a second mode or copy operator knowledge into context.

## Options

| Option | Values | Decision effect |
| --- | --- | --- |
| — | — | No additional option is loaded. |
