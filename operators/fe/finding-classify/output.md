# `fe/finding-classify` output

- `output.outcome`: Typed result routed only by the parent Skill machine.
- `output.result`: This operator atomic product, or null when incomplete.
- `output.result.batchRef`: Immutable identity of the complete classified finding batch.
- `output.result.visualRound`: Discovery, verification, or regression round that produced the batch.
- `output.result.findingLedger`: Complete ordered fingerprints, dispositions, and affected owner partitions.
- `output.gaps`: Exact blockers or authority gaps.
- `output.evidenceRefs`: Exact evidence used.
- `output.handoff`: Typed cross-domain continuation, only when the outcome requires it.
