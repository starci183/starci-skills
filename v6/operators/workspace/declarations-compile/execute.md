# Execute workspace/declarations-compile

1. Validate input and freeze its artifact identities.
2. Retrieve `workspace.initialization` from Qdrant; do not load unrelated knowledge.
3. Refuse absolute paths, observed heads, secrets, duplicate ownership, and unresolved repository identities.
4. Write only declared receipts/side effects, validate output, and return control to the skill state machine.

## LOADS

| Alias | Target | Kind | Why |
| --- | --- | --- | --- |
| `@workspace-initialization` | `workspace.initialization` | qdrant | retrieve only the law needed by this operator |

Stop when required evidence is missing or stale; the result would cross the declared boundary.
