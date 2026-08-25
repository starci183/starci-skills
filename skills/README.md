# Skills

A StarCi skill is a state machine that composes operators. Root `analyze-input.md` first selects one skill from `catalog.json` metadata without loading any skill body. The selected skill then owns one outcome-oriented mission: local input normalization, impact classification, affected FE/BE/data roles, routing, approvals, implementation and joined proof. Mission does not mean technical layer. The skill contains no copied design/backend/deployment law; it references shared operators for every affected role.

Every machine still starts at local `analyze-input`, but it does not choose among skills. It validates the global selection, normalizes scope, evidence readiness, optional depth and external-mutation boundary, then selects the first operator. Only the reached operator retrieves its `knowledgeRefs` through Qdrant, so an unused branch adds no context.

Run `node materialize.mjs`, then `node validate-skills.mjs`. The validator proves one fixed entry per skill, global catalog coverage, referenced operator existence, reachable states, valid targets, explicit terminals, and deterministic routing samples.

## Capability map

| State machine | Responsibility |
| --- | --- |
| `starci-workspace-ready` | Workspace initialization and route readiness |
| `starci-business-authority` | Model and publish one business feature head |
| `starci-business-reconcile` | Reconcile delivery proof with business truth |
| `starci-architecture-decide` | Difficult cross-system decisions |
| `starci-backend-delivery` | New backend delivery and quality proof |
| `starci-backend-repair` | Approved backend repair and quality proof |
| `starci-frontend-layout-delivery` | Complete customer-journey mission across required FE/BE/data roles, with joined acceptance proof |
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

Shared logic is consolidated as operators; a skill references it instead of copying an equivalent prompt branch. Impact classification limits each mission to roles that are actually affected: full-stack ownership does not require gratuitous writes to every layer.
