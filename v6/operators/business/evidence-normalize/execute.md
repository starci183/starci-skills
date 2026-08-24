# Execute business/evidence-normalize

1. Validate input and freeze its artifact identities.
2. Retrieve `business.authority-lifecycle` from Qdrant; do not load unrelated knowledge.
3. Normalize provenance without creating product truth; every claim retains its exact evidence reference.
4. Write only declared receipts/side effects, validate output, and return control to the skill state machine.

## LOADS

| Alias | Target | Kind | Why |
| --- | --- | --- | --- |
| `@business-authority-lifecycle` | `business.authority-lifecycle` | qdrant | retrieve only the law needed by this operator |

Stop when required evidence is missing or stale; the result would cross the declared boundary.
