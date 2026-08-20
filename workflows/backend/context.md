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
| Refresh actors, flows, rules, states and operation truth when absent or stale | `skills/starci-business-analyze/SKILL.md` |
| Plan exact files, schema evidence, sibling family and tests | `skills/starci-be-plan/SKILL.md` |
| Challenge, approve, implement and prove the exact revision | `skills/starci-be-approve/SKILL.md` |

No source write occurs between plan and approval.
