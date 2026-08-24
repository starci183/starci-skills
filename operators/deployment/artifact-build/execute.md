# Execute deployment/artifact-build

1. Validate input and freeze its artifact identities.
2. Retrieve `deployment.lifecycle` from Qdrant; do not load unrelated knowledge.
3. Run declared verification/build inputs and record immutable tag/digest candidates without publication.
4. Write only declared receipts/side effects, validate output, and return control to the skill state machine.

## LOADS

| Alias | Target | Kind | Why |
| --- | --- | --- | --- |
| `@deployment-lifecycle` | `deployment.lifecycle` | qdrant | retrieve only the law needed by this operator |

Stop when required evidence is missing or stale; the result would cross the declared boundary.
