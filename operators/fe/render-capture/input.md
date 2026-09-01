# `fe/render-capture` input

## Context

- `context.authorityRefs`: Exact frozen authority references for this job.
- `context.evidenceRefs`: Exact evidence references for this job.

- `context.uiKnowledgeId`: Exact StarCi-native frontend UI knowledge binding.

## Input

- `input.targetRef`: The one target owned by this invocation.
- `input.constraints`: Closed constraints for this atomic job.

## Contract fields

- `input.adversarialProbes`: Frozen falsification matrix covering responsive, content, interaction, and boundary attacks.
- Every probe declares an exact lifecycle `phase`; applicable probes must later have a one-to-one raster result for that same phase. Skeleton, loading, steady, scroll start/middle/terminal, zoom-in/zoom-out/restored, overlay, focus, drag limit, and breakpoint-edge are evidence states rather than narrated claims.
- `input.renderStates`: Frozen in-scope entry, task, pending, recovery, result, exit, and other visible states to capture.
- `input.viewports`: The mandatory responsive viewport set.
- `input.handoffStateRef`: Exact visible state that will be handed to the user after completion.
- `input.handoffViewport`: Exact user-visible browser surface and content viewport, without emulation, required for handoff proof.
- `input.grammarBinding`, `input.iconographyManifest`, `input.mediaManifest`, and
  `input.productFamilyEvidence`: Exact compile-owned governance inherited through preflight; capture
  may only project opaque identities into the blind packet.
- `input.preflight`: Exact validated preflight freezing the compiled-request identity, registered
  source-apply RETURN and aggregate after-state, matrix, partition map, visual round, and
  capture/reuse dispositions. No free source fingerprint may replace this lineage.
