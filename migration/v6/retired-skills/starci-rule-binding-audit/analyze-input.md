# Analyze starci-rule-binding-audit input

Global `@selection` has already selected this one-flow skill from prompt intent. Before any operator or default search retrieval, validate the invocation and verify `selection.skillId` equals `starci-rule-binding-audit`. Then perform these local checks:

1. Resolve the declared rules and expected owners.
2. Keep the audit check-only.
3. Reject policy interpretation with no executable target.

Reject stale or missing authority/evidence, an ambiguous target, a write root outside scope, external mutation without approval, or an option outside the closed schema. Do not reconsider other skills here; return to global analysis if selection is wrong.

The fixed first state is `bindings`. Emit only normalized scope and facts as task-session data; do not choose a second mode or copy operator knowledge into context.

## Options

| Option | Values | Decision effect |
| --- | --- | --- |
| — | — | No additional option is loaded. |
