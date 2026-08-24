---
name: starci-observability-reconcile
description: "Use to reconcile shared metrics collection and remote-write boundaries. Do not use for product diagnosis, deployment monitoring, Sonar, or context indexing."
---

# starci-observability-reconcile

Use to reconcile shared metrics collection and remote-write boundaries. Do not use for product diagnosis, deployment monitoring, Sonar, or context indexing.

## INPUT ANALYSIS

Require the ephemeral global selection, read `input.md`, validate `input.schema.json`, then follow local `analyze-input.md`. This skill owns one flow with fixed first state `observability`; local analysis only validates and normalizes scope without loading operator knowledge.

## STATE MACHINE

Execute `machine.json` through `execute.md`. Branches and loops are machine-owned; operators never invoke one another. Stop at waits for the exact displayed revision and finish only at a terminal. Purge all intermediates at every terminal while preserving approved durable mutations.

## CONTEXT CONTRACT

| State or phase | Allowed | Forbidden |
| --- | --- | --- |
| `inspect + plan` | exact service identities, current revisions and declared target metadata | product source, broad provider discovery and raw credentials |
| `approval + apply` | frozen delta, approval receipt and opaque handles | undeclared resources and new context |
| `proof or partial recovery` | declared probes, before/after receipts and bounded retry state | adjacent services and unrelated tenant data |

## LOADS

| Alias | Target | Kind | Why |
| --- | --- | --- | --- |
| `@selection` | global `/analyze-input.md` output | task-session | bind prompt intent directly to this one-flow skill |
| `@machine` | `machine.json` | file | executable state-machine graph |
| `@analysis` | `analyze-input.md` | file | local validation and normalization before operator load |
