# Execute source/conversation-query

1. Validate input and freeze its artifact identities.
2. Retrieve `source.provenance` from Qdrant; do not load unrelated knowledge.
3. Return matching snapshot/artifact identities and citations from rebuildable cache; never return secret-bearing raw transcript.
4. Write only declared receipts/side effects, validate output, and return control to the skill state machine.

## LOADS

| Alias | Target | Kind | Why |
| --- | --- | --- | --- |
| `@source-provenance` | `source.provenance` | qdrant | retrieve only the law needed by this operator |

Stop when required evidence is missing or stale; the result would cross the declared boundary.
