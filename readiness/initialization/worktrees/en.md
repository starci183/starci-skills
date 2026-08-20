---
title: Initialization · worktrees
---

# Worktrees

## LOADS

None.

`<Source>/.worktrees/<project>/{registries,businesses,cache}` is the project write boundary. Design registry
and business authority are separate locked linked worktrees on `codex/fe-design-registry/<project>` and
`codex/businesses/<project>`; cache is ignored rebuildable local state and unfinished drafts live below
`cache/drafts`.

Measure with `git worktree list`, then verify path, lock, cleanliness, branch, Git common-directory owner,
and the cache ignore rule. Classify `create`, `reuse`, or `migrate-legacy`. A foreign owner, dirty legacy registry,
or branch collision blocks the boundary. Prune stale worktrees through Git, never by deleting directories,
and never run destructive Git from a background agent.

Evidence is Git's worktree account plus the measured paths and owners. Action creates, reuses, or safely
migrates only the project root. Proof shows both durable roots locked, clean, correctly owned and
branched; cache ignored; and no state under rejected legacy or trust-tree paths.
