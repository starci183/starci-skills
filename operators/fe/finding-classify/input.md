# `fe/finding-classify` input

## Context

- `context.authorityRefs`: Exact frozen authority references for this job.
- `context.evidenceRefs`: Exact evidence references for this job.

- `context.uiKnowledgeId`: Exact StarCi-native frontend UI knowledge binding.

## Input

- `input.targetRef`: The one target owned by this invocation.
- `input.constraints`: Closed constraints for this atomic job.
- `input.reviewStage`: The visual gate that produced the finding set: `visual-fidelity` or `independent-review`.
- `input.findingSetRef`: Exact validated visual or independent finding product to classify.
- `input.visualRound`: Visual round that produced this complete finding set.
- `input.findingRefs`: Complete ordered finding batch; classification cannot stop at the first defect.
