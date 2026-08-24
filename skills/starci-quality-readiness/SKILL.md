---
name: starci-quality-readiness
description: "Merge workflow diagnosis, check-only readiness, rule accountability, approved finding repair and debt repayment with measured repair loops."
---

# starci-quality-readiness

Merge workflow diagnosis, check-only readiness, rule accountability, approved finding repair and debt repayment with measured repair loops.

## INPUT ANALYSIS

Read `input.md`, validate `input.schema.json`, then follow `analyze-input.md`. The analysis state must select one mode without loading operator knowledge.

## STATE MACHINE

Execute `machine.json` through `execute.md`. Branches and loops are machine-owned; operators never invoke one another. Stop at wait states for the exact displayed revision and finish only at a terminal state.

## LOADS

| Alias | Target | Kind | Why |
| --- | --- | --- | --- |
| `@machine` | `machine.json` | file | executable state-machine graph |
| `@analysis` | `analyze-input.md` | file | lazy branch selection before operator load |
