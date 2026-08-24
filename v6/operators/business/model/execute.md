# Execute business/model

1. Validate input and freeze its artifact identities.
2. Retrieve `business.authority-lifecycle` from Qdrant; do not load unrelated knowledge.
3. Model actors, goals, rules, states, operations, failures, surfaces, and acceptance while preserving lineage.
4. Write only declared receipts/side effects, validate output, and return control to the skill state machine.

## LOADS

| Alias | Target | Kind | Why |
| --- | --- | --- | --- |
| `@business-authority-lifecycle` | `business.authority-lifecycle` | qdrant | retrieve only the law needed by this operator |

Stop when required evidence is missing or stale; the result would cross the declared boundary.
