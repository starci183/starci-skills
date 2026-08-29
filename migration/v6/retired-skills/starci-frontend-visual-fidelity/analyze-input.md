# Analyze starci-frontend-visual-fidelity input

Global `@selection` has already selected this one-flow skill from prompt intent. Before any operator or default search retrieval, validate the invocation and verify `selection.skillId` equals `starci-frontend-visual-fidelity`. Then perform these local checks:

1. Require approved structure and visual baselines.
2. Compare the same viewport, state, seed, locale and theme.
3. Emit a typed repair handoff for every unauthorized deviation.

Reject stale or missing authority/evidence, an ambiguous target, a write root outside scope, external mutation without approval, or an option outside the closed schema. Do not reconsider other skills here; return to global analysis if selection is wrong.

The fixed first state is `verify`. Emit only normalized scope and facts as task-session data; do not choose a second mode or copy operator knowledge into context.

## Options

| Option | Values | Decision effect |
| --- | --- | --- |
| — | — | No additional option is loaded. |
