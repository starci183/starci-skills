# Backend workflows

## LOADS

None.

## Lifecycle

```text
accepted capability request
  → current business feature head
  → starci-be-plan
  → exact revision and pattern bindings
  → starci-be-approve
  → owner OK
  → exact source implementation
  → source gates and production-boundary proof
```

| Phase | Binding skill |
|---|---|
| Plan exact files, schema evidence, sibling family and tests | `skills/starci-be-plan/SKILL.md` |
| Challenge, approve, implement and prove the exact revision | `skills/starci-be-approve/SKILL.md` |

Current product truth is a prerequisite owned by `workflows/business/context.md`; this workflow consumes
its current feature head and returns there when that authority is absent or stale.

No source write occurs between plan and approval.
