# Backend/frontend source layout

StarCi binds one explicit host to a selected project's backend and frontend
repositories. The host owns the `.claude/SKILL.md` runtime identity, the
`.workspaces` project/route registry and the bootstrap files written from the
single `init/AGENTS.md` template. The selected backend owns the project's only
`.starciwork`; the frontend consumes the same records and does not copy them.
A host may also be the selected backend only when the binding explicitly
resolves both roles to that same real directory.

Backend and frontend may explicitly resolve to the **same combined
repository**. That repository has one `.starciwork` owned through its backend
role; frontend source packages consume it. The host can be external or that
same explicitly bound owner repository. No additional runtime, Work tree or
Git repository is created inside an app/package. Separate FE/BE repositories
keep their existing bindings. This does not infer a backend owner for a
frontend-only project.

The trees below are examples, not a package-manager prescription.
`pnpm-workspace.yaml` is optional; npm workspaces use `package.json`, and a
single app needs neither workspace form. Source can live in `src`, `apps`,
`packages`, or another declared supported source root; a monorepo need not
invent a root `src` or `tsconfig.json`. The architecture checker validates
actual per-project TypeScript configs and source coverage separately
([architecture check](architecture-check.md)).

```text
starci-host/
├── .git/
├── .claude/
│   └── SKILL.md
├── .workspaces/
│   └── projects/
└── AGENTS.md            # managed starci:prompt-entry block (same template
                         # also written to CLAUDE.md / DEVIN.md when present)
```

```text
selected-backend/
├── .git/
├── .starciwork/
│   ├── runtime.sqlite       # the ledger (untracked — see installation.md)
│   ├── workspace.yaml
│   └── features/
│       ├── index.yaml
│       └── <feature>/
│           ├── index.yaml
│           ├── business/
│           ├── architecture/
│           ├── ui/
│           ├── implementation/
│           │   ├── backend/
│           │   └── frontend/
│           └── uat/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.json
├── apps/                  # optional monorepo application roots
├── features/              # optional backend feature modules
├── packages/              # optional shared packages
└── src/
```

```text
selected-frontend/
├── .git/
├── package.json
├── pnpm-workspace.yaml
├── apps/                  # optional monorepo application roots
├── packages/              # optional shared packages
└── src/
```

The host bootstrap files must route to `.claude/SKILL.md`. Retired runtime
names such as `.claude-v3`, `.claude_legacy`, `.claude-vip` and
`.claude-starci-ultimate` are forbidden. A routed source duplicates host
identity only when it carries a `.claude/SKILL.md` runtime marker or a
`.workspaces/projects` / `.workspaces/local/routes` registry marker. Routed
backends also forbid legacy Work roots such as `.work`, `.starci` and
`.starcitemp`.

In a separate frontend repository, `.starciwork` and every retired runtime or
Work name are forbidden, and the same runtime/registry identity markers are
rejected. In an explicitly combined repository, the one backend-owned
`.starciwork` and explicitly bound host identity are shared, not duplicates.
A repository-local `.claude` or `.workspaces` directory containing other
project metadata is not a second runtime or registry merely by name.
Likewise, `.starcistacks` may be legitimate deployment/project knowledge in
the backend, frontend or host; the topology gate does not move, delete or
assign runtime authority to it. This leaves one runtime identity and one
product workspace while preserving separately owned project metadata.

For application deployment work, load `knowledge/application-stacks.json` and
[application stacks](application-stacks.md). One application manifest accounts
for its backend, frontend and dependencies even when their source repositories
differ. Repository placement does not establish service ownership or an
independent recovery failure domain. The topology gate preserves existing
`.starcistacks`; the application-stack check and real lifecycle evidence assess
deployment completeness separately.

## Validation

Source-layout conformance is a machine obligation of the aggregate scoped-lint
gate (a `repository-audit` kind in the profile), not a separate command:

```sh
node scripts/checks/check-scoped-lint.mjs --profile <nest|next> --root <repo-root> --all
```

The kernel lifecycle performs the same validation whenever repository bindings
contain `be` or `fe`. A valid result proves the filesystem shape and explicit
ownership routing. It does not prove application behavior, builds, tests,
deployment readiness or feature completeness.
