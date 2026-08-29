# Execute `tech-stack/discover`

## Context

Read only `context.manifestRefs`, `context.configurationRefs`, and `context.deploymentRefs`. Each reference must resolve to the fingerprint in `input.sourceFingerprint`; do not widen the search.

## Input

Bind the inventory to `input.project`, `input.objectiveRef`, and `input.sourceFingerprint`.

## Action

Collect the runtimes, frameworks, persistence, communication, build, deployment, and operational ownership explicitly evidenced by the supplied files into one observed inventory. Classify conflicting observations without proposing a target stack.

## Output

Return `output.outcome`, `output.inventoryRef`, `output.inventorySha256`, `output.evidenceRefs`, `output.contradictions`, and `output.reason`.

## Stop

Return `blocked` when the fingerprint drifts, no evidence file is readable, or a critical contradiction prevents one observed inventory.
