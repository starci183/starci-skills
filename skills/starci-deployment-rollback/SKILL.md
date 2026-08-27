---
name: starci-deployment-rollback
description: "Use to roll back one declared failed or rejected release identity and prove the resulting state. Do not use to deploy, monitor, or attempt recovery first."
---

# starci-deployment-rollback

Use to roll back one declared failed or rejected release identity and prove the resulting state. Do not use to deploy, monitor, or attempt recovery first.

## INPUT ANALYSIS

Require the ephemeral global selection, read `input.md`, validate `input.schema.json`, then follow local `analyze-input.md`. This skill owns one flow with fixed first state `rollback`; local analysis only validates and normalizes scope without loading operator knowledge.

## STATE MACHINE

Execute `machine.json` through `execute.md`. Branches and loops are machine-owned; operators never invoke one another. An omitted `selection.mode` is `gated`: stop at waits for the exact displayed revision. With explicit `selection.mode=bypass`, bind the displayed revision to an ephemeral bypass-authorization receipt and continue only to the wait state's declared `approval.bypassTarget`. Finish only at a terminal and purge all intermediates while preserving authorized durable mutations.

## CONTEXT CONTRACT

| State or phase | Allowed | Forbidden |
| --- | --- | --- |
| `intent + plan` | release, manifest, provider and environment metadata | credentials, product source and unrelated provider inventory |
| `approval + apply` | frozen plan, exact approval and opaque credential handles | raw secrets, new discovery and undeclared resources |
| `monitor` | same release identity, declared probes, attempt counter and backoff metadata | new deployment context and unrelated telemetry |
| `recover or rollback` | observed failure, bounded action plan and mutation receipts | different release targets and business reconciliation |
| `proof + reconcile` | public steady/rolled-back proof and frozen business receipt when eligible | raw credentials and mutable intermediate plans |
