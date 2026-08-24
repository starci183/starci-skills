# Execute workspace/routes-hydrate

1. Validate input and freeze its artifact identities.
2. Retrieve `workspace.initialization` from Qdrant; do not load unrelated knowledge.
3. Resolve exact disk/Git paths and current heads without changing the portable declaration.
4. Write only declared receipts/side effects, validate output, and return control to the skill state machine.

## LOADS

| Alias | Target | Kind | Why |
| --- | --- | --- | --- |
| `@workspace-initialization` | `workspace.initialization` | qdrant | retrieve only the law needed by this operator |

Stop when required evidence is missing or stale; the result would cross the declared boundary.
