# Alias

Every location an operator may read, by alias, grouped by zone. Generated from `alias/alias.json` (the machine registry) and every `operator.json` by `scripts/generate-alias-doc.mjs`; `--check` runs inside `npm test`. An operator reads only the aliases its own `context.md` Refs table names; this page is the whole vocabulary those tables draw from. Resolution takes the longest registered prefix, a sub-path narrows an alias, and a segment in angle brackets is supplied by the invocation.

## Workspaces — the working area

The working area: routed checkouts of the bound project and the declarations, routes, ports, and identity that locate them.

| Alias | Params | Resolves to | Bind | Writers | Bound by | Purpose |
| --- | --- | --- | --- | --- | --- | --- |
| `@workspaces` | `<project>`, `<role>` | `<checkout:project/role>  (any routed checkout named explicitly, for cross-project reads: @workspaces/nivo/fe)` | fingerprint + sourceHead (git rev-parse HEAD of the checkout) | — | `git.publish`, `quality.verify` | A checkout of another project. The bound project's own are @workspaces/fe and @workspaces/be. |
| `@workspaces/be` | — | `<checkout:input.project.id/be>  (diskPath from <Source>/.workspaces/local/routes/<project>/be/config.json); friendly segments: /husky, /package, /gates (see segments)` | fingerprint + sourceHead (git rev-parse HEAD of the checkout) | `backend.implement` | `backend.implement`, `business.decide`, `quality.verify`, `uat.verify` | The routed backend checkout of the bound project. |
| `@workspaces/device-state` | — | `<Source>/.workspaces/device-state.json  (sealed keys live in <Source>/.workspaces/local/credentials/*.key.enc and are bound by name, never read)` | fingerprint | — | `platform.operate`, `release.deploy`, `workspace.bind` | Machine identity and the encrypted credential roster reference. |
| `@workspaces/fe` | — | `<checkout:input.project.id/fe>  (diskPath from <Source>/.workspaces/local/routes/<project>/fe/config.json); friendly segments: /husky, /package, /gates, /grammar (see segments)` | fingerprint + sourceHead (git rev-parse HEAD of the checkout) | `fe.source.apply` | `fe.direction.decide`, `fe.presentation.resolve`, `fe.source.apply`, `fe.surface.audit`, `quality.verify` | The routed frontend checkout of the bound project. |
| `@workspaces/local/routes` | — | `<Source>/.workspaces/local/routes/<project>/<role>/config.json` | fingerprint | `workspace.bind` | `git.publish`, `workspace.bind` | Machine-local hydrated routes; project the declarations onto this disk. Ignored by Git. |
| `@workspaces/ports` | — | `<Source>/.workspaces/ports/<project>.json` | fingerprint | — | `platform.operate`, `workspace.bind (optional)` | Port projection: project offset and application slots. Endpoints are derived, never typed. |
| `@workspaces/projects` | — | `<Source>/.workspaces/projects/<project>/<role>.json` | fingerprint | — | `platform.operate (optional)`, `workspace.bind` | Portable route declarations, tracked. The only place a route is declared. |

## Grammar — the package

The @starci/grammar package as the bound app resolves it: the only fact about what a component owns.

| Alias | Params | Resolves to | Bind | Writers | Bound by | Purpose |
| --- | --- | --- | --- | --- | --- | --- |
| `@grammar` | `<family>` | `the @starci/grammar package as the bound app resolves it (file:packages/grammar inside @workspaces/fe today, source 0.4.0; @remote/npm publishes 0.3.0), narrowed to one family <family>: @grammar/core, @grammar/heritage, @grammar/offset-pop; @grammar/common is the shared layer every family imports` | package.json version + the resolved location's fingerprint (checkout head for file:, tarball integrity for npm) | — | `fe.direction.decide`, `fe.presentation.resolve` | The Grammar as it runs: Common renderers, props, owned relationships, data-contract claims, and the family's own CSS. The only fact about what a component owns. |

## Knowledge — the law

