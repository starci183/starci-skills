# Execute platform/mcp-config

1. Validate input and freeze its artifact identities.
2. Retrieve `platform.operations` from Qdrant; do not load unrelated knowledge.
3. Bind selected roles, collection, embedding model, dimensions, read-only policy, and public endpoint without credential values.
4. Write only declared receipts/side effects, validate output, and return control to the skill state machine.

## LOADS

| Alias | Target | Kind | Why |
| --- | --- | --- | --- |
| `@platform-operations` | `platform.operations` | qdrant | retrieve only the law needed by this operator |

Stop when required evidence is missing or stale; the result would cross the declared boundary.
