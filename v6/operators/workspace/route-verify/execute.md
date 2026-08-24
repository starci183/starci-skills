# Execute workspace/route-verify

1. Validate input and freeze its artifact identities.
2. Retrieve `workspace.routing` from Qdrant; do not load unrelated knowledge.
3. Verify disk path, Git identity, revision, instructions, allowed roots, and /<role>/<project>/ Qdrant partition.
4. Write only declared receipts/side effects, validate output, and return control to the skill state machine.

## LOADS

| Alias | Target | Kind | Why |
| --- | --- | --- | --- |
| `@workspace-routing` | `workspace.routing` | qdrant | retrieve only the law needed by this operator |

Stop when required evidence is missing or stale; the result would cross the declared boundary.
