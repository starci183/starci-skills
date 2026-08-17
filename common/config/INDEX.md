# StarCi common configuration

Read this file completely before resolving a project, opening target source, or selecting a skill.
It is the shared configuration entrypoint for Claude and Codex; root bootstrap files only route here.

## Registry invariant

The trust tree has exactly three rules registries:

| Registry | Owns |
|---|---|
| `.claude/common/` | Source/workspace routing, shared config, workflow shape and cross-role rules |
| `.claude/fe/` | Frontend construction, contract, UI and frontend lint rules |
| `.claude/be/` | Backend architecture, transport, data and backend lint rules |

`.claude/skills/`, `.claude/sources/` and `.claude/scripts/` execute or enforce registry rules; they
are not additional rules registries. Read [`registry.md`](registry.md) for ownership boundaries.

## Mandatory loading order

1. Treat the repository containing the active `AGENTS.md`, `.claude` and `.workflows` as `Source`.
   Resolve `Trust`, `Skills` and `Workflow root` from Source; never hardcode a drive or checkout.
2. Read [`workspace.md`](workspace.md). Require a user-declared `Project`, or explicit target
   repositories, before target-specific work.
3. For `start <project> <role...>`, read each requested
   `<Source>/.workspace/<project>/<role>/config.json`. Do not guess a missing route.
4. Open `repository.diskPath` directly and read every path in the role config's
   `context.instructions` from disk. Use `repository.gitRepository` only as Git identity.
5. For role `fe`, read [`frontend.md`](frontend.md), then load `context.contract` before scanning
   implementation. For `fe-legacy`, read the same config but treat it only as parity evidence. For
   role `be`, read [`backend.md`](backend.md).
6. Read only the relevant `.claude/fe/` or `.claude/be/` rule modules named by the task. Shared
   routing and lifecycle rules remain under `.claude/common/`.
7. Read `.claude/skill-shape.md` and the selected skill before invoking a capability.

User intent decides the product goal. Target instructions govern their repository. The FE contract
owns frontend composition/context; executable backend behavior owns business truth; registry rules
govern how changes are expressed. A disagreement is a finding, not permission to silently choose a
different source.

## Configuration files

| File | Purpose |
|---|---|
| [`registry.md`](registry.md) | Three-registry ownership and forbidden duplication |
| [`workspace.md`](workspace.md) | Project/role routing, local config format and privacy |
| [`frontend.md`](frontend.md) | FE and FE-legacy context/config loading |
| [`backend.md`](backend.md) | BE context/config loading |
| [`workspace.schema.json`](workspace.schema.json) | Machine-checkable role config shape |

Never place machine paths, credentials, tokens, local ports or per-checkout state in `.claude/`.
Those values belong only in Source's ignored `.workspace/` role configs.
