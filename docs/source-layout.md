# Backend/frontend source layout

StarCi binds one explicit host to a selected project's backend and frontend
repositories. The host owns the `.claude/CONTEXT.md` runtime identity, the
`.workspaces` project/route registry and the bootstrap files written from the
single `init/AGENTS.md` template. The selected backend owns the project's only
`.starciwork` and `.starcistacks`; the frontend consumes the same records and
does not copy them.
A host may also be the selected backend only when the binding explicitly
resolves both roles to that same real directory.

Backend and frontend may explicitly resolve to the **same combined
repository**. That repository has one `.starciwork` owned through its backend
role; frontend source packages consume it. The host can be external or that
same explicitly bound owner repository. No additional runtime, Work tree or
Git repository is created inside an app/package. Separate FE/BE repositories
keep their existing bindings. This does not infer a backend owner for a
frontend-only project.

## One repository tree (HFS)

Every repository has the same root contract, backend and frontend alike:
`knowledge/patterns/repo/folder.yaml` (REPO-FOLDER-1..6) owns the law and the
architecture check reports violations as `HFS_*` codes. There is no mapped,
legacy or per-project alternative topology, and npm (`package.json` +
`package-lock.json`) is the only package manager - a `pnpm-lock.yaml`,
`pnpm-workspace.yaml` or `yarn.lock` is never tracked.

The root `README.md` follows the [repository presentation checklist](repo-presentation.md):
name, one-line description, Overview, Stack, Repository layout, Development, and a Work
pointer when `.starciwork` exists. The HFS architecture machine checks that structure,
root Markdown drafts, package-manager drift and README links to private hosts. Run
`node scripts/checks/repo-presentation.mjs --root <repo>` directly for a tree-only gate.

```text
<repository>/                        # one repository, backend or frontend
├── .git/
├── .gitignore, .gitattributes       # required
├── README.md                        # required; other loose *.md move to docs/ or .starciwork records
├── package.json, package-lock.json  # required; "workspaces": ["apps/*","packages/*"]
│                                    #   whenever the repository holds more than one package
├── tsconfig.json                    # required base/solution config (+ optional tsconfig.build.json)
├── eslint.config.mjs                # required
├── architecture.json                # required
├── sonar-project.properties         # required
├── codecov.yml                      # required
├── .husky/, .github/                # required
├── apps/<app>/                      # REQUIRED on both profiles, even with one app
├── packages/<pkg>/                  # optional: real separately-built packages with explicit exports
├── scripts/                         # optional: repository tooling (*.mjs + colocated specs) only
├── docs/                            # optional: human docs
├── e2e/                             # optional: repository-level Playwright *.e2e-spec.ts specs (old uat/ moves here)
└── .editorconfig, .npmrc, .dockerignore, .nvmrc   # optional
```

A **backend** repository additionally requires `src/` (the shared feature and
module source roots - see [backend source pattern](backend-source-pattern.md)),
`nest-cli.json`, `jest.config.js` (projects `unit` and `e2e`), `.starciwork/`, `.starcistacks/` and
`.sops.yaml`. A **frontend** repository additionally allows `vitest.config.ts`,
`vitest.setup.ts`, `turbo.json` and one root `playwright.config.ts`, forbids a root
`src/` (all product source lives under `apps/<app>/src`; see
`knowledge/patterns/fe/folder.yaml`), and forbids `.starciwork/` and
`.starcistacks/` and `.sops.yaml`.

```text
apps/<app>/                          # backend: composition only
└── src/
    ├── main.ts                      # process startup/shutdown only
    ├── app.module.ts                # feature/module composition only
    └── <app>.composition.spec.ts    # optional boot/composition spec

apps/<app>/                          # frontend: one workspace package
├── package.json, next.config.ts, tsconfig.json, postcss.config.mjs,
│   next-env.d.ts, vitest.config.ts  # per-app config
└── src/
    ├── app/                         # Next App Router adapters only
    ├── features/{pages,layouts,overlays}/<Name>/
    ├── components/{blocks,composites,branches,leaves}/<Name>/
    ├── hooks/<domain>/
    ├── modules/<capability>/
    └── middleware.ts | proxy.ts | instrumentation*.ts   # framework-pinned only
```

