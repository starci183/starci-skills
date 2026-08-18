---
title: Initialization · worktrees
---

# Worktrees

## LOADS

None.

`<Source>/.worktrees/<project>/{registries,sessions,cache}` is the project write boundary. The registry is
a locked linked worktree on the project's branch; sessions and cache are ignored local state.

Measure with `git worktree list`, then verify path, lock, cleanliness, branch, Git common-directory owner,
and ignore rules. Classify `create`, `reuse`, or `migrate-legacy`. A foreign owner, dirty legacy registry,
or branch collision blocks the boundary. Prune stale worktrees through Git, never by deleting directories,
and never run destructive Git from a background agent.

Evidence is Git's worktree account plus the measured paths and owners. Action creates, reuses, or safely
migrates only the project root. Proof shows the registry locked, clean, correctly owned and branched;
sessions and cache ignored; and no state under rejected legacy or trust-tree paths.
