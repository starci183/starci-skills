---
name: starci-frontend-block-reconcile
description: "Use when one existing frontend block or component contract must be reconciled with its known consumers. Do not use for complete journey design, maintenance, learning resolution, or broad cross-surface authority changes."
---

# starci-frontend-block-reconcile

Use when one existing frontend block or component contract must be reconciled with its known consumers. Do not use for complete journey design, maintenance, learning resolution, or broad cross-surface authority changes.

## INPUT ANALYSIS

Require the ephemeral global selection, read `input.md`, validate `input.schema.json`, then follow local `analyze-input.md`. This skill owns one flow with fixed first state `block-reconcile`; local analysis only validates and normalizes scope without loading operator knowledge.

## STATE MACHINE

Execute `machine.json` through `execute.md`. Branches and loops are machine-owned; operators never invoke one another. Stop at waits for the exact displayed revision and finish only at a terminal. Purge all intermediates at every terminal while preserving approved durable mutations.

## LOADS

| Alias | Target | Kind | Why |
| --- | --- | --- | --- |
| `@selection` | global `/analyze-input.md` output | task-session | bind prompt intent directly to this one-flow skill |
| `@machine` | `machine.json` | file | executable state-machine graph |
| `@analysis` | `analyze-input.md` | file | local validation and normalization before operator load |
