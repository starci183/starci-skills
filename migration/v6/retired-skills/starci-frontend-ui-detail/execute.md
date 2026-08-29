# Execute frontend UI detail

1. Validate approved direction, flow, page set, Grammar, and context freshness.
2. Run only `fe/ui-detail-freeze`.
3. Return the immutable detail artifact for approval or blocked.

## CONTEXT BY STATE

| State | Allowed | Forbidden |
| --- | --- | --- |
| `freeze` | approved direction/flow, Grammar capabilities, generated context candidates | raw source, implementation convenience, unapproved composition |
