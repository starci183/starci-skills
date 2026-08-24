# Execute be/implementation

1. Validate input and freeze its artifact identities.
2. Retrieve `be.boundary-planning` from Qdrant; do not load unrelated knowledge.
3. Reverify identity and baseline, mirror bound owners, mutate approved paths, and record every before/after hash.
4. Write only declared receipts/side effects, validate output, and return control to the skill state machine.

## LOADS

| Alias | Target | Kind | Why |
| --- | --- | --- | --- |
| `@be-boundary-planning` | `be.boundary-planning` | qdrant | retrieve only the law needed by this operator |
| `@source-context` | `/<role>/<project>/` | source-qdrant | locate candidates, then open exact checkout files |

Stop when required evidence is missing or stale; the result would cross the declared boundary.
