# `fe/request-compile` input

## Context

- `context.authorityRefs`: Exact frozen authority references for this job.
- `context.evidenceRefs`: Exact evidence references for this job.

- `context.uiKnowledgeId`: Exact StarCi-native frontend UI knowledge binding.
- `context.scopeKnowledgeId`: Exact UX/UI change-level scope knowledge binding.
- `context.directionKnowledgeId`: Exact direction visualization and unfamiliar-domain research
  knowledge binding.

## Input

- `input.targetRef`: The one target owned by this invocation.
- `input.uxUiChangeLevel`: Projection of the frozen `frontend.ux-ui.change-level` scope dimension.
- `input.directionMode`: `none` for refine or an already approved reconstruct/new direction,
  `dominant` for one evidence-selected direction to generate, or `alternatives` for observed material
  visual ambiguity or an explicit user comparison request.
- `input.directionEvidence`: Exact not-applicable, approved, dominant, ambiguous, or
  comparison-requested classification and its evidence refs. `not-applicable + none` is valid only
  for refine; `approved + none` is valid only for reconstruct/new and binds the exact approved
  direction authority as one `direction://` identity, its `sha256:` content fingerprint, and one
  `direction-approval://` ref. All three must occur in evidence; the direction and approval refs must
  occur exactly in `context.authorityRefs`. Generic or empty authority refs are invalid. For an
  unfamiliar business domain or interaction model without such approval,
  these refs include bounded external-research provenance, observed relationships and limitations,
  or an explicit exhausted-search gap; a design skill or example remains evidence rather than
  authority.
- `input.constraints`: Non-empty closed constraints for this atomic job, including explicit
  preservation and prohibition rules already approved by authority.
