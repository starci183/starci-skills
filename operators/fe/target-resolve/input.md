# `fe/target-resolve` input

## Context

- `context.authorityRefs`: Exact frozen authority references for this job.
- `context.evidenceRefs`: Exact evidence references for this job.

- `context.uiKnowledgeId`: Exact StarCi-native frontend UI knowledge binding.

## Input

- `input.targetRef`: The one target owned by this invocation.
- `input.uxUiChangeLevel`: Projection of the frozen `frontend.ux-ui.change-level` scope dimension; target resolution must not widen it.
- `input.constraints`: Closed constraints for this atomic job.
