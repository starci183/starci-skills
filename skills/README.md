# Skills

A StarCi skill is a small state machine that composes operators. Root `analyze-input.md` selects the earliest missing specialized capability from `catalog.json` metadata without loading any skill body. A validated typed handoff selects the next capability only when it becomes necessary. The skill contains no copied design/backend/deployment law; it references shared operators.

Every machine still starts at local `analyze-input`, but it does not choose among skills. It validates the global selection, normalizes scope, evidence readiness, optional depth and external-mutation boundary, then selects the first operator. Only the reached operator retrieves its `knowledgeRefs` through Qdrant, so an unused branch adds no context.

Run `node materialize.mjs`, then `node validate-skills.mjs`. The validator proves one fixed entry per skill, global catalog coverage, referenced operator existence, reachable states, valid targets, explicit terminals, and deterministic routing samples.

## Capability map

| State machine | Responsibility |
| --- | --- |
| `starci-workspace-ready` | Workspace initialization and route readiness |
| `starci-device-checkpoint` | Proven multi-device checkpoint publication |
| `starci-tech-stack` | Operational stack discovery, challenge, and approval |
| `starci-business-authority` | Model and publish one business feature head |
| `starci-business-reconcile` | Reconcile delivery proof with business truth |
| `starci-frontend-ui-direction` → `starci-frontend-design-critique` | Visual exploration and independent challenge |
| `starci-frontend-ux-flow` → `starci-product-potential` → `starci-frontend-ui-detail` | Complete behavior, opportunity discovery, and executable screen detail |
| `starci-frontend-contract-plan` → `starci-frontend-implementation` | Frozen UI contracts followed by bounded source work |
| `starci-frontend-visual-fidelity` → `starci-product-uat` | Rendered fidelity and complete journey proof |
| `starci-architecture-discover` → `starci-data-ownership-model` | Evidence-backed topology and persistence ownership |
| `starci-architecture-option-design` → `starci-architecture-critique` → `starci-architecture-realization` | Alternatives, falsification, and code/deployment binding |
| `starci-backend-solution-design` → `starci-backend-contract-plan` → `starci-backend-contract-critique` | Behavior and exact state-change contracts before code |
| `starci-backend-implementation` → `starci-backend-proof` | Bounded mutation and semantic proof |
| `starci-frontend-block-reconcile` | One block mission across its consumers and any required backend contract, with joined proof |
| `starci-frontend-maintenance-apply` | One approved product-maintenance mission across affected roles, followed by joined proof and learning capture |
| `starci-frontend-learning-resolve` | One queued learning item resolved into authority only |
| `starci-frontend-surface-reconcile` | Closed surface-set mission across affected roles, durable authority, consumer alignment and joined proof |
| `starci-workflow-diagnose` | One read-only workflow diagnosis |
| `starci-quality-readiness` | Readiness inventory and approved repair loop |
| `starci-quality-finding-repair` | One approved measured finding repair |
| `starci-quality-debt-repay` | One declared quality-debt repayment loop |
| `starci-rule-binding-audit` | One executable rule-binding audit |
| `starci-deployment` | One new immutable release rollout |
| `starci-deployment-monitor` | One existing rollout monitoring flow |
| `starci-deployment-recover` | One observed rollout recovery flow |
| `starci-deployment-rollback` | One declared release rollback flow |
| `starci-tunnel-reconcile` | One tunnel and DNS reconciliation |
| `starci-source-index-publish` | One context indexing and publication flow |
| `starci-sonar-service-reconcile` | One Sonar service reconciliation |
| `starci-observability-reconcile` | One observability service reconciliation |
| `starci-conversation-record` | One redacted provenance append |
| `starci-conversation-query` | One bounded provenance query |

Shared logic is consolidated as operators; a skill references it instead of copying an equivalent prompt branch. Lifecycle-sized compatibility skills are absent; routing begins at the earliest missing specialized capability.
