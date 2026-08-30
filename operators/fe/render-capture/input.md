# `fe/render-capture` input

## Context

- `context.authorityRefs`: Exact frozen authority references for this job.
- `context.evidenceRefs`: Exact evidence references for this job.

- `context.uiKnowledgeId`: Exact StarCi-native frontend UI knowledge binding.

## Input

- `input.targetRef`: The one target owned by this invocation.
- `input.constraints`: Closed constraints for this atomic job.

## Contract fields

- `context.sourceFingerprint`: Fingerprint of the latest source revision that every captured image must render.
- `input.adversarialProbes`: Frozen falsification matrix covering responsive, content, interaction, and boundary attacks.
- Every probe declares an exact lifecycle `phase`; applicable probes must later have a one-to-one raster result for that same phase. Skeleton, loading, steady, scroll start/middle/terminal, zoom-in/zoom-out/restored, overlay, focus, drag limit, and breakpoint-edge are evidence states rather than narrated claims.
- `input.renderStates`: Frozen in-scope entry, task, pending, recovery, result, exit, and other visible states to capture.
- `input.viewports`: The mandatory responsive viewport set.
- `input.handoffStateRef`: Exact visible state that will be handed to the user after completion.
- `input.handoffViewport`: Exact user-visible browser surface and content viewport, without emulation, required for handoff proof.
- `input.preflight`: Exact validated preflight freezing matrix, partition map, visual round, and capture/reuse dispositions.
- `input.productFamilyEvidence`: Exact opaque Grammar Core/package/DNA identity plus content-addressed
  benchmark rasters copied into the blind review packet without source rationale.
- `input.preflight.dataEvidence`: Live data or content-addressed visual-evidence-only contract-fixture routing metadata, including the consumed backend `prove` RETURN for fixture mode.
