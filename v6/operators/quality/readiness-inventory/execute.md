# Execute quality/readiness-inventory

1. Validate input and freeze its artifact identities.
2. Retrieve `quality.readiness-repair` from Qdrant; do not load unrelated knowledge.
3. Measure route, ports, source gates, indexes, lint machines, formatting, assurance, retired structure, remnants, and debt coverage.
4. Write only declared receipts/side effects, validate output, and return control to the skill state machine.

## LOADS

| Alias | Target | Kind | Why |
| --- | --- | --- | --- |
| `@quality-readiness-repair` | `quality.readiness-repair` | qdrant | retrieve only the law needed by this operator |

Stop when required evidence is missing or stale; the result would cross the declared boundary.