Canonical law in this tree: universal UI law (ui), the family's taste (grammars), code conventions (patterns). Read only; edited by the owner.

| Alias | Params | Resolves to | Bind | Writers | Bound by | Purpose |
| --- | --- | --- | --- | --- | --- | --- |
| `@knowledge/grammars` | — | `<Source>/.claude/knowledge/grammars/<family>/  (DNA.md generated from the package; idioms.md and playbook.md are the owner's taste; family.md holds the visual DNA and the gap table)` | fingerprint per file; DNA.md additionally binds the package version and checkout head it was generated from | — | `fe.direction.decide (optional)`, `fe.surface.audit (optional)` | How the family composes: the owner's taste (idioms, playbook) and what exists (DNA). Never the Grammar itself; where a taste row disagrees with @grammar, @grammar is the fact and the row is the finding. |
| `@knowledge/patterns` | — | `<Source>/.claude/knowledge/patterns/  (fe/, be/)` | fingerprint per file; rule inventory = every `## PREFIX-n` heading in the folder | — | `backend.implement` | Code conventions counted from the two live sources; a rule cites two real paths. |
| `@knowledge/ui` | — | `<Source>/.claude/knowledge/ui/  (composition/, presentation/, proof/; a sub-path narrows: @knowledge/ui/presentation)` | fingerprint per file; rule inventory = every `## PREFIX-n` heading in the folder | — | `fe.direction.decide`, `fe.presentation.resolve`, `fe.surface.audit` | Universal UI law: what a tree must contain, which value an app boundary takes, what is only true once rendered. |

## Worktrees — local authority and evidence

Machine-local authority and evidence outside any checkout: business heads, UAT pairs, debts, templates, the shared runtime owner.

| Alias | Params | Resolves to | Bind | Writers | Bound by | Purpose |
| --- | --- | --- | --- | --- | --- | --- |
| `@worktrees/_templates` | — | `<Source>/.worktrees/_templates/  (businesses/, debts/, sessions/, uat/)` | fingerprint per file | — | `uat.verify` | Authority templates for new heads, debts, sessions, and UAT pairs. Consumed, never modified. |
| `@worktrees/businesses` | — | `<Source>/.worktrees/businesses/  (features/<featureId>/model.json; business-registry-v1.json is the head index; objects/sha256/ the content store)` | content address from business-registry-v1.json featureHeads.&lt;featureId&gt;.head, with authorityStatus | `business.decide` | `backend.implement`, `business.decide` | Business promise heads. Its own git worktree; a head binds by content address even before its commit lands. |
| `@worktrees/debts` | — | `<Source>/.worktrees/debts/  (be.md, fe.md, per-item files)` | fingerprint per file | — | `quality.verify (optional)` | Owner-approved quality debts. A debt without a live approval here is not a debt. |
| `@worktrees/sessions` | — | `<Source>/.worktrees/sessions/<sessionId>/  (session.json, leases/, steps/<n>.<operator.id>/ — see @dynamic; central-runtime/ is the shared runtime owner and is not a session)` | fingerprint per file read | `*` | — | The session container. Operators do not read it directly; they read @dynamic. |
| `@worktrees/sessions/central-runtime` | — | `<Source>/.worktrees/sessions/central-runtime/owner.json  (generation-<n>-ready.json and logs/ beside it)` | fingerprint + generation | `platform.operate` | `content.generate`, `fe.surface.audit`, `platform.operate`, `uat.verify`, `workspace.bind (optional)` | The shared runtime owner: generation, status, endpoints, health evidence. Callers consume, never own. |
| `@worktrees/uat` | — | `<Source>/.worktrees/uat/<flow>/<case>/  (snapshot.json, result.json)` | fingerprint of snapshot.json and result.json | `uat.verify` | `fe.direction.decide (optional)`, `uat.verify` | Canonical UAT pair per flow and case. Never carries a credential. |

## Remote — the internet

