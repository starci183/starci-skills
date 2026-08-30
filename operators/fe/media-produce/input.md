# `fe/media-produce` input

- `context.evidenceRefs`: Exact media-decision and brief evidence.
- `context.authorityRevision`: Exact approved authority revision binding the invocation.
- `input.targetRef`: One closed frontend target.
- `input.mediaDecisionRef`: Frozen no-media, reuse, or generate decision.
- `input.mutationBoundaryRef`: Authorized output boundary, required before file production.
- `input.mode`: The already-decided mode; this operation never chooses it.
- `input.assetBriefRef`: Frozen reusable-asset or generation brief.
- `input.approvedReusableAssetRef`: Exact reusable asset authority in reuse mode.
- `input.outputPath`: Authorized raster path only for generation.
- `input.constraints`: Closed production constraints.
