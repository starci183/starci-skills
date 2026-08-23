---
title: starci-init · English
---

# starci-init

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/en.md` | en | the shared reporting contract every skill reads |
| `@initialization` | `readiness/initialization/en.md` | en | the identity-first boundaries and the owner of each init verdict |

## NESTED SKILLS

None. This skill never invokes another skill.

## PIPELINE

Topology: `reconciliation` across four ordered readiness boundaries.

| Step | Track | Input | Transform | Required output | Gate |
|---|---|---|---|---|---|
| identity | execution | machine and encrypted Source identity declarations | reconcile SOPS/age identity without touching target repositories | identity receipt | decrypt identity is available and secret-safe |
| bootstrap | execution | identity receipt and agent bootstrap declarations | reconcile required local bootstrap state | bootstrap receipt | bootstrap reads and checks pass |
| routes | reconciliation | workspace declarations, immutable source-reference catalog and observed project/role locations | install/verify shared offline references and reconcile route records | workspace receipt | every source reference and requested role resolves exactly |
| worktrees-proof | execution | verified routes and durable worktree declarations | reconcile project worktree state and re-read all four boundaries | readiness receipt | identity, bootstrap, routes and worktrees are all green |

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
3. **Workspaces** — plan and install every immutable FE/BE pattern reference at
   `.workspace/references/<id>`, writing portable routes to `.workspace/pattern-references.json`; then
   verify the Source-wide language, persistent family offsets/application slots, and every declared
   project/role read route against the real checkout. Reuse local Git objects when present and fetch the
   exact catalog commit only when missing. Allocation stays in
   `.workspace/ports/config.json` plus one `.workspace/ports/<project>.json`; init never copies allocation
   ownership into a product. For every role, write `grammar` and `grammarProfile` as both null or an
   explicitly declared pair whose grammar authority package and profile exist; never infer them from identity.
4. **Worktrees** — verify the project business authority and ignored cache root against Git's worktree
   account and path policy. Create or reuse `businesses` on `codex/businesses/<project>`; create no design registry.

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
- A missing pattern reference returns to this skill; downstream pattern compilers may not install it.
- Foreign Git ownership or a business-authority branch collision.
- Any requested product-repository edit; init describes targets and owns Source-local state only.
