# Analyze starci-frontend-request-review input

Global `@selection` has already selected this one-flow skill from prompt intent. Before any operator or default search retrieval, validate the invocation and verify `selection.skillId` equals `starci-frontend-request-review`. Then perform these local checks:

1. Resolve exactly one .claude/requests identity and current revision.
2. Require an explicit approve or reject decision, bounded owners, durable rationale and evidence hash.
3. Treat urgent as queue priority only; never relax proof or ownership.
4. Emit an approved request for learning resolution without mutating .claude, Grammar or product source.

Reject stale or missing authority/evidence, an ambiguous target, a write root outside scope, external mutation without approval, or an option outside the closed schema. Do not reconsider other skills here; return to global analysis if selection is wrong.

The fixed first state is `request-review`. Emit only normalized scope and facts as task-session data; do not choose a second mode or copy operator knowledge into context.

## Options

| Option | Values | Decision effect |
| --- | --- | --- |
| — | — | No additional option is loaded. |
