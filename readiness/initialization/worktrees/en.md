---
title: Initialization · worktrees
---

# Worktrees

## LOADS

None.

`<Source>/.worktrees/<project>/{businesses,cache}` is the project write boundary. Business authority is a
locked linked worktree on `codex/businesses/<project>`; cache is ignored rebuildable local state. Design
candidates and previews live below `cache/design/<session-id>` and are implemented in the same invocation.

Measure with `git worktree list`, then verify the business path, lock, cleanliness, branch, Git common-directory
owner and cache ignore rule. Classify `create`, `reuse`, or `migrate-legacy`. A foreign owner or branch collision
blocks the boundary. Prune stale worktrees through Git, never by deleting directories,
and never run destructive Git from a background agent.

Evidence is Git's worktree account plus the measured paths and owners. Action creates, reuses, or safely
migrates only the project root. Proof shows the business root locked, clean, correctly owned and branched;
cache ignored; no design-registry worktree; and no state under rejected legacy or trust-tree paths.
