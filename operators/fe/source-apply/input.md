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
- `input.directionMode`: Exact compiled `none`, `dominant`, or `alternatives` projection.
- `input.directionBinding`: Exact direction-generate RETURN, selected direction id/ref, and Grammar
  manifest; null only when `directionMode=none`.
- `input.grammarBinding`: Exact Grammar package, manifest, exports, hash, and revision from compilation.
- `input.proofMatrix` / `input.proofMatrixFingerprint`: Exact typed states, canonical viewports/probes,
  populated hero/core task, and cells frozen by compilation.
- `input.constraints`: Closed constraints for this atomic job.
- `input.behaviorContractRef`: Exact frozen behavior-preservation contract implemented by this mutation.
- `input.behaviorContractFingerprint`: Immutable fingerprint binding the mutation to that contract.
- `input.sourceBoundary`: Exact direct-owner file paths, owners, and before hashes authorized for mutation.
- `input.sourceBoundaryFingerprint`: Immutable fingerprint of that ordered source boundary.
