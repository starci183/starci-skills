# Workspaces

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@pattern-reference-catalog` | `compilers/patterns/source-references/references.json` | file | bind shared FE/BE precedent to immutable Git truth |
| `@pattern-reference-schema` | `readiness/initialization/workspaces/pattern-references.schema.json` | file | validate generated offline reference routes |
| `@install-pattern-references` | `readiness/initialization/workspaces/install-pattern-references.mjs` | script | install immutable refs under `.workspaces/local/references` |
| `@portable-route-schema` | `readiness/initialization/workspaces/portable-route.schema.json` | file | refuse absolute paths, observed heads and secret-bearing portable declarations |
| `@workspace-portable` | `scripts/workspace-portable.mjs` | script | export pushable declarations and hydrate verified local routes deterministically |

`.workspaces/config.json`, `.workspaces/projects/<project>/<role>.json` and `.workspaces/ports/*.json` are
pushable declarations. A role declaration owns its credential-free GitHub URL, expected branch, repository-relative
directory and context paths, plus explicit grammar/profile. It never contains an absolute path, observed head,
timestamp, credential or generated state.

`@workspace-portable hydrate` verifies each declared checkout and generates the machine-local read route at
`.workspaces/local/routes/<project>/<role>/config.json`. That route owns absolute paths, the observed Git head and
verification time. Missing checkouts stop hydration; cloning is a separate explicitly authorized materialization.

`.workspaces/local/pattern-references.json` and `.workspaces/local/references/<id>` are generated offline access to
immutable FE/BE precedent. Initialization reuses local Git objects when possible and otherwise fetches only the
catalog-pinned commit. Pattern compilers validate and read these detached checkouts.

Portable port declarations retain the Source slot step, project offsets and application slots. Initialization
never copies allocation ownership into a product repository.

Evidence is the tracked declarations, immutable reference catalog and each resolved checkout fact. Action hydrates
only `.workspaces/local` and may install a missing immutable reference there. Proof rejects any portable absolute
path or secret-bearing value, then verifies every generated remote, branch, head and path.
