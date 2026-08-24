---
name: starci-frontend-maintenance-apply
description: "Use to apply one already approved source-first frontend maintenance change and record its durable learning request. Do not use for design exploration, unapproved feedback, or cross-surface authority selection."
---

# starci-frontend-maintenance-apply

Use to apply one already approved source-first frontend maintenance change and record its durable learning request. Do not use for design exploration, unapproved feedback, or cross-surface authority selection.

## INPUT ANALYSIS

Require the ephemeral global selection, read `input.md`, validate `input.schema.json`, then follow local `analyze-input.md`. This skill owns one flow with fixed first state `maintenance-apply`; local analysis only validates and normalizes scope without loading operator knowledge.

## STATE MACHINE

Execute `machine.json` through `execute.md`. Branches and loops are machine-owned; operators never invoke one another. Stop at waits for the exact displayed revision and finish only at a terminal. Purge all intermediates at every terminal while preserving approved durable mutations.

## LOADS

| Alias | Target | Kind | Why |
| --- | --- | --- | --- |
| `@selection` | global `/analyze-input.md` output | task-session | bind prompt intent directly to this one-flow skill |
| `@machine` | `machine.json` | file | executable state-machine graph |
| `@analysis` | `analyze-input.md` | file | local validation and normalization before operator load |
