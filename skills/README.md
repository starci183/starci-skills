# Skills

A StarCi skill is a state machine that composes operators. Root `analyze-input.md` first selects one skill from `catalog.json` metadata without loading any skill body. The selected skill then owns local input normalization, routing, `if/else`, loops, approval waits, handoffs and terminal states. It contains no design/backend/deployment knowledge and never copies operator execution law.

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
| `starci-frontend-layout-delivery` | Complete journey, page-set, layout, implementation, and proof |
| `starci-frontend-block-reconcile` | One block contract and its bounded consumers |
| `starci-frontend-maintenance-apply` | Approved frontend maintenance and learning capture |
| `starci-frontend-learning-resolve` | One queued frontend design learning item |
| `starci-frontend-surface-reconcile` | Closed-set cross-surface authority reconciliation |
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

Shared logic is consolidated as operators; a skill references it instead of copying an equivalent prompt branch.
