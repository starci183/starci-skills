---
name: starci-deployment-monitor
description: "Use to watch one release that is already rolling out until steady state when observation is the starting action, continuing to recovery, rollback, or a bounded blocker only if evidence requires it. Do not use when recovery is already approved or to initiate a new deployment."
---

# starci-deployment-monitor

Use to watch one release that is already rolling out until steady state when observation is the starting action, continuing to recovery, rollback, or a bounded blocker only if evidence requires it. Do not use when recovery is already approved or to initiate a new deployment.

## INPUT ANALYSIS

Require the ephemeral global selection, read `input.md`, validate `input.schema.json`, then follow local `analyze-input.md`. This skill owns one flow with fixed first state `monitor`; local analysis only validates and normalizes scope without loading operator knowledge.

## STATE MACHINE

Execute `machine.json` through `execute.md`. Branches and loops are machine-owned; operators never invoke one another. Stop at waits for the exact displayed revision and finish only at a terminal. Purge all intermediates at every terminal while preserving approved durable mutations.

## CONTEXT CONTRACT

| State or phase | Allowed | Forbidden |
| --- | --- | --- |
| `intent + plan` | release, manifest, provider and environment metadata | credentials, product source and unrelated provider inventory |
| `approval + apply` | frozen plan, exact approval and opaque credential handles | raw secrets, new discovery and undeclared resources |
| `monitor` | same release identity, declared probes, attempt counter and backoff metadata | new deployment context and unrelated telemetry |
| `recover or rollback` | observed failure, bounded action plan and mutation receipts | different release targets and business reconciliation |
| `proof + reconcile` | public steady/rolled-back proof and frozen business receipt when eligible | raw credentials and mutable intermediate plans |

## LOADS

| Alias | Target | Kind | Why |
| --- | --- | --- | --- |
| `@selection` | global `/analyze-input.md` output | task-session | bind prompt intent directly to this one-flow skill |
| `@machine` | `machine.json` | file | executable state-machine graph |
| `@analysis` | `analyze-input.md` | file | local validation and normalization before operator load |
