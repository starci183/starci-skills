---
name: starci-sonar-service-reconcile
description: "Use to reconcile the shared Sonar service and its quality-enforcement boundary. Do not use to fix product findings, deploy releases, index context, or configure observability."
---

# starci-sonar-service-reconcile

Use to reconcile the shared Sonar service and its quality-enforcement boundary. Do not use to fix product findings, deploy releases, index context, or configure observability.

## INPUT ANALYSIS

Require the ephemeral global selection, read `input.md`, validate `input.schema.json`, then follow local `analyze-input.md`. This skill owns one flow with fixed first state `sonar`; local analysis only validates and normalizes scope without loading operator knowledge.

## STATE MACHINE

Execute `machine.json` through `execute.md`. Branches and loops are machine-owned; operators never invoke one another. An omitted `selection.mode` is `gated`: stop at waits for the exact displayed revision. With explicit `selection.mode=bypass`, bind the displayed revision to an ephemeral bypass-authorization receipt and continue only to the wait state's declared `approval.bypassTarget`. Finish only at a terminal and purge all intermediates while preserving authorized durable mutations.

## CONTEXT CONTRACT

| State or phase | Allowed | Forbidden |
| --- | --- | --- |
| `inspect + plan` | exact service identities, current revisions and declared target metadata | product source, broad provider discovery and raw credentials |
| `approval + apply` | frozen delta, approval receipt and opaque handles | undeclared resources and new context |
| `proof or partial recovery` | declared probes, before/after receipts and bounded retry state | adjacent services and unrelated tenant data |
