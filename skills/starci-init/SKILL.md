---
name: starci-init
description: Make a Source ready to be worked in — the agent bootstrap at its root, the workspace routes that say where each role's source is read from, and the worktree state that says where a run may write. Three separate write roots, approved separately, and any subset may be run alone. Use for a new Source, a newly declared project or role, a checkout that moved, a route that went stale, or registry state sitting at a rejected path. Never edits a target repository.
---

# starci-init

Read [`../skill-shape/en.md`](../skill-shape/en.md) first.

**This skill runs more than once.** Its first job is a one-time bootstrap; the other two recur — a
project is declared, a checkout moves, a route goes stale, a second role appears. Being called `init`
does not make a second run suspicious.

Three roots, and they fail in three different directions:

| Root | Decides | Wrong means |
|---|---|---|
| `<Source>/AGENTS.md`, `<Source>/CLAUDE.md` | which tree an agent routes into at all | an agent follows a dead link, then invents its own order |
| `<Source>/.workspace/<project>/` | where source is **read** from | silent — confident answers about another repository |
| `<Source>/.worktrees/<project>/` | where state is **written** | loud — writes land where writing was forbidden |

**One approval never covers more than one root.** Approving "the setup" is how the quiet failure gets
waved through beside the noisy one. Each root is presented, approved and written as its own boundary,
and a run may legitimately touch only one of them.

The three are separate capabilities kept in one skill because they answer one question — *is this
Source ready?* — not because they are one write.

## PROCESS

### 1 — Print CONTEXT

`Phase` is `plan`, then `review`, then `apply`. `Touching` names only the roots this run will write,
and the workflow record. `Project` is **user-declared** — never inferred from Source, from a sibling
checkout name, or from what the last session used. A bootstrap-only run has no project, and says so
rather than inventing one.

### 2 — Bootstrap: prove the tree entry exists

Read the tree's entry, `INDEX.md` at the tree root, and confirm it is there.

**If the entry does not exist, stop.** A bootstrap pointing at a missing file is worse than no
bootstrap: the agent follows the link, finds nothing, and proceeds on its own judgement while believing
it was routed.

### 3 — Bootstrap: read what is already there

Never write over a bootstrap unseen. Classify each of the two files:

| Situation | Verdict |
|---|---|
| absent | `create` |
| present, routes to this tree's entry, no rules inside | `reuse` — nothing to do, say so |
| present, routes to a path that moved | `repoint` — change the link, keep the rest |
| present, carries rules, tables or law text | `slim` — the rules stay in the tree; propose exactly what is removed |
| present, project-specific content unrelated to routing | **stop** — this is somebody's file, not a slot |

`slim` needs the owner's eyes: content is being deleted from a file at the repository root, and the only
argument for it is that the content lives in the tree already. Show which rule each removed line
duplicates, and where it lives now.

### 4 — Workspace: measure every declared role

For each role, does `.workspace/<project>/<role>/config.json` exist, and does it still describe this
machine? Check the checkout directory, the contract path for a frontend role, the manifests it names,
and whether the recorded branch and head still belong to that checkout.

**Parsing is not verifying.** A route whose fields are all well formed and whose paths no longer resolve
is stale, and stale is a different verdict from absent with a different fix.

A monorepo hides its contract from a one-app convention: look where the registry actually is before
recording `null`, because a route that says a project has no contract when it has one leaves every
later stage designing against nothing.

### 5 — Worktrees: measure the project root

Read Git's own account — `git worktree list` — then check the three paths, the registry's lock,
cleanliness, branch and owning Git directory, and whether `sessions` and `cache` are ignored by Source.

Look for state at rejected paths: `.worktrees/registries` without the project segment, or anything under
the trust tree itself. Count it rather than describing it.

Classify each root as `create`, `reuse` or `migrate-legacy`. Write nothing yet.

### 6 — Review each boundary separately

Present one boundary per root, each with its own decision and its own approval:

- the two bootstrap files, shown in full before and after — they are short by design, so there is no
  reason to summarise a diff of them;
- the workspace routes to be written or refreshed, per role;
- the worktree paths to create, reuse or migrate, with the registry branch named.

Stop for a collision, a foreign Git owner, a dirty legacy registry, a branch mismatch, or any write
outside the exact roots. A direct instruction naming Source and Project authorises this bounded local
setup — it does not authorise widening a root.

### 7 — Apply: bootstrap

Both files carry the same content and the same link:

```markdown
# StarCi agent bootstrap

Before planning, reading target source, or running a skill, read
[`<Source>/<tree>/INDEX.md`](<tree>/INDEX.md) completely and follow its load order.

This file is only a bootstrap. Do not copy context, brainstorm, compiler, gate or skill rules into it:
the entry routes, and a rule copied here becomes a second home that nobody remembers to update.
```

They are two files because two runtimes look for two filenames, not because there are two sets of
rules — a runtime that cannot find its name gets no bootstrap at all. Nobody may deduplicate them.

**Relative paths only.** An absolute path makes the bootstrap true on one machine, which is the
`WORKSPACE-6` failure at the repository root.

### 8 — Apply: workspace routes

Refresh route configuration only. Never clone, link, copy, mount or edit a target repository: the route
**describes** a checkout, it never mirrors one. Route values stay machine-local — never committed into
the trust tree — and runtime secrets, environment values and tokens are never route values at all.

### 9 — Apply: worktree state

Install or reuse `<Source>/.worktrees/<project>/{registries,sessions,cache}`. The registry is a locked
linked worktree on the project's own branch; `sessions` and `cache` are ignored local state.

Migrate legacy state behind `<project>` only after verifying it is clean — a dirty legacy registry stops
the migration instead of being copied over.

Stale worktrees are pruned **through Git**, never by deleting a directory: a hand-deleted directory
leaves an administrative record of a worktree that is not there, and the next run inherits an error
nobody caused. Never run destructive Git from a background agent.

### 10 — Verify, read-only

Re-measure and prove each claim of each root that was written:

- follow the bootstrap's link from the repository root exactly as an agent would, and confirm it lands
  on the entry, and that the entry names the load order and the capabilities;
- every declared role resolves, and its contract path exists;
- the registry is locked, clean, on the project branch, owned by this Source's Git;
- `sessions` and `cache` are ignored, and no state remains at a rejected path.

A branch that was never pushed is reported as local-only, not as missing.

### 11 — Close the phase

Append the workflow and print the six tables. Never report the trust tree as a runtime storage root.

## Stops

- The tree entry does not exist → stop; the tree needs an entry before it can be pointed at.
- A bootstrap file holds unrelated project content → stop; propose a location for the routing lines
  rather than overwriting somebody's file.
- The link would have to be absolute to resolve → stop; the tree is not where the bootstrap can reach
  it, which is a layout problem rather than a wording problem.
- `Project` not declared by the user, on a run that touches a project root → stop; inferring identity is
  how two projects come to share one root.
- A route resolves but its checkout or contract path is gone → report stale; do not repoint it silently.
- A registry worktree owned by another Git common directory → refuse; it is not this Source's state.
- A dirty legacy registry → stop the migration.
- A rule can only be removed from a bootstrap by rewriting it elsewhere → that is a trust-tree change,
  not an init.

## OUTPUT

The six tables from the skill shape, in order. `CHANGES` names each written path under each root and
what happened to it; `NEED APPROVALS` carries one row per root, never one row for "the setup";
`WARNINGS` carries local-only branches and any legacy state left in place; `REJECTED` carries any line
the owner kept that this skill proposed removing, with their reason.
