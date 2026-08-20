---
name: starci-init
description: "Make a Source ready through four identity-first boundaries: machine decrypt identity, agent bootstrap, workspace read routes, and project worktree state. Use for a new Source, machine, project or role, or when one of those records moved or went stale. Never edits a target repository."
---

# starci-init

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/context.md` | context | the shared reporting contract every skill reads |
| `@initialization` | `readiness/initialization/context.md` | context | the identity-first boundaries and the owner of each init verdict |

## NESTED SKILLS

None. This skill never invokes another skill.

## Run

Read `@skill-shape`, then `@initialization`. From it, load the four runtime context modules in registry order:
`identity`, `bootstrap`, `workspaces`, `worktrees`. Never load the Vietnamese publication records while
running.

Project and roles are user-declared; a run that needs either stops rather than inferring them. Resolve
each relevant module as **evidence → action → proof**. Measure identity before any later boundary because
credential-backed setup is not safe until identity is proven. A boundary already ready is `reuse` and
adds no write. Execute requested local actions in registry order:

1. **Identity** — run `node .claude/scripts/init-identity.mjs --source <Source> --plan`. Show whether the
   machine is `ready`, needs the original identity imported, may generate its first identity, or is
   blocked. Never display private material. Installing `~/.starci/master.identity` is a separate write.
2. **Bootstrap** — prove the trust entry exists; classify and display complete before/after content for
   `AGENTS.md` and `CLAUDE.md`.
3. **Workspaces** — verify the Source-wide language, persistent family offsets/application slots, and
   every declared project/role read route against the real checkout. Allocation stays in
   `.workspace/ports.json`; init never copies it into a product.
4. **Worktrees** — verify the project design registry, business authority and cache roots against Git's
   own worktree account and path policy. Create/reuse businesses on `codex/businesses/<project>` independently
   from design registry.

State the evidence and exact action per boundary before changing it. A direct init instruction naming
the needed Source and Project authorises these bounded local writes; do not add a generic approval stop.
Ask only if completion requires an external or destructive action not already granted. The request does
not authorise target, secret publication, network, or external-service writes.

After each action, run that module's proof before moving on. A local-only branch is reported as such, not
missing. Close with the exact resolved roots and effects in concise prose; do not close while a requested
action or its proof remains.

## Stops

- Missing trust entry, unrelated bootstrap content, or an absolute-only bootstrap link.
- Existing ciphertext with no original identity available, or an identity that cannot decrypt its sample.
- A project/role required by the requested boundary was not declared by the owner.
- A stale route is never silently repointed; show the replacement.
- Foreign Git ownership, a dirty legacy registry, or a registry branch collision.
- Any requested product-repository edit; init describes targets and owns Source-local state only.
