# `fe/capture-preflight` input

## Context

- `context.authorityRefs`: Exact frozen frontend authority references.
- `context.evidenceRefs`: Exact deterministic runtime evidence references.
- `context.uiKnowledgeId`: Exact StarCi UI knowledge binding.
- `context.runtimeReadinessKnowledgeId`: Exact runtime/capture readiness knowledge binding.
- `context.sourceFingerprint`: Latest source fingerprint to freeze before capture.
- `context.debug`: Requires terminal-visible preflight state and decisions.

## Input

- `input.targetRef`: One closed frontend target.
- `input.round`: Bounded visual round and its fixed discovery, verification, or regression purpose.
- `input.matrix`: Immutable render-state, viewport, and adversarial-probe matrix.
- `input.partitions`: Owner partitions defining fresh capture, dependency-proven reuse, and shared sentinels.
- `input.dataEvidence`: Live data proof, or a content-addressed visual-evidence-only contract fixture with a retained backend gap and the exact consumed `starci-backend-process` `prove` RETURN receipt.
- `input.readinessChecks`: Exact ordered deterministic checks, including runtime origin, contained build/load-ready dependencies, separately recorded repository reproducibility, and viewport-control effectiveness, that must pass before Sol review.

A reused partition requires dependency proof; shared sentinels are always recaptured.
