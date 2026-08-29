# `source/conversation-record` output

The operator returns only `output`.

- `output.outcome`: `recorded`, `idempotent`, `conflict`, or `blocked`.
- `output.headRef` and `output.headSha256`: durable head identity only for recorded or idempotent success.
- `output.writeApplied`: true only when this invocation appended the head.
- `output.reason`: the one reason corresponding to the outcome.
- `output.evidenceRefs`: redaction, authority, prior-head, and durable-write evidence.

The parent Skill machine owns the next state and the runtime owns cleanup.
