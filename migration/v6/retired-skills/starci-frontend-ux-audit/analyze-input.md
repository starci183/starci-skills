# Analyze starci-frontend-ux-audit input

Global `@selection` has already selected this one-flow skill from prompt intent. Before any operator or default search retrieval, validate the invocation and verify `selection.skillId` equals `starci-frontend-ux-audit`. Then perform these local checks:

1. Require one canonical `.worktrees/uat` flow review from the backend Source selected by the verified `be` route, with a separate happy case; reject checkout-local `.uat`.
2. Bind source, authority, fixture, resource, case and immutable run identities.
3. Return evidence-linked findings without repairing source or manufacturing outcomes.

Reject stale or missing authority/evidence, an ambiguous target, a write root outside scope, external mutation without approval, or an option outside the closed schema. Do not reconsider other skills here; return to global analysis if selection is wrong.

The fixed first state is `audit`. Emit only normalized scope and facts as task-session data; do not choose a second mode or copy operator knowledge into context.

## Options

| Option | Values | Decision effect |
| --- | --- | --- |
| — | — | No additional option is loaded. |