Internet. Registries, git remotes, image registries, CI runs, object storage. Read through a network; bound by version, digest, or observed head.

| Alias | Params | Resolves to | Bind | Writers | Bound by | Purpose |
| --- | --- | --- | --- | --- | --- | --- |
| `@remote/ghcr` | `<image>` | `ghcr.io/<image>@<digest>` | digest | `release.deploy` | `release.deploy` | Immutable release images. A tag is never a binding; a digest is. |
| `@remote/git` | `<project>`, `<role>` | `the origin URL in @workspaces/local/routes/<project>/<role> (repository.gitRepository)` | observed remote head (git ls-remote) at invocation time | `git.publish` | `git.publish` | The publication target; fast-forwardness is decided against this observation. |
| `@remote/github-actions` | `<runId>` | `GitHub Actions run <runId> of the routed repository` | run id + conclusion | — | `release.deploy (optional)` | CI evidence of a build or rollout, read only. |
| `@remote/minio` | `<contentId>`, `<locale>` | `MinIO object contents/<contentId>/<locale>.json through the routed runtime` | fingerprint of the fetched object | `content.generate` | `content.generate` | Authored lesson content as served, not as drafted. |
| `@remote/npm` | `<package>` | `the npm registry entry for <package>, e.g. @remote/npm/@starci/grammar@0.3.0` | version + tarball integrity | — | — | Published packages. A version is the binding; latest never is. |

## Dynamic — produced inside the session

Produced inside the current session by an earlier step and deleted with the session. Never exists before the run.

| Alias | Params | Resolves to | Bind | Writers | Bound by | Purpose |
| --- | --- | --- | --- | --- | --- | --- |
| `@dynamic` | `<kind>` | `<Source>/.worktrees/sessions/<sessionId>/step-<N>/parallel-<M>/ — one branch of one step. request/request.json is the gate in (orchestrator writes it); response/ is the agent's: response.json (gate out), response.md and other markdown kinds, data/<name>.json, artifacts/<file>; a nested exchange adds <exchange>/request/ and <exchange>/response/. A kind is passed by explicit path in request.json inputs, from the session root. Operator.md packages pass dynamic files as kinds (templates/kinds/<kind>), not as aliases; the old shape still names @dynamic/<file> until each package migrates. The session folder is created by the orchestrator and deleted when git.publish finishes; a blocked run keeps it for resume` | kind contract or schema under templates/kinds; response.json fields is the registry of what a branch produced | `*` | `backend.implement`, `backend.implement`, `backend.implement`, `business.decide (optional)`, `business.decide`, `content.generate`, `fe.direction.decide`, `fe.direction.decide (optional)`, `fe.direction.decide (optional)`, `fe.direction.decide`, `fe.presentation.resolve (optional)`, `fe.presentation.resolve (optional)`, `fe.presentation.resolve`, `fe.source.apply`, `fe.source.apply (optional)`, `fe.source.apply`, `fe.source.apply`, `fe.surface.audit`, `fe.surface.audit`, `fe.surface.audit`, `git.publish`, `git.publish`, `git.publish`, `platform.operate`, `quality.verify`, `quality.verify`, `quality.verify`, `release.deploy`, `release.deploy`, `uat.verify`, `workspace.bind` | Everything produced inside the session and nothing that existed before it. Always dynamic; typed by kind. |

## Friendly segments inside a checkout

Human-friendly segments inside any checkout alias (@workspaces/fe, @workspaces/be, @workspaces/<project>/<role>), mapped to the exact path. Write the friendly word; the resolver substitutes the path.

| Segment | Resolves to |
| --- | --- |
| `husky` | `.husky/  (pre-commit, pre-push)` |
| `package` | `package.json  (scripts, dependencies, the package version)` |
| `gates` | `package.json#scripts plus the configs it names (eslint.config.*, tsconfig*.json, jest.config.*/vitest.config.*, sonar-project.properties)` |
| `grammar` | `packages/grammar  (the @starci/grammar source inside @workspaces/fe)` |

