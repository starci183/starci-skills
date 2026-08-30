# `fe/independent-review` input

- `context.implementerExecutionRef`: Identity that authored the implementation.
- `context.reviewerExecutionRef`: A different identity that owns the independent verdict; equality is invalid.
- `context.reviewMode`: Must be `blind-pixel`; implementation evidence is withheld while pixels receive the verdict.

## Context

- `context.frozenAuthority`: Frozen authority visible to the independent reviewer.
- `context.frozenEvidence`: Frozen raster/inspection evidence and only minimum runtime reproduction facts visible to the independent reviewer; no source, DOM, tests, measurements, or implementer rationale.

- `context.uiKnowledgeId`: Exact StarCi-native frontend UI knowledge binding.

## Input

- `input.reviewTarget`: The one target under independent review.
- `input.reviewLenses`: Closed review lenses.
- `input.rasterRefs`: Exact ordered content-addressed raster set; every raster requires one verdict in the same order.
- `input.probeSequence`: Exact ordered probe identity; every probe requires one verdict in the same order.
- `input.adversarialProbeRecordsRef`: Frozen per-probe visual records the reviewer must recheck.
- `input.handoffHostArtifactRef`: Uncropped exact host-context handoff screenshot.

## Contract fields

- `context.implementerPrincipalFingerprint`: Runtime-attested implementer principal.
- `context.reviewerPrincipalFingerprint`: Runtime-attested reviewer principal, distinct from the implementer.
- `context.reviewerModel`: Single allowed reviewer model.
- `context.reviewerCount`: Exactly one reviewer execution.
- `context.contextIsolation`: Fresh isolated reviewer context.
- `context.forkTurns`: No producer turns are inherited.
