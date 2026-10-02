# App source layout

StarCi binds one explicit host to a selected project's **app**: one Git repository that holds the
project's back end in `be/` and its front end in `fe/`. The host owns the `.claude/CONTEXT.md`
runtime identity, the `.workspaces` project/route registry and the bootstrap files written from the
single `init/AGENTS.md` template. The binding (`.workspaces/projects/<project>/work.json`, schema
`starci/workspace-binding@2`, `modules/schemas/workspace-routing.yaml`) names the one app checkout
and its remote, the side folders (`sides: {be: be, fe: fe}`) and the Work root at the app root
(`.starciwork`). Both sides share that one Work tree and one runtime ledger. No additional
runtime, Work tree or Git repository is created inside a side or a package.

## One app tree (HFS)

Every app has the same contract. The canonical statement is
[knowledge/hfs/README.md](../knowledge/hfs/README.md); the machine form is
`knowledge/hfs/slots.yaml` (every kind of content allowed to exist, with its path, presence,
tracking, tier, required files and budget, plus the two sides and the only cross-side read);
`knowledge/patterns/repo/folder.yaml` (REPO-FOLDER-1..6) states the law and the checks report
violations as `HFS_*` codes. An app declares itself in one root `hfs.json` (shape:
`modules/schemas/hfs-repo.schema.yaml`) and carries no owner list, allowlist or local rule. npm
(one root `package.json` + `package-lock.json`, one `node_modules`, the fe workspaces' own
manifests) is the only package manager. `starci app scaffold <name>`
writes a new app; `starci app lint`, `starci app sync` and every npm script run at the app root.

The root `README.md` follows the [repository presentation checklist](repo-presentation.md):
name, one-line description, Overview, Stack, Repository layout, Development, and a Work pointer to
`.starciwork`. The HFS architecture machine checks that structure, root Markdown drafts,
package-manager drift and README links to private hosts. Run
`starci gate repo-presentation --root <app>` directly for a tree-only gate.

The app root's required, optional and forbidden entries are exactly the `app.*` slots of
`knowledge/hfs/slots.yaml` — among them the declaration (`app.declaration`), the README
(`app.readme`), the one manifest and lockfile (`app.package-manifest`, `app.lockfile`), the task
graph (`app.task-graph`), the managed tool, quality, hook and CI configuration
(`app.tool-config`, `app.format-config`, `app.quality-config`, `app.hooks`, `app.ci`,
`app.ci-images`, `app.dockerignore`), the two sides (`app.sides`) and the record and stack trees
(`app.starciwork`, `app.starcistacks`, `app.sops`).

A side holds everything a standalone back-end or front-end repository root used to hold, except
the entries the root owns: slot `repo.side-root-forbidden` forbids them inside `be/` or `fe/`, and
the app root holds no side tool configuration (`app.tool-config-local`).

Each side's tracked entries are its slots: `be.*` for the back end (the managed tool configuration
`be.tool-config`, the Nest monorepo `be.nest-cli`, the app slots `be.app.api` / `be.app.worker` /
`be.app.cli`, the feature roots — one per kind of `triggerKinds` — `be.feature`, `be.cli`,
`be.feature.webhooks`, `be.feature.realtime`, `be.feature.saga`, `be.feature.reactors`,
`be.feature.jobs`, the module capability slots `be.domain`, `be.platform`, `be.integrations` and
the pattern tiers `be.events`, `be.queues`, `be.projections`, the committed contracts
`be.contract.*`, and the test slots `be.tests.*`) and `fe.*` for the front end (`fe.tool-config`,
the app slot `fe.app.next` — an npm workspace with its own `package.json` — `fe.route`,
`fe.feature`, `fe.components`, `fe.hooks`, `fe.modules` and its required instances, and the
opt-in `fe.package.*` workspaces). A `turbo.json` under `fe/` is forbidden
(`fe.tool-config-local`): the task graph is the root's `app.task-graph`.

The only cross-side reach is the front end reading `be/contracts/` (declared in `hfs.json`
`sides.fe.reads`): the root `codegen` script generates the front end's ignored `__generated__/`
from it. A side imports nothing else of the app outside itself (`ARCH_INTERNAL_IMPORT_OUTSIDE`).

The back-end module tiers are `tiers.be` of slots.yaml: `domain` (business rules), `platform`
(technical runtime), `integrations` (provider/protocol clients) and the opt-in pattern tiers it
declares. Any other tier name is forbidden. Imports follow the one `mayImport` matrix of
`tiers.be` / `tiers.fe`; a feature never imports a feature; no cycles, `import type` included.

