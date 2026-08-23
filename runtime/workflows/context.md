# Workflow lifecycle router

## LOADS

None.

## Record

Workflows route user intent into existing discoverable skills. `SKILL.md` remains physically under
`.claude/skills/<name>/`; this router groups lifecycle without creating duplicate capability entries.

## Routes

| Lifecycle | Runtime target |
|---|---|
| Business actors, flows, rules, states, contracts and product surfaces | `runtime/workflows/business/context.md` |
| Source readiness, inventory, diagnosis and repair | `runtime/workflows/source/context.md` |
| Backend plan, approval, implementation and proof | `runtime/workflows/backend/context.md` |
| Frontend direction, layout, block and execution | `runtime/workflows/frontend/context.md` |
| Quality, lint, coverage, Sonar and assurance | `runtime/workflows/quality/context.md` |
| Cloudflare, MCP, Sonar service and deployment | `runtime/workflows/operations/context.md` |
| Conversation provenance capture and query | `runtime/workflows/conversations/context.md` |
