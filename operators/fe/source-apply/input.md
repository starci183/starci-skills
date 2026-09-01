# `fe/source-apply` input

## Context

- `context.authorityRefs`: Exact frozen authority references for this job.
- `context.evidenceRefs`: Exact evidence references for this job.

- `context.uiKnowledgeId`: Exact StarCi-native frontend UI knowledge binding.
- `context.resumeState`: Exact `apply` or `reapply` machine state that resumes after a typed backend return.

## Input

- `input.targetRef`: The one target owned by this invocation.
- `input.mode`: `apply` for the approved implementation or `repair` for one accepted frontend finding.
- `input.compiledRequestRef`: Exact compiled request authorizing the mutation.
- `input.compiledRequestFingerprint`: Fingerprint of that exact author-once compiled request.
- `input.uxUiChangeLevel`: Exact compiled `refine`, `reconstruct`, or `new` level.
- `input.directionMode`: Exact compiled `none`, `dominant`, or `alternatives` projection. `none`
  covers refine and reconstruct/new whose exact approved direction was already bound at compilation.
- `input.directionEvidence`: Exact compiled classification and evidence. Approved reuse repeats the
  typed `direction://` identity, content fingerprint, and `direction-approval://` ref, with both
  authority refs present exactly in context; generic or empty authority refs are invalid.
- `input.directionBinding`: Exact direction-generate RETURN, selected direction id/ref, and Grammar
  manifest; null only when `directionMode=none`.
- `input.grammarBinding`: Exact Grammar package/decision identity, composition owner layers and
  authorities, and audit plan from compilation.
- `input.iconographyManifest`: Exact semantic icon decisions and catalog/custom provenance from compilation.
- `input.mediaManifest`: Exact `none|reuse|generate` asset, provenance, responsive, alt, and fallback contract from compilation.
- `input.productFamilyEvidence`: Exact Grammar/DNA identity and benchmark rasters from compilation.
- `input.proofMatrix` / `input.proofMatrixFingerprint`: Exact typed states, canonical viewports/probes,
  populated hero/core task, and cells frozen by compilation.
- `input.constraints`: Closed constraints for this atomic job.
- `input.behaviorContractRef`: Exact frozen behavior-preservation contract implemented by this mutation.
- `input.behaviorContractFingerprint`: Immutable fingerprint binding the mutation to that contract.
- `input.sourceBoundary`: Exact direct-owner file paths, owners, and before hashes authorized for mutation.
- `input.sourceBoundaryFingerprint`: Immutable fingerprint of that ordered source boundary.
