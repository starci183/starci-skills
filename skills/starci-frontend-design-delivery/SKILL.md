---
name: starci-frontend-design-delivery
description: "Merge new flow/layout, block work, feedback, durable learning and cross-surface reconciliation behind explicit input analysis and creative approval loops."
---

# starci-frontend-design-delivery

Merge new flow/layout, block work, feedback, durable learning and cross-surface reconciliation behind explicit input analysis and creative approval loops.

## INPUT ANALYSIS

Read `input.md`, validate `input.schema.json`, then follow `analyze-input.md`. The analysis state must select one mode without loading operator knowledge.

## STATE MACHINE

Execute `machine.json` through `execute.md`. Branches and loops are machine-owned; operators never invoke one another. Stop at wait states for the exact displayed revision and finish only at a terminal state.

## LOADS

| Alias | Target | Kind | Why |
| --- | --- | --- | --- |
| `@machine` | `machine.json` | file | executable state-machine graph |
| `@analysis` | `analyze-input.md` | file | lazy branch selection before operator load |
