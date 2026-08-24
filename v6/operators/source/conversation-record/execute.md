# Execute source/conversation-record

1. Validate input and freeze its artifact identities.
2. Retrieve `source.provenance` from Qdrant; do not load unrelated knowledge.
3. Bind project/role, revision, artifact links, snapshot hash, and redaction proof without committing raw transcript or secret.
4. Write only declared receipts/side effects, validate output, and return control to the skill state machine.

## LOADS

| Alias | Target | Kind | Why |
| --- | --- | --- | --- |
| `@source-provenance` | `source.provenance` | qdrant | retrieve only the law needed by this operator |

Stop when required evidence is missing or stale; the result would cross the declared boundary.
