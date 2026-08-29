# Analyze starci-tech-stack input

Global `@selection` has already selected this one-flow skill from prompt intent. Before any operator or default search, validate the invocation and verify `selection.skillId` equals `starci-tech-stack`. Then perform these local checks:

Bind the operational-stack boundary to one routed project and a closed set of service or role and
environment targets. If stack means one service or role versus the whole project, or `observe-only`
versus `recommend-target` is not explicit, return to global analysis for one focused clarification;
do not infer either from manifests.

1. Resolve one project, source generation and target boundary.
2. Separate observed facts from a proposed target.
3. Reject generic datastore identities, missing migration ownership, and unresolved critical contradictions.

Reject stale or missing authority/evidence, an ambiguous target, a write root outside scope, external mutation without approval, or an option outside the closed schema. Do not reconsider other skills here; return to global analysis if selection is wrong.

The fixed first state is `freshness`. Emit only normalized scope and facts as task-session data; do not choose a second mode or copy operator knowledge into context.

## Options

| Option | Values | Decision effect |
| --- | --- | --- |
| `targetMode` | `observe-only` / `recommend-target` | Inventory only or recommend a separately approved target stack. |
