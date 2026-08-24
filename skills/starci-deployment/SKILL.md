---
name: starci-deployment
description: "Adopt, deploy, monitor, recover or roll back one declared release through immutable artifacts, provider/runtime evidence and public steady state."
---

# starci-deployment

Adopt, deploy, monitor, recover or roll back one declared release through immutable artifacts, provider/runtime evidence and public steady state.

## INPUT ANALYSIS

Read `input.md`, validate `input.schema.json`, then follow `analyze-input.md`. The analysis state must select one mode without loading operator knowledge.

## STATE MACHINE

Execute `machine.json` through `execute.md`. Branches and loops are machine-owned; operators never invoke one another. Stop at wait states for the exact displayed revision and finish only at a terminal state. Operator data is task-session-only; purge all intermediates at every terminal while preserving approved durable mutations.

## LOADS

| Alias | Target | Kind | Why |
| --- | --- | --- | --- |
| `@machine` | `machine.json` | file | executable state-machine graph |
| `@analysis` | `analyze-input.md` | file | lazy branch selection before operator load |
