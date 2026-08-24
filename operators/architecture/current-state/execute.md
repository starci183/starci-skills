# Execute architecture/current-state

1. Validate input and freeze its artifact identities.
2. Retrieve `architecture.decision-analysis` from Qdrant; do not load unrelated knowledge.
3. Query routed source partitions, open exact files, and bind every current-state claim to live evidence.
4. Write only declared receipts/side effects, validate output, and return control to the skill state machine.

## LOADS

| Alias | Target | Kind | Why |
| --- | --- | --- | --- |
| `@architecture-decision-analysis` | `architecture.decision-analysis` | qdrant | retrieve only the law needed by this operator |
| `@source-context` | `/<role>/<project>/` | source-qdrant | locate candidates, then open exact checkout files |

Stop when required evidence is missing or stale; the result would cross the declared boundary.
