---
name: starci-frontend-layout-delivery
description: "Use to create or substantially redesign a complete frontend customer journey, page set, page models, layouts, implementation, and proof. Do not use for isolated blocks, approved maintenance, learning resolution, or cross-surface consistency."
---

# starci-frontend-layout-delivery

Use to create or substantially redesign a complete frontend customer journey, page set, page models, layouts, implementation, and proof. Do not use for isolated blocks, approved maintenance, learning resolution, or cross-surface consistency.

## INPUT ANALYSIS

Require the ephemeral global selection, read `input.md`, validate `input.schema.json`, then follow local `analyze-input.md`. This skill owns one flow with fixed first state `preflight`; local analysis only validates and normalizes scope without loading operator knowledge.

## STATE MACHINE

Execute `machine.json` through `execute.md`. Branches and loops are machine-owned; operators never invoke one another. Stop at waits for the exact displayed revision and finish only at a terminal. Purge all intermediates at every terminal while preserving approved durable mutations.

## LOADS

| Alias | Target | Kind | Why |
| --- | --- | --- | --- |
| `@selection` | global `/analyze-input.md` output | task-session | bind prompt intent directly to this one-flow skill |
| `@machine` | `machine.json` | file | executable state-machine graph |
| `@analysis` | `analyze-input.md` | file | local validation and normalization before operator load |
