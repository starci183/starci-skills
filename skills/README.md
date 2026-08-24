# Skills

A StarCi skill is a state machine that composes operators. It owns input analysis, routing, `if/else`, loops, approval waits, handoffs and terminal states. It contains no design/backend/deployment knowledge and never copies operator execution law.

Every machine starts at `analyze-input`. Analysis classifies intent, scope, evidence readiness, optional depth and external-mutation boundary before selecting the first operator. Only the reached operator retrieves its `knowledgeRefs` through Qdrant, so an unused branch adds no context.

Run `node materialize.mjs`, then `node validate-skills.mjs`. The validator proves input-mode coverage, referenced operator existence, reachable states, valid targets, explicit terminal states, and deterministic routing samples.

## Capability map

| State machine | Responsibility |
| --- | --- |
| `starci-workspace-ready` | Workspace initialization and route readiness |
| `starci-business-authority` | Evidence-backed business lifecycle |
| `starci-architecture-decide` | Difficult cross-system decisions |
| `starci-backend-delivery` | Approved backend delivery and quality proof |
| `starci-frontend-design-delivery` | Journey, page, layout, block, maintenance, and learning delivery |
| `starci-quality-readiness` | Diagnosis, readiness, repair, debt, and rule accountability |
| `starci-deployment` | Release adoption, rollout, monitoring, recovery, and rollback |
| `starci-platform-services` | Tunnel, MCP/Qdrant, Sonar, and observability services |
| `starci-conversation-provenance` | Redacted conversation provenance |

Shared logic is consolidated as operators; a skill references it instead of copying an equivalent prompt branch.
