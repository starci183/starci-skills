# Kernel guards

`execution/kernel-guards.mjs` holds the three things the kernel never delegates to an operation
agent: the ledger record of the node the agent is working on, an exclusive machine resource, and the
worktree's git index. Each guard reads or repairs; none of them decides what to schedule.

## Protected paths

`protectedPaths(node, repoRoot)` returns the repository-relative paths the kernel owns for one Work
node: its `index.yaml` (from `node.path`, or `node.file` for an out-of-tree read) and
`<node dir>/evidence/**`. `changedProtected(git,{cwd,paths})` reads `git status --porcelain` over
those specs — a `/**` spec is passed to git as its bare directory — and answers with the concrete
files that differ from HEAD or are untracked; an untracked directory that git collapses into one
`dir/` line is expanded to the files inside it. `revertProtected(git,{cwd,paths})` puts them back:
`git checkout --` for the tracked ones, deletion for untracked files under a protected directory,
and `{reverted, removed}` as the receipt. Everything outside `paths` is untouched, so the operation
keeps the work it was actually launched to do. A `completion` an agent writes itself is a claim, not
a record: the kernel reverts it and writes the record through `execution/work-ledger.mjs`.

## Exclusive resources

Disjoint allowlists are what make two operations parallel, but two disjoint operations can still
want one Docker daemon. `resourceLocks(op)` unions `op.resources` with the locks its own `kind` and
`checks[].command` prove it will reach for: `test:container|testcontainers|docker` → `docker` and
`postgres`, `test:e2e|e2e` and `uat.verify|playwright` → `e2e-runtime`, `kubectl|helm|KUBECONFIG` →
`cluster`. The result is sorted and unique, and `resourcesClash(a,b)` (two ops, or two lock lists)
is the question the scheduler asks before it runs them at the same time.

## The git queue

One worktree has one index, so `gitQueue(fn)` serialises git work in call order. A synchronous
callback on an idle queue runs immediately and its value comes back unwrapped; anything that returns
a promise, and anything that arrives while asynchronous work is in flight, is chained behind it and
comes back as a promise. A rejected callback does not wedge the queue — the next caller still runs —
and `gitQueueIdle()` reports whether asynchronous work is still pending.

## Worktree preflight

`preflight({worktree, git})` is run once, before anything is launched. It sets `core.longpaths true`
when the worktree does not have it and records that in `fixes`; it reads `core.autocrlf` and
`core.hooksPath`, and detects a husky `pre-commit` that mentions `secrets-guard` or
`ALLOW_SECRET_SCAN` (`facts.secretsGuard` — the kernel's own 64-hex digests look like keys to such a
hook). It then confirms `git status --porcelain` actually runs and that the branch is not `main` or
`master`. A repairable condition is a fix; everything else is a `problem` and `ok` is false, which
belongs to the user rather than to a retry. Paths are compared in slash form, so a Windows separator
is never itself a finding.

## Shared-change paths

When an operation reports a `shared-change` blocker, the paths it needs live in prose.
`parseSharedChangePaths(detail)` pulls out the repository-relative ones in the order they appear:
tokens carrying a separator that end in a file extension or `/**`, or that start with `apps/`,
`src/`, `packages/`, `libs/` or `.starciwork/`. URLs are dropped, because a link is not a write
scope, and a backslash-written path is normalised first.
