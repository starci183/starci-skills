# `fe/media-produce` output

- `output.outcome`: `ready` or `blocked`, routed only by the parent Skill.
- `output.result.mediaManifestRef`: Immutable media artifact decision consumed by source composition.
- `output.result.assetRef`: Reused or content-addressed generated asset; null only for no-media.
- `output.result.artifactRefs`: Exact produced artifact references.
- `output.result.provenanceRefs`: Exact generation or reuse provenance.
- `output.result.responsiveTreatmentRef`: Required responsive presentation binding for any media.
- `output.result.altIntentRef`: Required alternative intent binding for any media.
- `output.result.fallbackRef`: Required no-image recovery binding for any media.
- `output.gaps`: Exact blockers; empty when ready.
- `output.evidenceRefs`: Exact evidence used.
