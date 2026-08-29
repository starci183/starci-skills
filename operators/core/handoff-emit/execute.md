# Execute `core/handoff-emit`

## Context

Read only `context.artifacts` and `context.nextCandidates`. Treat every ref and hash as immutable.

## Input

Bind the handoff to `input.objectiveId`, `input.fromCapability`, and `input.terminalCode`.

## Action

Serialize one immutable handoff containing the objective, producer terminal, exact artifacts, and allowed continuation candidates. Register the artifact refs for runtime retention until acknowledgement.

## Output

Return `output.outcome`, `output.handoffRef`, `output.handoffSha256`, `output.retainedArtifactRefs`, `output.evidenceRefs`, and `output.reason`.

## Stop

Return `blocked` before emission on an artifact mismatch, duplicate identity, missing resume identity, or missing mutation approval.
