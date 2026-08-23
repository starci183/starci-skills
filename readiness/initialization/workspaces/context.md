# Workspaces

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@pattern-reference-catalog` | `compilers/patterns/source-references/references.json` | file | bind shared FE/BE precedent to immutable Git truth |
| `@pattern-reference-schema` | `readiness/initialization/workspaces/pattern-references.schema.json` | file | validate portable Source-local offline reference routes |
| `@install-pattern-references` | `readiness/initialization/workspaces/install-pattern-references.mjs` | script | reuse local Git objects or install missing immutable refs under `.workspace/references` |

`.workspace/config.json` owns Source-wide language, project/role files own product read routes, and
`.workspace/pattern-references.json` owns portable `workspacePath` routes to immutable FE/BE precedent.

During `starci-init`, run `@install-pattern-references --source <Source> --plan`, report reuse,
`install-local` or `install-git` for every catalog entry, then run `--apply`. If a routed checkout already
contains the immutable commit, initialize an independent offline checkout from its local Git objects.
Otherwise fetch from the catalog URL. Both land at `.workspace/references/<id>` and checkout the exact
commit detached. No absolute path enters the registry or trust tree.

Proof validates the local registry against `@pattern-reference-schema`, then uses the pattern reference
resolver to verify remote identity and immutable commit. A missing or stale reference is `needs-init` and
stops pattern compilation before target-specific reads.
