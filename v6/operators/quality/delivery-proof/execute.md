# Execute quality/delivery-proof

1. Validate input and freeze its artifact identities.
2. Retrieve `quality.source-gates` from Qdrant; do not load unrelated knowledge.
3. Verify change boundary plus format, lint, typecheck, build, unit coverage, integration, E2E, and Sonar receipts all bind the same revision.
4. Write only declared receipts/side effects, validate output, and return control to the skill state machine.

## LOADS

| Alias | Target | Kind | Why |
| --- | --- | --- | --- |
| `@quality-source-gates` | `quality.source-gates` | qdrant | retrieve only the law needed by this operator |

Stop when required evidence is missing or stale; the result would cross the declared boundary.
