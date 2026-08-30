# `fe/source-apply` input

## Context

- `context.authorityRefs`: Exact frozen authority references for this job.
- `context.evidenceRefs`: Exact evidence references for this job.

- `context.uiKnowledgeId`: Exact StarCi-native frontend UI knowledge binding.

## Input

- `input.targetRef`: The one target owned by this invocation.
- `input.constraints`: Closed constraints for this atomic job.
- `input.behaviorContractRef`: Exact frozen behavior-preservation contract implemented by this mutation.
- `input.behaviorContractFingerprint`: Immutable fingerprint binding the mutation to that contract.
