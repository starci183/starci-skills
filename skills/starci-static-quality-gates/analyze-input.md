# Analyze starci-static-quality-gates input

Global `@selection` has already selected this one-flow skill from prompt intent. Before any operator or Qdrant retrieval, validate the invocation and verify `selection.skillId` equals `starci-static-quality-gates`. Then perform these local checks:

1. Require one verified checkout, exact source revision and pinned commands before execution.
2. Activate automatically for a commit request, or directly for an explicit lint/typecheck/Sonar gate request.
3. Allow independent read-only preparation in parallel, but serialize Sonar after its required coverage artifact.
4. Block the commit on any non-green gate and hand repair findings back without mutating source.

Reject stale or missing authority/evidence, an ambiguous target, a write root outside scope, external mutation without approval, or an option outside the closed schema. Do not reconsider other skills here; return to global analysis if selection is wrong.

The fixed first state is `lint`. Emit only normalized scope and facts as task-session data; do not choose a second mode or copy operator knowledge into context.

## Options

| Option | Values | Decision effect |
| --- | --- | --- |
| `trigger` | `commit` / `explicit` | Record whether the gates were activated by a commit request or a standalone gate request. |
