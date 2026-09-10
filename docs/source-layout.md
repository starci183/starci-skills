# Backend/frontend source layout

StarCi binds one explicit host to a selected project's backend and frontend repositories. The host owns the `.claude/SKILL.md` runtime identity, `.workspaces` project/route registry and bootstrap files. The selected backend owns the project's only `.starciwork`; the frontend consumes the same feature contracts and does not copy them. A host may also be the selected backend only when the binding explicitly resolves both roles to that same real directory.

```text
starci-host/
├── .git/
├── .claude/
│   └── SKILL.md
├── .workspaces/
│   └── projects/
├── AGENTS.md
└── CLAUDE.md
```

```text
selected-backend/
├── .git/
├── .starciwork/
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

`AGENTS.md` and `CLAUDE.md` in the host must route to `.claude/SKILL.md`. Retired runtime names such as `.claude-v3`, `.claude_legacy`, `.claude-vip` and `.claude-starci-ultimate` are forbidden. A routed source duplicates host identity only when it carries a `.claude/SKILL.md` runtime marker or a `.workspaces/projects` / `.workspaces/local/routes` registry marker. Routed backends also forbid legacy Work roots such as `.work`, `.starci` and `.starcitemp`.

The frontend forbids `.starciwork` and every retired runtime or Work name, and it rejects the same runtime/registry identity markers. A repository-local `.claude` or `.workspaces` directory that contains other project metadata is not a second runtime or registry merely by name. Likewise, `.stacks` may be legitimate deployment/project knowledge in the backend, frontend or host; the topology gate does not move, delete or assign runtime authority to it. This leaves one runtime identity and one backend-owned product workspace while preserving separately owned project metadata.

Validate a bound pair before lifecycle work:

```text
starci source-layout <backend-root> <frontend-root>
```

The CLI resolves the host from the runtime containing the command. The lifecycle resolves it from the exact `projectSkillPath` and performs the same validation whenever repository bindings contain `be` or `fe`. A valid result proves the filesystem shape and explicit ownership routing. It does not prove application behavior, builds, tests, deployment readiness or feature completeness.
