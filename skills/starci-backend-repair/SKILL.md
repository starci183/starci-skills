---
name: starci-backend-repair
description: "Use to resume one already approved in-boundary backend repair and rerun independent quality proof. Do not use for new feature planning, unapproved boundary changes, frontend work, or deployment."
---

# starci-backend-repair

Use to resume one already approved in-boundary backend repair and rerun independent quality proof. Do not use for new feature planning, unapproved boundary changes, frontend work, or deployment.

## INPUT ANALYSIS

Require the ephemeral global selection, read `input.md`, validate `input.schema.json`, then follow local `analyze-input.md`. This skill owns one flow with fixed first state `implement`; local analysis only validates and normalizes scope without loading operator knowledge.

## STATE MACHINE

Execute `machine.json` through `execute.md`. Branches and loops are machine-owned; operators never invoke one another. Stop at waits for the exact displayed revision and finish only at a terminal. Purge all intermediates at every terminal while preserving approved durable mutations.

## LOADS

| Alias | Target | Kind | Why |
| --- | --- | --- | --- |
| `@selection` | global `/analyze-input.md` output | task-session | bind prompt intent directly to this one-flow skill |
| `@machine` | `machine.json` | file | executable state-machine graph |
| `@analysis` | `analyze-input.md` | file | local validation and normalization before operator load |
