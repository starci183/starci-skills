# Backend/frontend source layout

StarCiNext binds one product to two source repositories. The selected backend is also the StarCi host, so it owns the paired `.claude` runtime and `.workspaces` route registry, stack knowledge and the only `.starciwork`. These host directories are not default folders for every source. The frontend consumes the same feature contracts and does not copy them.

```text
starci-academy-backend/
├── .git/
├── .claude/
│   └── SKILL.md
├── .stacks/
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
├── .workspaces/
├── AGENTS.md
├── CLAUDE.md
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.json
├── apps/                  # optional monorepo application roots
├── features/              # optional backend feature modules
├── packages/              # optional shared packages
└── src/
```

```text
starci-academy-fe/
├── .git/
├── AGENTS.md
├── CLAUDE.md
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.json
├── apps/                  # optional monorepo application roots
├── packages/              # optional shared packages
├── public/
└── src/
```

`AGENTS.md` and `CLAUDE.md` in the backend must route to `.claude/SKILL.md`. Retired runtime names such as `.claude-v3`, `.claude_legacy`, `.claude-vip` and `.claude-starci-ultimate` are forbidden. The backend also forbids legacy Work roots such as `.work`, `.starci` and `.starcitemp`.

The frontend forbids `.claude`, `.stacks`, `.starciwork`, `.workspaces` and every retired runtime or Work name. This makes the backend the single source of truth for project workflow state while each repository keeps its own framework instructions.

Validate a bound pair before lifecycle work:

```text
starci source-layout <backend-root> <frontend-root>
```

The lifecycle performs the same validation whenever repository bindings contain `be` or `fe`. A valid result proves the filesystem shape and bootstrap routing. It does not prove application behavior, builds, tests, deployment readiness or feature completeness.
