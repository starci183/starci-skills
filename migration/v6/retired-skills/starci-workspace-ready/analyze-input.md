# Analyze starci-workspace-ready input

Global `@selection` has already selected this one-flow skill from prompt intent. Before any operator or default search retrieval, validate the invocation and verify `selection.skillId` equals `starci-workspace-ready`. Then perform these local checks:

1. Resolve Source identity and the exact workspace boundary.
2. Verify bootstrap, declarations, routes, worktree and final route as one readiness flow.
3. Reject undeclared paths or targets outside the workspace.

Reject stale or missing authority/evidence, an ambiguous target, a write root outside scope, external mutation without approval, or an option outside the closed schema. Do not reconsider other skills here; return to global analysis if selection is wrong.

The fixed first state is `identity`. Emit only normalized scope and facts as task-session data; do not choose a second mode or copy operator knowledge into context.

## Options

| Option | Values | Decision effect |
| --- | --- | --- |
| — | — | No additional option is loaded. |
