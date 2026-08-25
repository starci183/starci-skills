---
name: starci-frontend-block-reconcile
description: "Use when one existing product block or component contract must be reconciled across its closed consumers and every affected backend/frontend role, then proven end to end. Do not use for complete journey design, ordinary maintenance, learning resolution, or broad cross-surface authority changes."
---

# starci-frontend-block-reconcile

Use when one existing product block or component contract must be reconciled across its closed consumers and every affected backend/frontend role, then proven end to end. Do not use for complete journey design, ordinary maintenance, learning resolution, or broad cross-surface authority changes.

## INPUT ANALYSIS

Require the ephemeral global selection, read `input.md`, validate `input.schema.json`, then follow local `analyze-input.md`. This skill owns one flow with fixed first state `block-feedback-request`; local analysis only validates and normalizes scope without loading operator knowledge.

## STATE MACHINE

Execute `machine.json` through `execute.md`. Branches and loops are machine-owned; operators never invoke one another. Stop at waits for the exact displayed revision and finish only at a terminal. Purge all intermediates at every terminal while preserving approved durable mutations.

## CONTEXT CONTRACT

| State or phase | Allowed | Forbidden |
| --- | --- | --- |
| `block plan` | one Block identity, current contract generation, closed consumers and proof-plan headers | unrelated blocks, broad source and raw business context |
| `approval + consumer mutation` | frozen reconciliation hash, exact consumer files, approval receipt and complete acceptance-plan identity | undeclared consumers, new design discovery and scope expansion |
| `proof` | change-set receipt, deterministic seed/reset, declared commands, UI-quality receipt, browser/account handles and complete state-and-viewport evidence | partial proof, skipped scenarios, raw credentials and unrelated design history |
