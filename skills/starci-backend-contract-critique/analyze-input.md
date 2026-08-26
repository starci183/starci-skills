# Analyze starci-backend-contract-critique input

Global `@selection` has already selected this one-flow skill from prompt intent. Before any operator or Qdrant retrieval, validate the invocation and verify `selection.skillId` equals `starci-backend-contract-critique`. Then perform these local checks:

1. Receive the contract without author reasoning.
2. Include a wrong-store counterexample.
3. Route revisions to the owning planning capability.

Reject stale or missing authority/evidence, an ambiguous target, a write root outside scope, external mutation without approval, or an option outside the closed schema. Do not reconsider other skills here; return to global analysis if selection is wrong.

The fixed first state is `critique`. Emit only normalized scope and facts as task-session data; do not choose a second mode or copy operator knowledge into context.

## Options

| Option | Values | Decision effect |
| --- | --- | --- |
| — | — | No additional option is loaded. |
