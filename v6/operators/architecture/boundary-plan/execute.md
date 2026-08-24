# Execute architecture/boundary-plan

1. Validate input and freeze its artifact identities.
2. Retrieve `be.boundary-planning` from Qdrant; do not load unrelated knowledge.
3. Name every path, responsibility, dependency, branch, test, gate, exclusion, alternative, and proof before writes.
4. Write only declared receipts/side effects, validate output, and return control to the skill state machine.

## LOADS

| Alias | Target | Kind | Why |
| --- | --- | --- | --- |
| `@be-boundary-planning` | `be.boundary-planning` | qdrant | retrieve only the law needed by this operator |

Stop when required evidence is missing or stale; the result would cross the declared boundary.
