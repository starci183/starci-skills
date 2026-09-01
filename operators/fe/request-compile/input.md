# `fe/request-compile` input

## Context

- `context.authorityRefs`: Exact frozen authority references for this job.
- `context.evidenceRefs`: Exact evidence references for this job.

- `context.uiKnowledgeId`: Exact StarCi-native frontend UI knowledge binding.
- `context.scopeKnowledgeId`: Exact UX/UI change-level scope knowledge binding.

## Input

- `input.targetRef`: The one target owned by this invocation.
- `input.uxUiChangeLevel`: Projection of the frozen `frontend.ux-ui.change-level` scope dimension.
- `input.directionMode`: `none` for refine, `dominant` for one evidence-selected direction, or
  `alternatives` for observed material visual ambiguity or an explicit user comparison request.
- `input.directionEvidence`: Exact not-applicable, dominant, ambiguous, or comparison-requested
  classification and its evidence refs.
- `input.constraints`: Non-empty closed constraints for this atomic job, including explicit
  preservation and prohibition rules already approved by authority.
