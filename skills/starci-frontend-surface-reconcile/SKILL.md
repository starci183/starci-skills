---
name: starci-frontend-surface-reconcile
description: "Use when a closed set of product surfaces must converge on the smallest durable authority and every affected backend/frontend consumer, then pass complete end-to-end proof. Do not use for a single block, isolated maintenance, or a new customer journey."
---

# starci-frontend-surface-reconcile

Use when a closed set of product surfaces must converge on the smallest durable authority and every affected backend/frontend consumer, then pass complete end-to-end proof. Do not use for a single block, isolated maintenance, or a new customer journey.

## INPUT ANALYSIS

Require the ephemeral global selection, read `input.md`, validate `input.schema.json`, then follow local `analyze-input.md`. This skill owns one flow with fixed first state `surface-feedback-request`; local analysis only validates and normalizes scope without loading operator knowledge.

## STATE MACHINE

Execute `machine.json` through `execute.md`. Branches and loops are machine-owned; operators never invoke one another. Before an architecture approval wait, read and apply `../../operators/architecture/review-widget.md`; `architecture/decision-challenge` must emit a validated HTML preview and the host must render it through `visualize` before requesting `OK ARCHITECTURE`. Stop at waits for the exact displayed revision and finish only at a terminal. Purge all intermediates at every terminal while preserving approved durable mutations.

## CONTEXT CONTRACT

| State or phase | Allowed | Forbidden |
| --- | --- | --- |
| `surface audit + authority` | closed surface IDs, current authority/consumer revisions, observed inconsistency and proof-plan headers | unrelated surfaces, broad source and raw business context |
| `approval + reconcile` | frozen authority hash, exact authority and consumer targets, approval receipt and complete acceptance-plan identity | undeclared consumers, new discovery and scope expansion |
| `proof` | joined authority/source change receipt, deterministic seed/reset, declared commands, UI-quality receipt, browser/account handles and complete state-and-viewport evidence | partial proof, skipped scenarios, raw credentials and unrelated design history |