**Tests: unit automatic, the rest by hand.** The back end's unit specs — the roles of
`ruleParams.be.unitRoles` in slots.yaml — are the only tests an automatic gate runs; the
front end has no tests at all (R97). The back end's non-unit specs and infrastructure are the
`be.tests.*` slots: integration (`be.tests.integration`), e2e (`be.tests.e2e`) and contract
(`be.tests.contract`) specs, with the only test infrastructure in `be.tests.world` and shared data
in `be.tests.fixtures`. They never join husky, coverage or an automatic CI trigger:
`be/tsconfig.json` excludes the world and the integration, e2e and contract trees,
`be/src/tests/tsconfig.json` backs the root `typecheck:tests`, and `test:integration`, `test:e2e`
and `test:contract` run it first. `test` collects coverage from unit runs only, and a kept e2e
workflow is `workflow_dispatch` only (`knowledge/patterns/be/test.yaml` BE-TEST-1).

`.starciwork/` (slot `app.starciwork`) holds product records only, at the app root, for both
sides; its `.gitignore` is exactly `starciworkGitignoreText()` and the record shape inside is
`modules/schemas/work-layout.yaml`. `.starcistacks/` (slot `app.starcistacks`, sealed through
`app.sops`) holds the deployment declarations, one `<environment>/` per environment
(`knowledge/application-stacks.yaml` and [application stacks](application-stacks.md)).

Storage states. Each slot's `tracked` value decides: `ignored` (may exist, must be gitignored) is
the build-output and generated-code slots `app.build-output`, `repo.build-output`,
`repo.generated`; `external` (must not exist in the working tree) is the tool caches
(`app.tool-cache`, `repo.tool-cache`), the lane and workflow worktrees (`app.worktrees`,
`repo.worktrees`), agent output (`app.agent-output`, `repo.agent-output`) and plaintext secrets
(`app.plaintext-env`, `repo.plaintext-env`); each external slot's `goesTo` names where the content
lives instead. A Kernel workflow's worktree is
created and owned by Orca outside the app checkout, one per workflow, and is removed through
the host-side controller after the workflow's finish marks it `release-pending` and its terminals are released
([workflow kernel](workflow-kernel.md), the workflow worktree). Anything else moves to its
owner: infrastructure, compose, docker and env templates plus seeds and database init to
`app.starcistacks`; migrations to the owning capability's `be.persistence`; product
docs and workflow notes to `app.starciwork` records or a side's `repo.docs`; code generators to
`app.scripts` or a `repo.packages` package.

The host bootstrap files must route to `.claude/CONTEXT.md`. The runtime directory is named
`.claude`; no other runtime directory name is valid. A routed app duplicates host identity only when
it carries a `.claude/CONTEXT.md` runtime marker or a `.workspaces/projects` /
`.workspaces/local/routes` registry marker. Routed apps also forbid other Work roots such as
`.work`, `.starci` and `.starcitemp`, `fe/` holds no `.starciwork` (`HFS_WORK_IN_FE`), and neither
side holds a `.starcistacks` (`HFS_STACKS_IN_SIDE`) or `.sops.yaml`. Shared host services (SonarQube first) are
declared by the app root's `.starcistacks` as host extensions under `.claude/ext/<service>/`, never copied into
an app.

For application deployment work, load `knowledge/application-stacks.yaml` and
[application stacks](application-stacks.md). One application manifest accounts for the app's back
end, front end and dependencies. Repository placement does not establish service ownership or an
independent recovery failure domain. The application-stack check and real lifecycle evidence
assess deployment completeness separately.

## Validation

Source-layout conformance is part of `starci app lint` (its `starci app check` half), not a separate command:

```sh
starci app lint --cwd <app> --format json
```

The HFS tree law itself is reported by `starci app check` (the root slots once, each side's slots under
its folder) and the architecture machine (`scripts/hfs/architecture.mjs`, run per side) as the
`HFS_*` finding codes named in `knowledge/patterns/repo/folder.yaml` and the rule catalog in
`knowledge/hfs/README.md`; every finding path is app-relative.

The kernel lifecycle validates the bound app checkout and both side folders before workflow
effects. A valid result proves the filesystem shape and explicit ownership routing. It does not
prove application behavior, builds, tests, deployment readiness or feature completeness.

## Runtime layout