```text
<backend>/src/                       # backend shared source roots
├── features/<feature>/              # use-case orchestration + transport adapters
├── modules/
│   ├── domain/<capability>/         # business invariants and owned state
│   ├── platform/<capability>/       # config, databases, logging, health, runtime facilities
│   └── integrations/<provider>/     # external protocol clients, failure translation
└── tests/{fixtures,e2e}/            # e2e/<area>/*.e2e-spec.ts, e2e/setup/, e2e/live/ (opt-in)
```

Only the three module tiers exist - `bussiness`, `business`, `core`, `shared`,
`lib`, `ai`, `expert`, `init` and any other tier name are forbidden; old tiers
map by responsibility (business rules to `domain`, technical runtime to
`platform`, provider/protocol clients to `integrations`).

```text
<backend>/.starciwork/               # product records only, backend repository only
├── .gitignore                       # exactly starciworkGitignoreText()
├── workspace.yaml
├── features/
│   ├── index.yaml                   # product catalog
│   └── <feature>/
│       ├── index.yaml
│       └── <family>/<name>/index.yaml   # flat families: br, ac, fr, nfr, data,
└── ...                              #   journey, decision, sds, ui, impl, uat,
                                     #   contract, integration, gap, event
                                     #   (modules/schemas/work-layout.yaml)
```

```text
<backend>/.starcistacks/             # deployment declarations, backend repository only
├── application-stacks.yaml
└── <environment>/                   # dev/, vps/, ...
    ├── infra/ ├── runtime/ ├── secrets/ ├── seeds/   # only these
    └── environment.json             # where the schema asks for it
```

Never tracked anywhere (`.gitignore` covers them): `node_modules/`, `dist/`,
`.next/`, `coverage/`, `.scannerwork/`, `test-results/`, `.turbo/`, `.tools/`,
`*.tsbuildinfo` and agent output (`report*.json`, `*.tmp.json`, `%*%` names,
`nul`, `.qwen*/`, `.artifacts/`, `.tmp-*`, `*-lint.json`, `lf.json`, `lt.json`).
Anything else at the root moves to its owner: infrastructure, compose, docker
and env templates plus seeds/db init move to `.starcistacks/<environment>/`;
migrations and schemas move to the owning `src/modules/platform/<db>` or
`src/modules/domain/<capability>`; product docs and workflow notes move to
`.starciwork` records or `docs/`; code generators move to `scripts/` or a real
`packages/<pkg>`.

The host bootstrap files must route to `.claude/CONTEXT.md`. Historical runtime
names such as `.claude-v3`, `.claude_legacy`, `.claude-vip` and
`.claude-starci-ultimate` are forbidden. A routed source duplicates host
identity only when it carries a `.claude/CONTEXT.md` runtime marker or a
`.workspaces/projects` / `.workspaces/local/routes` registry marker. Routed
backends also forbid historical Work roots such as `.work`, `.starci` and
`.starcitemp`.

In a separate frontend repository, `.starciwork`, `.starcistacks` and every
historical runtime or Work name are forbidden, and the same runtime/registry
identity markers are rejected. In an explicitly combined repository, the one
backend-owned `.starciwork`/`.starcistacks` and the explicitly bound host
identity are shared, not duplicated. A repository-local `.claude` or
`.workspaces` directory containing other project metadata is not a second
runtime or registry merely by name. Shared host services (SonarQube first) are
declared by the backend's `.starcistacks` as host extensions under
`.claude/ext/<service>/`, never copied into a project repository.

For application deployment work, load `knowledge/application-stacks.yaml` and
[application stacks](application-stacks.md). One application manifest accounts
for its backend, frontend and dependencies even when their source repositories
differ. Repository placement does not establish service ownership or an
independent recovery failure domain. The application-stack check and real
lifecycle evidence assess deployment completeness separately.

## Validation

Source-layout conformance is a machine obligation of the aggregate scoped-lint
gate (a `repository-audit` kind in the profile), not a separate command:

```sh
node scripts/checks/check-scoped-lint.mjs --profile <nest|next> --root <repo-root> --all
```

The HFS root/tree law itself is reported by the architecture machine
(`scripts/checks/architecture.mjs`, run by `canon-scan.mjs`) as the `HFS_*`
finding codes named in `knowledge/patterns/repo/folder.yaml`.

The kernel lifecycle performs the same validation whenever repository bindings
contain `be` or `fe`. A valid result proves the filesystem shape and explicit
ownership routing. It does not prove application behavior, builds, tests,
deployment readiness or feature completeness.
