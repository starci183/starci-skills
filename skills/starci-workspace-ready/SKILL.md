---
name: starci-workspace-ready
description: "Initialize or verify Source identity, bootstrap, portable declarations, local routes and worktrees without loading product delivery knowledge."
---

# starci-workspace-ready

Initialize or verify Source identity, bootstrap, portable declarations, local routes and worktrees without loading product delivery knowledge.

## INPUT ANALYSIS

Read `input.md`, validate `input.schema.json`, then follow `analyze-input.md`. The analysis state must select one mode without loading operator knowledge.

## STATE MACHINE

Execute `machine.json` through `execute.md`. Branches and loops are machine-owned; operators never invoke one another. Stop at wait states for the exact displayed revision and finish only at a terminal state. Operator data is task-session-only; purge all intermediates at every terminal while preserving approved durable mutations.

## LOADS

| Alias | Target | Kind | Why |
| --- | --- | --- | --- |
| `@machine` | `machine.json` | file | executable state-machine graph |
| `@analysis` | `analyze-input.md` | file | lazy branch selection before operator load |
