---
title: Initialization · worktrees
---

# Worktrees

## LOADS

None.

`<Source>/.worktrees/<project>/{businesses,debts}` is the durable linked-worktree boundary. Business authority
uses `codex/businesses/<project>` and accepted debt uses `quality-debts/<project>`. Design candidates and previews
live below `<Source>/.sessions/<project>/<session-id>/design` and are implemented in the same invocation.

Measure with `git worktree list`, then verify the business path, lock, cleanliness, branch, Git common-directory
owner, debt worktree and session ignore rule. Classify `create`, `reuse`, or `migrate-legacy`. A foreign owner or branch collision
blocks the boundary. Prune stale worktrees through Git, never by deleting directories,
and never run destructive Git from a background agent.

Evidence is Git's worktree account plus the measured paths and owners. Action creates, reuses, or safely
migrates only the project root. Proof shows the business root locked, clean, correctly owned and branched;
debt root correctly owned and branched; sessions ignored; no design-registry worktree; and no state under rejected legacy or trust-tree paths.
