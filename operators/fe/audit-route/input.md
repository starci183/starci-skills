# `fe/audit-route` input

Consumes the latest failed visual review only. The score and three fingerprints must identify the
same immutable review round. Structural findings and smallest-owner classes prevent a low score
caused by auth, business, or one shared overlay from triggering an unrelated page reconstruction.
`comparisonRequested` is true only when the user explicitly asked to compare alternatives.

- `context.sourceFingerprint`: Latest reviewed source identity.
- `context.evidenceFingerprint`: Latest reviewed raster packet identity.
- `context.findingBatchFingerprint`: Complete latest finding batch identity.
- `input.typedVerdict`: Canonical failed visual verdict being routed.
- `input.score`: Noncanonical evidence-backed progress score.
- `input.changeLevel`: Frozen UX/UI mutation depth.
- `input.comparisonRequested`: Whether the user explicitly requested alternatives.
- `input.structuralFindingRefs`: Direct-owner findings proving composition failure.
- `input.findingOwnerClasses`: Smallest owner classes present in the complete batch.
