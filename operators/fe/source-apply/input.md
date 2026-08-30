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
- `input.uiLawBindingRef`: Exact mandatory UI-law gate that validated the direction.
- `input.uiDetailBindingRef`: Exact law-governed destination, progress, and fact-hierarchy semantics
  frozen before layout and Grammar compilation.
- `input.grammarBindingRef`, `input.grammarCoreRef`, `input.packagedContractRefs`, and
  `input.visualDnaRef`: Exact
  pre-source Grammar Core compilation. Token-only or post-mutation styling is not a valid substitute.
- `input.mediaDecisionRef`: Exact frozen media decision; generated assets must already have a frozen brief.
