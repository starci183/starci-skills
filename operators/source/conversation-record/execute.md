# Execute `source/conversation-record`

## Context

Read only `context.policy`, `context.writeAuthority`, and `context.currentHead`. Never load a raw provider transcript.

## Input

Use exactly one `input.identity`, one explicitly redacted `input.snapshot`, its exact `input.redactionReceipt`, bounded `input.artifactRefs`, and one `input.sourceRevision`.

## Action

Verify the redaction receipt against the active policy and snapshot hash, then perform one compare-and-set for the identity. Append one immutable head only when no conflicting head exists. Treat the same identity and snapshot hash as idempotent. Do not update a search cache, query provenance, select another operator, route the workflow, or manage session cleanup.

## Output

Return the compare-and-set outcome, the durable head only for recorded or idempotent success, whether a write occurred, one exact reason, and the evidence inspected.

## Stop

Reject malformed redaction proof. Report denied authority or an identity conflict without writing or overwriting anything.
