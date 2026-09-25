# Next data lifecycle key check

`node scripts/checks/architecture.mjs <repository>` reports two independent static rules for a project
that selects SWR:

- `FE_SWR_KEY_IDENTITY` requires every declared result identity on every active
  query or mutation key path. An identity marked `gatesRequest` must lead to an
  explicit `null` key when unavailable.
- `FE_SWR_MUTATION_RESOURCE_IDENTITY` requires every declared mutation resource
  identity on every active mutation key path.

The declaration lives at
`package.json#starci.codePatterns.next.dataLifecycle`. It binds the installed
`swr` major version and names each lifecycle call by source path, exported hook,
query/mutation kind, identities, and an optional local result binding. Hooks
with several SWR calls declare one row per call and select each with a stable
identifier from its assigned or destructured result. A one-call hook may omit
the selector. A fixed query may declare no identities and use `null` as a
deliberately disabled key.

```json
{
  "schema": "starci/next-data-lifecycle@1",
  "swr": { "package": "swr", "major": 2 },
  "hooks": [
    {
      "id": "course-query",
      "path": "src/features/course/use-course.ts",
      "export": "useCourse",
      "kind": "query",
      "resultBinding": "query",
      "identities": [
        { "id": "course", "binding": "params.courseId", "gatesRequest": true, "resource": true },
        { "id": "viewer", "binding": "viewer", "gatesRequest": false, "resource": false }
      ]
    }
  ]
}
```

The checker resolves actual imports and re-exports from `swr`, `swr/immutable`
and `swr/mutation` with the target TypeScript program. It supports direct static
string, template, array and object keys, immutable constant aliases, and a
single-return key function. It checks the value contributed by each identity
on every active conditional path; a condition that merely reads an identity
does not put that identity in the key. Mutable or escaped array/object key
containers, source declarations below links or junctions, missing declarations,
unmatched calls, ambiguous selectors, installed-version drift, dynamic calls,
CommonJS/dynamic-import SWR bindings, spreads/computed keys, and global `mutate`
calls without a declared resource-matching contract make coverage unavailable.
The rule IDs are then absent from
`coverage.checkedRuleIds`; an empty violation list is not a pass.
When no production source selects SWR and no lifecycle is declared, the
architecture report records `not-applicable` with the examined rule IDs. The
aggregate accepts this explicit absence and rejects missing or unavailable
lifecycle coverage even if a result lists the rule IDs.

SWR documents `null`/falsy conditional keys in
[Conditional Fetching](https://swr.vercel.app/docs/conditional-fetching), and
documents that SWR 2 passes an array key as one argument and serializes object
keys in [Arguments](https://swr.vercel.app/docs/arguments). Its
[Mutation](https://swr.vercel.app/docs/mutation) documentation binds bound
mutation to the hook key and describes global mutation/filter behavior. These
library mechanics do not establish the product's complete identity set.

## Static limit

The declaration is evidence about selected source bindings, not evidence that
the chosen identities are the correct domain identities. Behavior tests still
exercise identity changes, stale-result boundaries, mutation/revalidation and
error propagation. The checker does not infer a lifecycle from a file name,
force a callback key, require a companion file, execute requests, or certify a
global mutation filter.
