---
title: Initialization · workspaces
---

# Workspaces

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@pattern-reference-catalog` | `compilers/patterns/source-references/references.json` | file | bind shared FE/BE precedent to immutable Git truth |
| `@pattern-reference-schema` | `readiness/initialization/workspaces/pattern-references.schema.json` | file | validate portable Source-local offline reference routes |
| `@install-pattern-references` | `readiness/initialization/workspaces/install-pattern-references.mjs` | script | reuse local Git objects or install missing immutable refs under `.workspace/references` |

`.workspace/config.json` owns one Source-wide `defaultLang`. Each declared project role owns one
`.workspace/<project>/<role>/config.json` read route. Project and roles are owner-declared, never inferred
from directory names or a previous run.

`.workspace/pattern-references.json` owns portable `workspacePath` routes to the immutable FE/BE
precedent declared by `@pattern-reference-catalog`. Initialization always materializes independent
detached checkouts at `.workspace/references/<id>`. It reuses Git objects from an existing routed
checkout when available and otherwise fetches the declared immutable commit. Pattern compilers only
validate and read these offline checkouts; a missing or stale route returns `needs-init`.

`.workspace/ports/config.json` owns the same Source's slot step, while one
`.workspace/ports/<project>.json` owns each persistent family offset and application slot map. When a
declared project binds local services, initialization creates or validates its project-named allocation
record before the route is reusable. It never copies the offset into a target repository and never edits a target.

Verify checkout, repository, branch/head, manifests, and the real contract location before classifying a
route as `create`, `reuse`, or `refresh`. A missing contract is `null` only when the repository truly has
none. Record `grammar` and `grammarProfile` as an explicit pair: both `null`, or both resolving to the
exact grammar authority package and profile. Project and repository names never infer them. Route records are
machine-local descriptions: they never clone, mirror, mount, or edit a target,
and never contain credentials or environment values.

Evidence is the shared config, immutable reference catalog, portable pattern-reference routes, port
allocation, every role record, and each resolved checkout fact. Action writes or refreshes only those
local route records and may install a missing immutable reference under `.workspace/references`. Proof
parses every record and verifies every remote, commit and path again; print `installed`, `written`,
`refreshed`, or `reused` per route.
