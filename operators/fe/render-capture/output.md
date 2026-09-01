# `fe/render-capture` output

- `output.outcome`: Typed capture result consumed only by the parent Skill machine.
- `output.result`: This operator atomic product, or null when incomplete.
- `output.result.preflightRef`, `compiledRequestRef`, `compiledRequestFingerprint`, `sourceApplyReturnReceiptRef`, `aggregateAfterFingerprint`, `matrixRef`, `matrixFingerprint`, `partitionFingerprint`, and `visualRound`: Exact immutable lineage and capture contract inherited from preflight.
- `output.result.capturePartitionRefs` and `reusedPartitionRefs`: Fresh owner partitions and dependency-proven reused partitions.
- `output.result.sourceFingerprint` and `latestMutationFingerprint`: Derived aliases that must both
  equal the registered `aggregateAfterFingerprint`; `latestMutationAt` and `capturedAt` prove the
  raster packet was created after that mutation.
- `output.result.blindReviewPacketRef`, `blindReviewPacketFingerprint`, and `blindReviewPacket`: The exact immutable raster-only manifest issued by this validated capture RETURN. A later review may bind its receipt and packet fingerprint but may not add, remove, reorder, or relabel rasters.
- `output.result.renderMatrix`: Exactly one latest-source raster for every requested state × viewport cell; the requested source fingerprint, matrix, probe phases, and handoff cell must match the input one-to-one.
- `output.result.adversarialProbeMatrix`: One observed outcome for every requested probe and exact lifecycle phase. An applicable probe without a raster, or an extra unrequested probe/raster, blocks capture.
- `output.result.handoffHostArtifact`: Uncropped real host surface. The packet's sole `lastScreenshotRef` must be this artifact and must have been captured after the last mutation.
- Every raster is content-addressed (`sha256` in the raster reference). Packet raster order is exactly host artifact, state × viewport matrix, then applicable probe rasters; substitution, reordering, mutable filenames, and references not produced by capture are invalid.
- `output.gaps`: Exact blockers or authority gaps.
- `output.evidenceRefs`: Exact evidence used.
- `output.handoff`: Always null; capture has no cross-domain outcome.

`captured` requires a structured result, registered raster/packet artifacts, exact capture evidence,
no gaps, and no handoff. `blocked` requires a null result, exact evidence/gaps, and no handoff. This
operator has no cross-domain outcome.
