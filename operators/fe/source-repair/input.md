# `fe/source-repair` input

## Context

- `context.authorityRefs`: Exact frozen authority references for this job.
- `context.evidenceRefs`: Exact evidence references for this job.

- `context.uiKnowledgeId`: Exact StarCi-native frontend UI knowledge binding.

## Input

- `input.targetRef`: The one target owned by this invocation.
- `input.constraints`: Closed constraints for this atomic job.
- `input.behaviorContractRef`: Exact frozen behavior-preservation contract that remains binding.
- `input.behaviorContractFingerprint`: Immutable fingerprint binding repair to that contract.
- `input.failedEvidenceRefs`: Exact latest-source inspection or probe contradictions repaired now.
- `input.repairBatchRef`: One complete classified finding batch repaired atomically.
- `input.affectedPartitionRefs`: Owner partitions invalidated by the batched repair.
