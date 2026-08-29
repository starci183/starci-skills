# `source/conversation-query` output

The operator returns only `output`.

- `output.outcome`: `found`, `empty`, `forbidden`, `stale`, or `ambiguous`.
- `output.headRef`, `output.headSha256`, `output.snapshotSha256`: complete current-head identity only for `found`; otherwise null.
- `output.artifactRefs`: authorized references only for `found`; never bodies.
- `output.reason`: the one reason corresponding to the outcome.
- `output.evidenceRefs`: policy, scope, index, and head evidence used.

The parent Skill machine owns the next state.
