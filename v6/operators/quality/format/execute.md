# Execute quality/format

1. Validate input and freeze its artifact identities.
2. Retrieve `quality.source-gates` from Qdrant; do not load unrelated knowledge.
3. Execute only this gate, record command/identity/counts/verdict, and never repair source locally.
4. Write only declared receipts/side effects, validate output, and return control to the skill state machine.

## LOADS

| Alias | Target | Kind | Why |
| --- | --- | --- | --- |
| `@quality-source-gates` | `quality.source-gates` | qdrant | retrieve only the law needed by this operator |

Stop when required evidence is missing or stale; the result would cross the declared boundary.
