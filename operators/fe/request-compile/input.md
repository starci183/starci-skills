# `fe/request-compile` input

## Context

- `context.authorityRefs`: Exact frozen authority references for this job.
- `context.evidenceRefs`: Exact evidence references for this job.

- `context.uiKnowledgeId`: Exact StarCi-native frontend UI knowledge binding.
- `context.scopeKnowledgeId`: Exact UX/UI change-level scope knowledge binding.

## Input

- `input.targetRef`: The one target owned by this invocation.
- `input.uxUiChangeLevel`: Projection of the frozen `frontend.ux-ui.change-level` scope dimension.
- `input.constraints`: Closed constraints for this atomic job.
