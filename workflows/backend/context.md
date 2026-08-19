# Backend workflows

## LOADS

None.

## Lifecycle

```text
accepted capability request
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

No source write occurs between plan and approval.
