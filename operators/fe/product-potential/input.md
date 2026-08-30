# `fe/product-potential` input

## Context

- `context.evidenceRefs`: Exact canonical evidence references available to this atomic job.
- `context.authorityRevision`: Exact approved authority revision binding this invocation.

## Input

- `input.targetRef`: The one target owned by this atomic invocation.
- `input.constraints`: Closed constraints that bound this job without routing it.
- `input.requiredOutcomeRefs`: Authority-backed user outcomes that the target must complete.
- `input.observedCapabilityRefs`: Complete runtime-observed capability and interaction inventory for
  the target; current presence does not imply `KEEP`.
