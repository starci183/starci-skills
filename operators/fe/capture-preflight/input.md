# `fe/capture-preflight` input

## Context

- `context.authorityRefs`: Exact frozen frontend authority references.
- `context.evidenceRefs`: Exact deterministic runtime evidence references.
- `context.uiKnowledgeId`: Exact StarCi UI knowledge binding.
- `context.runtimeReadinessKnowledgeId`: Exact `fe.runtime-capture-readiness` deterministic authority.
- `context.resumeState`: Exact `capture-preflight` or `recapture-preflight` state to preserve across a backend handoff.
- `context.debug`: Requires terminal-visible preflight state and decisions.

## Input

- `input.targetRef`: One closed frontend target.
- `input.compiledRequestRef`: Exact author-once compiled request reference.
- `input.compiledRequestFingerprint`: Exact inherited fingerprint of that compiled request.
- `input.sourceApplyReturnReceiptRef`: Exact registered source-apply RETURN receipt.
- `input.aggregateAfterFingerprint`: Exact aggregate mutation after-state; preflight never accepts a free source fingerprint.
- `input.grammarBinding`, `input.iconographyManifest`, `input.mediaManifest`, and
  `input.productFamilyEvidence`: Exact compile-owned governance inherited unchanged through source apply.
- `input.round`: Bounded visual round and its fixed discovery, verification, or regression purpose.
- `input.matrix`: Immutable proof matrix inherited from compile, including the populated happy hero,
  core task, every state x viewport cell, exact `wide -> intermediate -> compact` viewports, and all
  22 canonical adversarial probes in canonical category/phase order.
- `input.partitions`: Owner partitions defining fresh capture, dependency-proven reuse, and shared sentinels.
- `input.readinessChecks`: Exact ordered deterministic checks, including runtime origin, contained build/load-ready dependencies, separately recorded repository reproducibility, and viewport-control effectiveness, that must pass before Sol review.

For a capability absent from the direct owner, the corresponding check records passed readiness via
exact non-applicability evidence and keeps every canonical probe phase with the same typed reason.
Tooling inability is not non-applicability for a capability the feature actually exposes.

A reused partition requires dependency proof; shared sentinels are always recaptured. The frozen
populated happy-case hero must be provable at wide, intermediate, and compact by `data-ready`, `steady-not-skeleton`, and
`state-content-valid`; supporting empty/loading/recovery states cannot replace it.
