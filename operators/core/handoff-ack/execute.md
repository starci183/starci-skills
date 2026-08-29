# Execute `core/handoff-ack`

## Context

Read only `context.handoffRef` at `context.handoffSha256`, `context.objectiveId`, and the complete `context.artifacts` identity set.

## Input

Bind acknowledgement to `input.objectiveId`, `input.consumerCapability`, and `input.acceptedArtifacts`.

## Action

Compare the consumer objective and every accepted artifact ref/hash with the immutable handoff. Emit one acknowledgement only for an exact complete match and name the retained refs that the runtime may purge.

## Output

Return `output.outcome`, `output.ackRef`, `output.purgeRefs`, `output.evidenceRefs`, and `output.reason`.

## Stop

Return `rejected` without purge authority for a consumer-declared mismatch. Return `blocked` without purge authority when the handoff cannot be read or verified.
