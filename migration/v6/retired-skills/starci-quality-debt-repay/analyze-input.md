# Analyze starci-quality-debt-repay input

Global `@selection` has already selected this one-flow skill from prompt intent. Before any operator or default search retrieval, validate the invocation and verify `selection.skillId` equals `starci-quality-debt-repay`. Then perform these local checks:

1. Resolve one approved debt identity and closure criterion.
2. Confirm the permitted mutation boundary.
3. Reject undocumented cleanup or unrelated refactoring.

Reject stale or missing authority/evidence, an ambiguous target, a write root outside scope, external mutation without approval, or an option outside the closed schema. Do not reconsider other skills here; return to global analysis if selection is wrong.

The fixed first state is `debt-approval`. Emit only normalized scope and facts as task-session data; do not choose a second mode or copy operator knowledge into context.

## Options

| Option | Values | Decision effect |
| --- | --- | --- |
| — | — | No additional option is loaded. |
