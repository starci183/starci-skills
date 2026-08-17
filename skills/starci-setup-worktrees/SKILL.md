---
name: starci-setup-worktrees
description: Install, migrate, repair, or verify project-scoped StarCi design worktrees under a Source repository. Use when a declared project needs its durable FE design registry linked worktree plus local sessions/cache, or when legacy `.worktrees/registries` state must move behind the required project segment. Never stores runtime state under `.claude`.
---

# StarCi Setup Worktrees

Read [`../../skill-shape.md`](../../skill-shape.md) first. This is one continuous skill with internal
Plan → Review → Apply. It owns `.worktrees` only; use `$starci-setup-workspace` for `.workspace` routes.

## CONTEXT

Print the canonical `### CONTEXT` table. Require a user-declared `Project`; never infer it from
Source, App or a checkout folder. Resolve Source as the repository containing `AGENTS.md`, `.claude`
and `.workflows`.

`Touching` is limited to the workflow and this exact project root:

```text
<Source>/.worktrees/<project>/
├── registries/  # locked linked Git worktree, durable branch
├── sessions/    # ignored local progress
└── cache/       # ignored rebuildable index/preview/memory packs
```

The `<project>` segment is mandatory. Reject `<Source>/.worktrees/registries`, any
`<Source>/.claude/worktrees/<project>` state, inferred identity, unignored local paths, or a registry
worktree owned by another Git common directory.

## PROCESS

### Plan

Inspect Source Git identity, current worktree list, ignore proof, existing project root, registry
branch and legacy root. Default the registry branch to
`codex/fe-design-registry/<project>`. Installation never clones, edits target repositories or pushes.

### Review

Freeze Source, Project, project root, registry path/branch and whether this is `create`, `reuse` or
`migrate-legacy`. A direct user instruction naming Source context and Project authorizes this bounded
local setup. Stop only for a collision, wrong Git owner, dirty legacy registry, branch mismatch or
write outside the exact root.

### Apply

Install or reuse:

```powershell
node <trust-root>/skills/starci-setup-worktrees/scripts/setup-worktrees.mjs `
  --source <Source> `
  --project <Project>
```

Move a verified legacy `<Source>/.worktrees/registries` mount behind `<project>`:

```powershell
node <trust-root>/skills/starci-setup-worktrees/scripts/setup-worktrees.mjs `
  --source <Source> `
  --project <Project> `
  --migrate-legacy
```

Then run read-only verification:

```powershell
node <trust-root>/skills/starci-setup-worktrees/scripts/setup-worktrees.mjs `
  --source <Source> `
  --project <Project> `
  --check
```

Require the registry worktree to be locked, clean, on the project branch and owned by Source's Git
common directory. Require `sessions` and `cache` below the same project root and ignored by Source.

## OUTPUT

Use exact headings `### OUTPUTS`, `### CHANGES`, `### NEED APPROVALS`, `### WARNINGS`, `### REJECTED`
and `### OWED` in order. Report Source, Project, exact three paths, registry branch/HEAD/lock and
whether the branch is only local. Never report `.claude` as a runtime storage root.
