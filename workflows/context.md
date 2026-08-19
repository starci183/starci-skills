# Workflow lifecycle router

## LOADS

None.

## Record

Workflows route user intent into existing discoverable skills. `SKILL.md` remains physically under
`.claude/skills/<name>/`; this router groups lifecycle without creating duplicate capability entries.

## Routes

| Lifecycle | Runtime target |
|---|---|
| Source readiness, inventory, diagnosis and repair | `workflows/source/context.md` |
| Backend plan, approval, implementation and proof | `workflows/backend/context.md` |
| Frontend direction, layout, block and execution | `workflows/frontend/context.md` |
| Quality, lint, coverage, Sonar and assurance | `workflows/quality/context.md` |
| Cloudflare, MCP, Sonar service and deployment | `workflows/operations/context.md` |
| Conversation provenance capture and query | `workflows/conversations/context.md` |
