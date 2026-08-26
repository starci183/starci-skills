# Execute frontend contract plan

1. Validate approved detail and context freshness.
2. Run only `fe/contract-plan`.
3. Return implementation handoff, typed gap handoff, or blocked.

## CONTEXT BY STATE

| State | Allowed | Forbidden |
| --- | --- | --- |
| `plan` | approved detail, generated candidate records, Grammar contract, exact roots | raw repository scan, composition changes |
