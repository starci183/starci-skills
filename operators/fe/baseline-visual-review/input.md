# `fe/baseline-visual-review` input

Bind one latest-source rapid-baseline packet with wide, compact, core-task, and worst
recovery/constrained cells. The fresh reviewer receives only these rasters and opaque cell labels.

## Context fields

- `context.reviewerExecutionRef`: unique execution identity for this blind review.
- `context.reviewerPrincipalFingerprint`: non-secret reviewer principal identity.
- `context.reviewerContextFingerprint`: fingerprint of the fresh raster-only context.
- `context.reviewerModel`: fixed to `gpt-5.6-sol`.
- `context.reviewerCount`: fixed to one reviewer.
- `context.contextIsolation`: fixed to `fresh`.
- `context.forkTurns`: fixed to `none`; prior mission turns are excluded.
- `context.debug`: fixed to true so concrete per-raster observations remain visible.
- `context.knowledgeRefs`: exact `fe.audit-loop-v75-alpha` and `fe.ui-render-review` bindings.

## Input fields

- `input.targetRef`: direct page or feature owner being audited.
- `input.auditTargetScore`: optional owner-requested progress target, capped at 9.
- `input.packet`: immutable `rapid-baseline` packet for the current source/runtime/lease. It binds the
  packet and source fingerprints, centralized runtime generation, executable Browser lease mode,
  and 3-8 exact raster cells. Cells must collectively include wide, compact, core-task, and either
  recovery or constrained evidence.
