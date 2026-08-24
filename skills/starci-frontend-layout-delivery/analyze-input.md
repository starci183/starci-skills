# Analyze starci-frontend-layout-delivery input

Global `@selection` has already selected this one-flow skill from prompt intent. Before any operator or Qdrant retrieval, validate the invocation and verify `selection.skillId` equals `starci-frontend-layout-delivery`. Then perform these local checks:

1. Resolve the complete page set, journey boundary, source contract and Grammar lock.
2. Confirm this is journey-level work.
3. Identify creative approvals and permitted source paths.

Reject stale or missing authority/evidence, an ambiguous target, a write root outside scope, external mutation without approval, or an option outside the closed schema. Do not reconsider other skills here; return to global analysis if selection is wrong.

The fixed first state is `preflight`. Emit only normalized scope and facts as task-session data; do not choose a second mode or copy operator knowledge into context.

## Options

| Option | Values | Decision effect |
| --- | --- | --- |
| `brainstorm` | `default` / `multi-direction` | Default direction depth or explicit brainstorm. |
