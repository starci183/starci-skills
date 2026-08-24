---
name: starci-frontend-surface-reconcile
description: "Use when a closed set of frontend pages or surfaces must converge on the smallest durable design authority. Do not use for a single block, isolated maintenance, or a new customer journey."
---

# starci-frontend-surface-reconcile

Use when a closed set of frontend pages or surfaces must converge on the smallest durable design authority. Do not use for a single block, isolated maintenance, or a new customer journey.

## INPUT ANALYSIS

Require the ephemeral global selection, read `input.md`, validate `input.schema.json`, then follow local `analyze-input.md`. This skill owns one flow with fixed first state `surface-audit`; local analysis only validates and normalizes scope without loading operator knowledge.

## STATE MACHINE

Execute `machine.json` through `execute.md`. Branches and loops are machine-owned; operators never invoke one another. Stop at waits for the exact displayed revision and finish only at a terminal. Purge all intermediates at every terminal while preserving approved durable mutations.

## CONTEXT CONTRACT

| State or phase | Allowed | Forbidden |
| --- | --- | --- |
| every state | current operator declaration only | undeclared context |

## LOADS

| Alias | Target | Kind | Why |
| --- | --- | --- | --- |
| `@selection` | global `/analyze-input.md` output | task-session | bind prompt intent directly to this one-flow skill |
| `@machine` | `machine.json` | file | executable state-machine graph |
| `@analysis` | `analyze-input.md` | file | local validation and normalization before operator load |