The StarCi runtime repository (this tree) follows the same standard as a product app, through the same engine. Its
standard is `knowledge/hfs/runtime-slots.yaml`, a slot manifest of kind `runtime` read by `scripts/hfs/slots.mjs`,
and the root `hfs.json` declares `{"hfs": 1, "kind": "runtime", "project": "starci"}`. The manifest has slots for the
current tree and for the target tree of the runtime HFS migration. A current path that the target moves is a forbidden
slot whose `goesTo` names its successor.

Tiers and the import direction (`tiers.runtime`):

| Tier | Paths | May import |
|---|---|---|
| entry | `packages/cli/bin/starci.mjs`, `ui/` (server and API) | every tier below |
| checks | `scripts/checks/check-<topic>.mjs` | reconciler, supervisor, kernel, domain, gates, machine, hfs, api, db, base, package |
| reconciler | `scripts/reconciler/` | supervisor, kernel, domain, gates, machine, hfs, api, db, base |
| supervisor | `scripts/supervisor/` | kernel, domain, gates, machine, hfs, api, db, base |
| kernel | `scripts/kernel/` | domain, gates, machine, hfs, api, db, base |
| domain | `scripts/{agent,route,goal,context,connectors,guards,uat,example,install,housekeeping,work}/` | domain (no owner cycle), gates, machine, hfs, api, db, base |
| gates | `scripts/gates/` | machine, hfs, api, db, base, package |
| machine | `scripts/machine/` | api, db, base |
| hfs | `scripts/hfs/` | api, base, package |
| api | `scripts/api/<system>/` | base, and only its own system's `lib.mjs` |
| db | `engine/db/` | base |
| base | the engine foundation and `scripts/lib/` | base (no cycle) |

External systems are reached only from their owner (`ruleParams.runtime.infraOwners`): `node:child_process` only in
`scripts/api/*`, `node:sqlite` only in `engine/db`, `fetch` and `node:http(s)` only in the http-speaking api systems,
and each program word (`git`, `npm`, `orca`, `powershell`, `node` for `process.execPath`, ...) only in its system's
folder. An api system is `lib.mjs` (the runner) plus one call file per call, each exporting one function named after the
file. The api systems today: `orca`, `git`, `npm`, `fs`, `process`, `sops`, `node`; `quota` leaves `scripts/api/` in
chunk C2a.

### Enforcement

`npm run check` is `starci runtime check`, which runs `scripts/checks/check-runtime.mjs`:

1. `node --check` over every `.mjs` of `engine/`, `scripts/`, `modules/` and `bin/`;
2. `scripts/hfs/runtime-check.mjs`: the tree law (`checkRepo` of `scripts/hfs/check.mjs` with the runtime
   manifest, and each slot's `allows`/`forbids`), then the runtime rules of `knowledge/hfs/rules.yaml` with gate
   `runtime`, one module each under `scripts/hfs/runtime-rules/` (`RT_EXTERNAL_OWNER`, `RT_TIER_DIRECTION`,
   `ARCH_OWNER_CYCLE`, `RT_BASE_IMPURE`, `RT_API_SHAPE`, `RT_SPEC_PLACEMENT`, `RT_SOURCE_NAME`, `RT_RETIRED_PRESENT`,
   `RT_PINNED_PATH_MOVED`, `HFS_SIZE_GROWTH`, `RT_GENERATED_DRIFT`), with `RT_CITED_PATH_MISSING` of
   `scripts/checks/check-contract-cites.mjs` over the live prose;
3. the retained self-checks listed in `ruleParams.runtime.selfChecks`, in order.

Every source file is read with the TypeScript AST (`scripts/hfs/runtime-rules/source-ast.mjs`,
`scripts/lib/spawn-calls.mjs`); no text is grepped.

The `pending` list of the manifest is the one allowlist. Each entry is `{path, rule, lane, since, reason}`: a glob, a
finding code, the chunk of the migration (C1 to C8) that deletes it, and a date. A finding an entry allows is printed at
level pending and never fails. The list only shrinks:

- `RT_PENDING_STALE`: an entry that allows no finding, or names a code no runtime rule reports;
- `RT_PENDING_ADDED`: an entry that allows a finding the base revision's list did not allow (the base is the merge-base
  of HEAD with main). A file moved through `modules/kernel/retired-paths.yaml` `moved[]` keeps its allowance.

Files move with the codemod of the migration (`<tmp>/rh-move.mjs`, outside the repository), which
runs `git mv`, rewrites relative imports and cited paths, rewrites the pending paths, and appends the `moved[]` entries.
