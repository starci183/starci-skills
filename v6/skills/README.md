# Skills

A V6 skill is a state machine that composes operators. It owns input analysis, routing, `if/else`, loops, approval waits, handoffs and terminal states. It contains no design/backend/deployment knowledge and never copies operator execution law.

Every machine starts at `analyze-input`. Analysis classifies intent, scope, evidence readiness, optional depth and external-mutation boundary before selecting the first operator. Only the reached operator retrieves its `knowledgeRefs` through Qdrant, so an unused branch adds no context.

Run `node materialize.mjs`, then `node validate-skills.mjs`. The validator proves input-mode coverage, referenced operator existence, reachable states, valid targets, explicit terminal states, and deterministic routing samples.

## V5 convergence

| V6 state machine | Consolidated V5 skills |
| --- | --- |
| `starci-workspace-ready` | `starci-init` |
| `starci-business-authority` | `starci-business-analyze` |
| `starci-architecture-decide` | `starci-architecture-analyze` |
| `starci-backend-delivery` | `starci-be-plan`, `starci-be-approve`, backend paths from `starci-repair` |
| `starci-frontend-design-delivery` | `starci-fe-design-layout`, `starci-fe-design-block`, `starci-fe-design-refactor`, `starci-fe-design-resolve`, `starci-fe-ui-reconcile` |
| `starci-quality-readiness` | `starci-diagnose`, `starci-repair`, `starci-debt-repay`, `starci-stale-list` |
| `starci-deployment` | `starci-deploy` |
| `starci-platform-services` | `starci-cloudflare-tunnel-set`, `starci-setup-mcp`, `starci-setup-sonar`, `starci-grammar-refresh-references` |
| `starci-conversation-provenance` | `starci-conversation-record` |

`skill-shape` remains a development convention, not an executable product machine. Shared logic is consolidated as operators; a V6 skill references it instead of copying an equivalent prompt branch.
