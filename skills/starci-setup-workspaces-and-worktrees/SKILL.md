---
name: starci-setup-workspaces-and-worktrees
description: Configure, repair or verify a project's workspace routes and its worktree state — where source is read from, and where in-progress state is written. Two separate write roots, approved separately. Use when a project or role is declared, a checkout path changes, a route goes stale, or registry state must move behind the project segment. Never edits a target repository.
---

# starci-setup-workspaces-and-worktrees

Read [`../skill-shape/en.md`](../skill-shape/en.md) first. One skill, **two roots that fail in opposite
directions**:

| Root | Decides | Wrong means |
|---|---|---|
| `<Source>/.workspace/<project>/` | where source is **read** from | silent — the agent answers confidently about another repository |
| `<Source>/.worktrees/<project>/` | where state is **written** | loud — writes land where writing was forbidden |

One approval never covers both. Each root is approved as its own boundary, because approving "the setup"
is how the quiet failure gets waved through alongside the noisy one.

## PROCESS

### 1 — Print CONTEXT

`Phase` is `plan`, then `review`, then `apply`, inside this one skill. `Project` is **user-declared** —
never inferred from Source, from a sibling checkout name, or from what the last session used.
`Touching` names the two roots explicitly and separately.

### 2 — Plan: measure both roots

**Workspace.** For each declared role, does `.workspace/<project>/<role>/config.json` exist, and does it
still describe this machine? Check the checkout directory, the contract path for a frontend role, the
manifests it names, and whether the recorded branch and head still belong to that checkout. Parsing is
not verifying.

**Worktrees.** Read Git's own account: `git worktree list`. Check the project root's three paths, the
registry's lock, cleanliness, branch and owning Git directory, and whether `sessions` and `cache` are
ignored by Source. Look for state at rejected paths — `.worktrees/registries` without the project
segment, or anything under `.claude/worktrees/` — and count it rather than describing it.

Classify each root as `create`, `reuse` or `migrate-legacy`. Write nothing yet.

### 3 — Review: freeze each boundary separately

Present two boundaries, each with its own decision:

- the workspace routes to be written or refreshed, per role;
- the worktree paths to be created, reused or migrated, with the registry branch named.

Stop for a collision, a foreign Git owner, a dirty legacy registry, a branch mismatch, or any write
outside the exact roots. A direct instruction naming Source and Project authorises the bounded local
setup — it does not authorise widening either root.

### 4 — Apply: workspace routes

Refresh route configuration only. Never clone, link, copy, mount or edit a target repository: the route
**describes** a checkout, it never mirrors one. Route values stay machine-local — never committed into
the trust tree — and runtime secrets, environment values and tokens are never route values at all.

### 5 — Apply: worktree state

Install or reuse `<Source>/.worktrees/<project>/{registries,sessions,cache}`. The registry is a locked
linked worktree on the project's own branch; `sessions` and `cache` are ignored local state.

Migrate legacy state behind `<project>` only after verifying it is clean — a dirty legacy registry stops
the migration instead of being copied over.

Stale worktrees are pruned **through Git**, never by deleting a directory: a hand-deleted directory
leaves an administrative record of a worktree that is not there, and the next run inherits an error
nobody caused. Never run destructive Git from a background agent.

### 6 — Verify, read-only

Re-measure both roots and prove each claim:

- every declared role resolves, and its contract path exists;
- the registry is locked, clean, on the project branch, owned by this Source's Git;
- `sessions` and `cache` are ignored;
- no state remains at a rejected path.

A branch that was never pushed is reported as local-only, not as missing.

### 7 — Close the phase

Append the workflow and print the six tables. Never report `.claude` as a runtime storage root.

## Stops

- `Project` not declared by the user → stop; inferring identity is how two projects share one root.
- A route resolves but its checkout or contract path is gone → report stale, do not repoint it silently.
- A registry worktree owned by another Git common directory → refuse; it is not this Source's state.
- A dirty legacy registry → stop the migration.
- A required write outside the two exact roots → return to the owner.

## OUTPUT

The six tables from the skill shape, in order. `CHANGES` names the exact route files and worktree paths;
`WARNINGS` carries local-only branches and any legacy state left in place; `OWED` carries verification
that did not run and the exact command that clears it.
