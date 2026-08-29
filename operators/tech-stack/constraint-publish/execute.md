# Execute `tech-stack/constraint-publish`

## Context

Read `context.stackModelRef` only at `context.stackModelSha256`. Require `context.compatibility` and `context.approval` to bind that same hash.

## Input

Bind the publication to `input.project`, `input.objectiveRef`, and the exact `input.techStackHeadRef` target.

## Action

Write the approved compatible stack model as the declared immutable project tech-stack head, then read it back and hash the published bytes.

## Output

Return `output.outcome`, `output.techStackHeadRef`, `output.techStackHeadSha256`, `output.evidenceRefs`, and `output.reason`.

## Stop

Return `blocked` before writing when any model hash differs or the target is outside the project. Return `blocked` after a failed verified restore if publication cannot be proved.
