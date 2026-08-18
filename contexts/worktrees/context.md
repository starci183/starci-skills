# Worktrees

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@schema` | `contexts/worktrees/schema.json` | file | validate the record's JSON shape |

## Record

You are given a run that is about to write something, and you return where each write goes: a durable
registry that is versioned, local progress that is disposable, or nothing at all because the run needs
no isolation. This module decides **where in-progress state is written**. It is the twin of the
workspace question and it fails the opposite way: a wrong workspace makes an agent read the wrong
repository and answer confidently; a wrong worktree makes an agent write where writes were forbidden,
so the damage is loud but it lands in someone else's source.

## Law

State is placed by what it is worth, not by what is convenient. Something that must survive and be
reviewable is versioned on its own branch; something rebuildable is local and ignored; a target
repository is neither and receives nothing from a run's bookkeeping.

The project segment is mandatory. State that is not filed under a project is state that another project
will read as its own.

`.claude` is a trust tree, never a runtime storage root. A tree that stores the work also stores the
mess, and a rule tree with session debris in it stops reading as authority.

## Situation codes

| Code | Situation | Where it goes |
|---|---|---|
| `WORKTREE-1` | State must survive and be reviewable | `<Source>/.worktrees/<project>/registries`, locked linked worktree on its own branch |
| `WORKTREE-2` | Progress or a rebuildable pack | `<Source>/.worktrees/<project>/sessions` or `cache`, ignored |
| `WORKTREE-3` | A path without the project segment, or under `.claude` | rejected; migrate behind `<project>` |
| `WORKTREE-4` | A registry worktree owned by another Git common directory | rejected; it is not this Source's state |
| `WORKTREE-5` | Parallel agents about to write | isolate only when two of them mutate one file |
| `WORKTREE-6` | A worktree is stale, prunable or in the way | pruned deliberately; never force-removed as a directory |

## Reading a run

1. **Name what the run produces**, then ask of each output: must it survive review, or can it be
   rebuilt? That single question separates `WORKTREE-1` from `WORKTREE-2`.
2. **Never place state without the project segment.** A path is checked for `<project>` before it is
   written — `WORKTREE-3`.
3. **Check ownership before trusting a registry.** Locked, clean, on the project branch, owned by this
   Source's Git common directory — `WORKTREE-4`.
4. **Decide isolation by collision, not by parallelism.** Many agents writing many different files need
   no worktree at all — `WORKTREE-5`.
5. **Leave the target repository alone.** A run's bookkeeping never lands in the repository being worked
   on; durable product records belong to that repository through its own review, not through this state.

## `WORKTREE-1` — state that must survive

**Situation.** The run produces something a person will read later and may disagree with: a design
registry, an accepted candidate, a decision record.

**Recognition signs**

- Losing it would lose a decision, not just time.
- Someone may need to see how it changed.
- It is not derivable from anything else on disk.

**Ask yourself.** If this were deleted, would a decision have to be made again?

**Boundary**

- `WORKTREE-2`: anything rebuildable from source or from a run belongs there instead, however expensive
  it was to produce.

**How it fails.** Durable state is written into an ignored folder, so the history that justified a
decision is gone the first time the folder is cleaned.

## `WORKTREE-2` — progress and rebuildable packs

**Situation.** The run produces its own footprints: partial progress, an index, a preview build, a
memory pack.

**Recognition signs**

- It can be produced again by running the same thing.
- Nobody will review it.
- It grows without bound if nothing removes it.

**Ask yourself.** Can this be rebuilt by re-running the work?

**Boundary**

- `WORKTREE-1`: if a reviewer would ever cite it, it is not disposable.

**How it fails.** A cache is committed, and from then on the repository carries a snapshot that contradicts
the source it was derived from.

## `WORKTREE-3` — a path that skips the project, or hides under `.claude`

**Situation.** State is about to be written to `<Source>/.worktrees/registries`, or anywhere under
`<Source>/.claude/`.

**Recognition signs**

- No project segment in the path.
- The path lies inside the trust tree.
- Two projects on this machine would collide in that location.

**Ask yourself.** Would a second project write to this exact path?

**Boundary**

- `WORKTREE-4`: this is about the path; ownership is about which Git directory the worktree belongs to.

**How it fails.** It works perfectly for the first project and silently mixes state for the second, and
the trust tree accumulates run debris that makes its own rules look provisional.

## `WORKTREE-4` — the registry belongs to another Git

**Situation.** A registry worktree exists at the right path but is administered by a different Git common
directory, or it is unlocked, dirty, or on the wrong branch.

**Recognition signs**

- `git worktree list` from this Source does not account for it.
- The branch is not the project's registry branch.
- It has uncommitted changes nobody in this run made.

**Ask yourself.** Does this Source's Git actually own this worktree?

**Boundary**

- `WORKTREE-6`: a worktree this Source owns but no longer needs is pruned. One it never owned is refused.

**How it fails.** The run commits into a branch another checkout is standing on, and two histories start
disagreeing about the same registry.

## `WORKTREE-5` — parallel agents about to write

**Situation.** Several agents run at once and each will write files.

**Recognition signs**

- Each agent's output path is known before it starts.
- Either those paths are disjoint, or two agents will touch one file.

**Ask yourself.** Will two agents write the same file, or merely write at the same time?

**Boundary**

- `WORKTREE-1`: isolation is about collision during the run; durability is a separate question answered
  separately.

**How it fails.** Isolation is bought for every agent by reflex — it costs setup time and disk each —
or, worse, agents share one worktree and run in parallel, and the last writer erases the others. Agents
that must share a worktree run one at a time.

## `WORKTREE-6` — a worktree is stale

**Situation.** A worktree is prunable, abandoned, or standing where new state must go.

**Recognition signs**

- Git reports it as prunable.
- Its branch is merged, gone, or was never pushed.
- Its directory is missing while the administrative record remains.

**Ask yourself.** Is the record stale, or is the work in it unfinished?

**Boundary**

- `WORKTREE-4`: refuse what this Source does not own; prune only what it does.

**How it fails.** The directory is deleted by hand, so Git keeps an administrative record of a worktree
that is not there, and the next run inherits an error nobody caused. Destructive Git is never run from a
background agent, where nobody is watching the branch it stands on.

## Inputs

| Input | Evidence required |
|---|---|
| roots | The three paths under `.worktrees/<project>/`, valid against `@schema` beside this record |
| project | A declared project name, never inferred from a folder |
| source | The repository holding the trust tree |
| outputs | Each thing the run will write, and whether it is rebuildable |
| worktree list | Git's own account of worktrees, with lock and prunable status |
| ignore proof | That `sessions` and `cache` are ignored by Source |

## Rules

1. Durable state is versioned on its own branch; rebuildable state is ignored. Nothing durable lives in
   an ignored folder.
2. The project segment is mandatory in every state path.
3. `.claude` is never a runtime storage root.
4. A registry worktree must be locked, clean, on the project branch, and owned by this Source's Git.
5. Isolation is decided by file collision, not by the number of agents.
6. Agents sharing one worktree run sequentially.
7. A run's bookkeeping never writes into the target repository.
8. Stale worktrees are pruned through Git, never by deleting a directory, and never from a background
   agent.

## Exceptions

- **Reuse over creation.** An existing project root that already satisfies ownership is reused; a second
  root for the same project is a collision, not a convenience.
- **Legacy migration.** State already sitting at a rejected path is migrated behind `<project>` once it
  is verified clean. A dirty legacy registry stops the migration instead of being copied over.
- **A branch that is only local.** A registry branch that was never pushed is still valid state. It is
  reported as local-only rather than treated as missing.

## Output

One block per thing the run writes:

```text
output: <what is being written>
durability: <durable | rebuildable>
path: <.worktrees/<project>/registries | sessions | cache>
isolation: <required | not required>
ownership: <locked, clean, branch, owning git dir>
situation: <WORKTREE-1 | WORKTREE-2 | WORKTREE-3 | WORKTREE-4 | WORKTREE-5 | WORKTREE-6>
reason: <the fact that decided the placement>
```
